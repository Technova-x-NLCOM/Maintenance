import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BatchDistributionCalculation,
  BatchDistributionItemOption,
  BatchDistributionService,
  BatchDistributionTemplatePayload,
  BatchDistributionTemplateSummary,
  DistributionType,
} from '../../../../services/batch-distribution.service';

interface EditableTemplateLine {
  item_id: number;
  quantity_per_base: number;
  notes: string;
  current_stock?: number;
}

@Component({
  selector: 'app-batch-distribution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batch-distribution.component.html',
  styleUrls: ['./batch-distribution.component.scss'],
})
export class BatchDistributionComponent implements OnInit {
  loadingTemplates = false;
  loadingItemOptions = false;
  savingTemplate = false;
  calculating = false;
  issuing = false;

  templates: BatchDistributionTemplateSummary[] = [];
  itemOptions: BatchDistributionItemOption[] = [];

  selectedTemplateId: number | null = null;
  selectedTemplateName = '';

  searchTemplate = '';
  templateTypeFilter: 'all' | DistributionType = 'all';
  templateViewMode: 'card' | 'list' = 'card';
  templatePage = 1;
  readonly templatePageSize = 10;
  searchItem = '';

  showTemplateForm = false;
  isEditingTemplate = false;

  templateForm: {
    template_name: string;
    distribution_type: DistributionType;
    base_unit_count: number;
    notes: string;
  } = {
    template_name: '',
    distribution_type: 'feeding_program',
    base_unit_count: 100,
    notes: '',
  };

  lineDraftItemId: number | null = null;
  lineDraftQuantityPerBase = 1;
  lineDraftNotes = '';
  templateLines: EditableTemplateLine[] = [];
  itemComboboxOpen = false;
  activeItemOptionIndex = -1;

  targetUnitCount = 100;
  destination = '';
  reason = 'Batch Distribution';
  issueNotes = '';

  calculation: BatchDistributionCalculation | null = null;

  errorMessage = '';
  successMessage = '';
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadTemplatesSub?: Subscription;
  private templateSearchDebounce?: ReturnType<typeof setTimeout>;
  private templatesBaseline: BatchDistributionTemplateSummary[] | null = null;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  private loadItemOptionsSub?: Subscription;
  private itemOptionsSearchDebounce?: ReturnType<typeof setTimeout>;
  private itemOptionsBaseline: BatchDistributionItemOption[] | null = null;

  constructor(
    private batchService: BatchDistributionService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.loadItemOptions();
  }

  ngOnDestroy(): void {
    this.cancelTemplateSearchDebounce();
    this.cancelItemOptionsSearchDebounce();
    this.clearToastTimeout();
    this.loadTemplatesSub?.unsubscribe();
    this.loadItemOptionsSub?.unsubscribe();
  }

  get selectedDistributionType(): DistributionType {
    if (this.calculation?.template?.distribution_type) {
      return this.calculation.template.distribution_type;
    }

    if (this.selectedTemplateId) {
      const selected = this.templates.find((t) => t.template_id === this.selectedTemplateId);
      if (selected) {
        return selected.distribution_type;
      }
    }

    return this.templateForm.distribution_type;
  }

  get targetCountLabel(): string {
    return this.selectedDistributionType === 'relief_goods'
      ? 'Number of Relief Packs'
      : 'Target Attendees';
  }

  get perUnitLabel(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Items per Pack' : 'Amount per Serving';
  }

  get targetUnitNounPlural(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Packs' : 'Attendees';
  }

  get normalizedTargetUnitCount(): number {
    const normalizedTarget = Math.floor(Number(this.targetUnitCount));
    return Number.isFinite(normalizedTarget) && normalizedTarget > 0 ? normalizedTarget : 0;
  }

  get normalizedBaseUnitCount(): number {
    const baseFromCalculation = Number(this.calculation?.template?.base_unit_count ?? 0);
    if (Number.isFinite(baseFromCalculation) && baseFromCalculation > 0) {
      return Math.floor(baseFromCalculation);
    }

    if (this.selectedTemplateId) {
      const selected = this.templates.find((t) => t.template_id === this.selectedTemplateId);
      if (selected && Number.isFinite(selected.base_unit_count) && selected.base_unit_count > 0) {
        return Math.floor(selected.base_unit_count);
      }
    }

    const baseFromForm = Number(this.templateForm.base_unit_count);
    return Number.isFinite(baseFromForm) && baseFromForm > 0 ? Math.floor(baseFromForm) : 1;
  }

  get calculatedMultiplier(): number {
    const target = this.normalizedTargetUnitCount;
    const base = this.normalizedBaseUnitCount;
    if (base <= 0) {
      return 0;
    }

    return target / base;
  }

  calculateRequiredQuantity(amountPerServingOrPack: number): number {
    const perUnit = Number(amountPerServingOrPack);
    if (!Number.isFinite(perUnit) || perUnit <= 0) {
      return 0;
    }

    return perUnit * this.calculatedMultiplier;
  }

  getRowRequiredQuantity(row: {
    quantity_per_base: number;
    required_quantity_for_issuance?: number;
  }): number {
    if (Number.isFinite(Number(row.required_quantity_for_issuance))) {
      return Number(row.required_quantity_for_issuance);
    }

    return this.calculateRequiredQuantity(row.quantity_per_base);
  }

  getRowShortageQuantity(row: {
    quantity_per_base: number;
    current_stock: number;
    shortage_quantity?: number;
  }): number {
    if (Number.isFinite(Number(row.shortage_quantity))) {
      return Number(row.shortage_quantity);
    }

    return Math.max(0, this.getRowRequiredQuantity(row) - Number(row.current_stock || 0));
  }

  rowHasShortage(row: { quantity_per_base: number; current_stock: number }): boolean {
    return this.getRowShortageQuantity(row) > 0;
  }

  get totalRequiredQuantity(): number {
    if (!this.calculation) {
      return 0;
    }

    if (Number.isFinite(Number(this.calculation.summary.total_required_quantity_for_issuance))) {
      return Number(this.calculation.summary.total_required_quantity_for_issuance);
    }

    return this.calculation.items.reduce((sum, row) => sum + this.getRowRequiredQuantity(row), 0);
  }

  get totalShortageQuantity(): number {
    if (!this.calculation) {
      return 0;
    }

    const summaryWithTotal = this.calculation.summary as { total_shortage_quantity?: number };
    if (Number.isFinite(Number(summaryWithTotal.total_shortage_quantity))) {
      return Number(summaryWithTotal.total_shortage_quantity);
    }

    return this.calculation.items.reduce((sum, row) => sum + this.getRowShortageQuantity(row), 0);
  }

  get hasTotalShortage(): boolean {
    return this.totalShortageQuantity > 0;
  }

  get shortageLineCount(): number {
    if (!this.calculation) {
      return 0;
    }

    if (Number.isFinite(Number(this.calculation.summary.insufficient_items_count))) {
      return Number(this.calculation.summary.insufficient_items_count);
    }

    return this.calculation.items.filter((row) => this.rowHasShortage(row)).length;
  }

  get totalTemplatePages(): number {
    return Math.max(1, Math.ceil(this.templates.length / this.templatePageSize));
  }

  get paginatedTemplates(): BatchDistributionTemplateSummary[] {
    const start = (this.templatePage - 1) * this.templatePageSize;
    return this.templates.slice(start, start + this.templatePageSize);
  }

  get templatePageStart(): number {
    if (this.templates.length === 0) {
      return 0;
    }

    return (this.templatePage - 1) * this.templatePageSize + 1;
  }

  get templatePageEnd(): number {
    return Math.min(this.templatePage * this.templatePageSize, this.templates.length);
  }

  get canGoToPreviousTemplatePage(): boolean {
    return this.templatePage > 1;
  }

  get canGoToNextTemplatePage(): boolean {
    return this.templatePage < this.totalTemplatePages;
  }

  private clearToastTimeout(): void {
    if (this.toastTimeout !== undefined) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = undefined;
    }
  }

  showToast(type: 'success' | 'error', message: string): void {
    this.clearToastTimeout();
    this.toastType = type;
    this.toastMessage = message;
    this.cdr.detectChanges();

    this.toastTimeout = setTimeout(() => {
      this.toastMessage = '';
      this.toastTimeout = undefined;
      this.cdr.detectChanges();
    }, 3500);
  }

  loadTemplates(): void {
    this.cancelTemplateSearchDebounce();
    this.loadingTemplates = true;
    this.loadTemplatesSub?.unsubscribe();
    this.loadTemplatesSub = this.batchService
      .listTemplates(
        this.searchTemplate || undefined,
        this.templateTypeFilter === 'all' ? undefined : this.templateTypeFilter,
      )
      .subscribe({
        next: (response) => {
          this.templates = response.data;
          if (!this.searchTemplate.trim() && this.templateTypeFilter === 'all') {
            this.templatesBaseline = response.data.slice();
          }
          this.loadingTemplates = false;
          this.ensureTemplatePageInRange();

          if (this.selectedTemplateId) {
            const stillExists = this.templates.some(
              (t) => t.template_id === this.selectedTemplateId,
            );
            if (!stillExists) {
              this.selectedTemplateId = null;
              this.selectedTemplateName = '';
              this.calculation = null;
            }
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loadingTemplates = false;
          this.errorMessage = err?.error?.message || 'Failed to load templates.';
          this.cdr.detectChanges();
        },
      });
  }

  onTemplateSearchInput(): void {
    this.cancelTemplateSearchDebounce();
    if (!this.searchTemplate.trim()) {
      this.loadTemplatesSub?.unsubscribe();
      this.loadingTemplates = false;
      this.resetTemplatePagination();
      this.loadTemplates();
      return;
    }
    this.templateSearchDebounce = setTimeout(() => {
      this.templateSearchDebounce = undefined;
      this.resetTemplatePagination();
      this.loadTemplates();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearTemplateSearchBox(): void {
    this.searchTemplate = '';
    this.cancelTemplateSearchDebounce();
    this.loadTemplatesSub?.unsubscribe();
    this.loadingTemplates = false;
    this.resetTemplatePagination();
    this.loadTemplates();
  }

  private cancelTemplateSearchDebounce(): void {
    if (this.templateSearchDebounce !== undefined) {
      clearTimeout(this.templateSearchDebounce);
      this.templateSearchDebounce = undefined;
    }
  }

  private restoreTemplatesBaseline(): void {
    if (this.templateTypeFilter !== 'all') {
      this.loadTemplates();
      return;
    }

    if (this.templatesBaseline) {
      this.templates = this.templatesBaseline.slice();
      this.ensureTemplatePageInRange();
      if (this.selectedTemplateId) {
        const stillExists = this.templates.some((t) => t.template_id === this.selectedTemplateId);
        if (!stillExists) {
          this.selectedTemplateId = null;
          this.selectedTemplateName = '';
          this.calculation = null;
        }
      }
      this.cdr.detectChanges();
      return;
    }
    this.loadTemplates();
  }

  loadItemOptions(): void {
    this.cancelItemOptionsSearchDebounce();
    this.loadingItemOptions = true;
    this.loadItemOptionsSub?.unsubscribe();
    this.loadItemOptionsSub = this.batchService
      .listItemOptions(this.searchItem || undefined)
      .subscribe({
        next: (response) => {
          this.itemOptions = response.data;
          if (!this.searchItem.trim()) {
            this.itemOptionsBaseline = response.data.slice();
          }
          this.loadingItemOptions = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loadingItemOptions = false;
          this.errorMessage = err?.error?.message || 'Failed to load item options.';
          this.cdr.detectChanges();
        },
      });
  }

  onItemOptionsSearchInput(): void {
    this.cancelItemOptionsSearchDebounce();
    if (!this.searchItem.trim()) {
      this.loadItemOptionsSub?.unsubscribe();
      this.loadingItemOptions = false;
      this.restoreItemOptionsBaseline();
      return;
    }
    this.itemOptionsSearchDebounce = setTimeout(() => {
      this.itemOptionsSearchDebounce = undefined;
      this.loadItemOptions();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearItemSearchBox(): void {
    this.searchItem = '';
    this.cancelItemOptionsSearchDebounce();
    this.loadItemOptionsSub?.unsubscribe();
    this.loadingItemOptions = false;
    this.restoreItemOptionsBaseline();
  }

  private cancelItemOptionsSearchDebounce(): void {
    if (this.itemOptionsSearchDebounce !== undefined) {
      clearTimeout(this.itemOptionsSearchDebounce);
      this.itemOptionsSearchDebounce = undefined;
    }
  }

  private restoreItemOptionsBaseline(): void {
    if (this.itemOptionsBaseline) {
      this.itemOptions = this.itemOptionsBaseline.slice();
      this.cdr.detectChanges();
      return;
    }
    this.loadItemOptions();
  }

  searchTemplates(): void {
    this.cancelTemplateSearchDebounce();
    this.resetTemplatePagination();
    this.loadTemplates();
  }

  clearTemplateSearch(): void {
    this.clearTemplateSearchBox();
  }

  onTemplateFilterChange(): void {
    this.resetTemplatePagination();
    this.loadTemplates();
  }

  setTemplateViewMode(mode: 'card' | 'list'): void {
    this.templateViewMode = mode;
  }

  goToTemplatePage(page: number): void {
    const safePage = Math.min(Math.max(Math.floor(Number(page)) || 1, 1), this.totalTemplatePages);
    this.templatePage = safePage;
  }

  goToNextTemplatePage(): void {
    if (this.canGoToNextTemplatePage) {
      this.templatePage += 1;
    }
  }

  goToPreviousTemplatePage(): void {
    if (this.canGoToPreviousTemplatePage) {
      this.templatePage -= 1;
    }
  }

  private resetTemplatePagination(): void {
    this.templatePage = 1;
  }

  private ensureTemplatePageInRange(): void {
    if (this.templatePage > this.totalTemplatePages) {
      this.templatePage = this.totalTemplatePages;
    }

    if (this.templatePage < 1) {
      this.templatePage = 1;
    }
  }

  searchItems(): void {
    this.cancelItemOptionsSearchDebounce();
    this.loadItemOptions();
  }

  resetItemSearch(): void {
    this.clearItemSearchBox();
  }

  startCreateTemplate(): void {
    this.showTemplateForm = true;
    this.isEditingTemplate = false;
    this.templateForm = {
      template_name: '',
      distribution_type: 'feeding_program',
      base_unit_count: 100,
      notes: '',
    };
    this.templateLines = [];
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();
  }

  editTemplate(summary: BatchDistributionTemplateSummary): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.batchService.getTemplate(summary.template_id).subscribe({
      next: (response) => {
        const details = response.data;
        this.showTemplateForm = true;
        this.isEditingTemplate = true;
        this.selectedTemplateId = details.template.template_id;
        this.selectedTemplateName = details.template.template_name;

        this.templateForm = {
          template_name: details.template.template_name,
          distribution_type: details.template.distribution_type,
          base_unit_count: details.template.base_unit_count,
          notes: details.template.notes ?? '',
        };

        this.templateLines = details.items.map((item) => ({
          item_id: item.item_id,
          quantity_per_base: item.quantity_per_base,
          notes: '',
          current_stock: item.current_stock,
        }));

        this.targetUnitCount = details.template.base_unit_count;
        this.lineDraftItemId = null;
        this.lineDraftQuantityPerBase = 1;
        this.lineDraftNotes = '';

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to load template details.';
        this.cdr.detectChanges();
      },
    });
  }

  cancelTemplateForm(): void {
    this.showTemplateForm = false;
    this.isEditingTemplate = false;
    this.templateLines = [];
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.cdr.detectChanges();
  }

  bounceModal(selector: string): void {
    const el = document.querySelector<HTMLElement>(`.${selector}`);
    if (!el) return;
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.05)' },
        { transform: 'scale(0.97)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' },
      ],
      { duration: 400, easing: 'ease' },
    );
  }

  addLine(): void {
    if (!this.lineDraftItemId) {
      this.errorMessage = 'Select an item to add.';
      return;
    }

    const normalizedQty = Number(this.lineDraftQuantityPerBase);
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      this.errorMessage = 'Quantity per base must be greater than zero.';
      return;
    }

    const existing = this.templateLines.find((line) => line.item_id === this.lineDraftItemId);
    const selectedOption = this.itemOptions.find((item) => item.item_id === this.lineDraftItemId);
    if (existing) {
      existing.quantity_per_base = normalizedQty;
      existing.notes = this.lineDraftNotes.trim();
      if (Number.isFinite(Number(selectedOption?.current_stock))) {
        existing.current_stock = Number(selectedOption?.current_stock);
      }
    } else {
      this.templateLines.push({
        item_id: this.lineDraftItemId,
        quantity_per_base: normalizedQty,
        notes: this.lineDraftNotes.trim(),
        current_stock: Number(selectedOption?.current_stock ?? 0),
      });
    }

    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.searchItem = '';
    this.itemComboboxOpen = false;
    this.activeItemOptionIndex = -1;
    this.loadItemOptions();
    this.errorMessage = '';
  }

  openItemCombobox(): void {
    this.itemComboboxOpen = true;
    this.activeItemOptionIndex = this.itemOptions.length > 0 ? 0 : -1;
  }

  onItemComboboxInput(): void {
    this.lineDraftItemId = null;
    this.itemComboboxOpen = true;
    this.onItemOptionsSearchInput();
  }

  onItemComboboxKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!this.itemComboboxOpen && (key === 'ArrowDown' || key === 'Enter')) {
      event.preventDefault();
      this.openItemCombobox();
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      this.itemComboboxOpen = false;
      this.activeItemOptionIndex = -1;
      return;
    }

    if (!this.itemOptions.length) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      this.activeItemOptionIndex = Math.min(
        this.activeItemOptionIndex + 1,
        this.itemOptions.length - 1,
      );
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      this.activeItemOptionIndex = Math.max(this.activeItemOptionIndex - 1, 0);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      if (this.activeItemOptionIndex >= 0) {
        this.selectItemOption(this.itemOptions[this.activeItemOptionIndex]);
      }
    }
  }

  onItemOptionHover(index: number): void {
    this.activeItemOptionIndex = index;
  }

  selectItemOption(item: BatchDistributionItemOption): void {
    this.lineDraftItemId = item.item_id;
    this.searchItem = `${item.item_code} - ${item.item_description} (Stock: ${item.current_stock})`;
    this.itemComboboxOpen = false;
    this.activeItemOptionIndex = -1;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.itemComboboxOpen) {
      return;
    }

    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    if (!target.closest('.template-item-combobox')) {
      this.itemComboboxOpen = false;
      this.activeItemOptionIndex = -1;
    }
  }

  removeLine(itemId: number): void {
    this.templateLines = this.templateLines.filter((line) => line.item_id !== itemId);
  }

  getItemLabel(itemId: number): string {
    const found = this.itemOptions.find((item) => item.item_id === itemId);
    if (!found) {
      return `Item #${itemId}`;
    }

    return `${found.item_code} - ${found.item_description}`;
  }

  getItemCurrentStock(itemId: number): number | string {
    const line = this.templateLines.find((entry) => entry.item_id === itemId);
    if (line && Number.isFinite(Number(line.current_stock))) {
      return Number(line.current_stock);
    }

    const found = this.itemOptions.find((item) => item.item_id === itemId);
    if (found && Number.isFinite(Number(found.current_stock))) {
      return Number(found.current_stock);
    }

    return '-';
  }

  saveTemplate(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.templateForm.template_name.trim()) {
      this.errorMessage = 'Template name is required.';
      return;
    }

    if (
      !Number.isFinite(Number(this.templateForm.base_unit_count)) ||
      Number(this.templateForm.base_unit_count) <= 0
    ) {
      this.errorMessage = 'Standard batch size must be greater than zero.';
      return;
    }

    if (this.templateLines.length === 0) {
      this.errorMessage = 'Add at least one item to the template.';
      return;
    }

    const payload: BatchDistributionTemplatePayload = {
      template_name: this.templateForm.template_name.trim(),
      distribution_type: this.templateForm.distribution_type,
      base_unit_count: Math.floor(Number(this.templateForm.base_unit_count)),
      notes: this.templateForm.notes.trim(),
      items: this.templateLines.map((line) => ({
        item_id: line.item_id,
        quantity_per_base: Number(line.quantity_per_base),
        notes: line.notes.trim() || null,
      })),
    };

    this.savingTemplate = true;

    const request$ =
      this.isEditingTemplate && this.selectedTemplateId
        ? this.batchService.updateTemplate(this.selectedTemplateId, payload)
        : this.batchService.createTemplate(payload);

    request$.subscribe({
      next: (response) => {
        this.savingTemplate = false;
        this.showTemplateForm = false;
        this.isEditingTemplate = false;

        const template = response.data.template;
        this.selectedTemplateId = template.template_id;
        this.selectedTemplateName = template.template_name;
        this.targetUnitCount = template.base_unit_count;

        this.templateForm = {
          template_name: template.template_name,
          distribution_type: template.distribution_type,
          base_unit_count: template.base_unit_count,
          notes: template.notes ?? '',
        };

        this.templateLines = response.data.items.map((item) => ({
          item_id: item.item_id,
          quantity_per_base: item.quantity_per_base,
          notes: '',
        }));

        this.successMessage = 'Template saved successfully.';
        this.loadTemplates();
        this.calculate();
      },
      error: (err) => {
        this.savingTemplate = false;
        this.errorMessage = err?.error?.message || 'Failed to save template.';
        this.cdr.detectChanges();
      },
    });
  }

  selectTemplate(summary: BatchDistributionTemplateSummary): void {
    this.selectedTemplateId = summary.template_id;
    this.selectedTemplateName = summary.template_name;
    this.targetUnitCount = summary.base_unit_count;
    this.calculation = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();
    this.calculate();
  }

  calculate(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.selectedTemplateId) {
      this.errorMessage = 'Select a template first.';
      return;
    }

    const normalizedTarget = Math.floor(Number(this.targetUnitCount));
    if (!Number.isFinite(normalizedTarget) || normalizedTarget <= 0) {
      this.errorMessage = 'Target count must be greater than zero.';
      return;
    }

    this.calculating = true;
    this.batchService.calculate(this.selectedTemplateId, normalizedTarget).subscribe({
      next: (response) => {
        this.calculation = response.data;
        this.calculating = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.calculating = false;
        this.errorMessage = err?.error?.message || 'Failed to calculate distribution.';
        this.cdr.detectChanges();
      },
    });
  }

  issueDistribution(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.selectedTemplateId) {
      this.errorMessage = 'Select a template first.';
      return;
    }

    if (!this.calculation) {
      this.errorMessage = 'Calculate distribution before issuing.';
      return;
    }

    if (this.hasTotalShortage) {
      this.errorMessage = 'Cannot issue because one or more items have shortages.';
      return;
    }

    if (!this.destination.trim()) {
      this.errorMessage = 'Destination is required for issuing.';
      return;
    }

    this.issuing = true;
    const normalizedTarget = Math.floor(Number(this.targetUnitCount));

    this.batchService
      .issue(
        this.selectedTemplateId,
        normalizedTarget,
        this.destination.trim(),
        this.reason.trim() || 'Batch Distribution',
        this.issueNotes.trim() || undefined,
      )
      .subscribe({
        next: () => {
          this.issuing = false;
          this.showToast('success', 'Distribution recorded successfully');
          this.destination = '';
          this.issueNotes = '';
          this.reason = 'Batch Distribution';
          this.calculation = null;
          this.loadItemOptions();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.issuing = false;
          this.showToast('error', err?.error?.message || 'Failed to issue batch distribution.');
          this.cdr.detectChanges();
        },
      });
  }
}
