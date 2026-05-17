import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import {
  BatchDistributionCalculation,
  BatchDistributionItemOption,
  BatchDistributionService,
  BatchDistributionTemplateDetails,
  BatchDistributionTemplatePayload,
  BatchDistributionTemplateSummary,
  DistributionType,
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

interface EditableTemplateLine {
  item_id: number;
  quantity_per_base: number;
  notes: string;
  current_stock?: number;
}

interface EditableRemainingLine {
  item_id: number;
  item_code: string;
  item_description: string;
  remaining_quantity: number;
  notes: string;
}

interface EditableProcuredLine {
  item_id: number;
  item_code: string;
  item_description: string;
  shortage_quantity: number;
  quantity_brought: number;
  notes: string;
}

@Component({
  selector: 'app-batch-distribution',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './batch-distribution.component.html',
  styleUrls: ['./batch-distribution.component.scss'],
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: '0', opacity: '0', overflow: 'hidden' }),
        animate('200ms ease-out', style({ height: '*', opacity: '1' }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: '1', overflow: 'hidden' }),
        animate('200ms ease-in', style({ height: '0', opacity: '0' }))
      ])
    ])
  ]
})
export class BatchDistributionComponent implements OnInit {
  activeTab: 'distribution' | 'scheduled' = 'distribution';
  loadingTemplates = false;
  loadingItemOptions = false;
  savingTemplate = false;
  calculating = false;
  issuing = false;
  loadingPlans = false;
  savingPlan = false;
  loadingPlanDetails = false;
  runningPlanAction = false;
  calculatorOpen = false;

  templates: BatchDistributionTemplateSummary[] = [];
  itemOptions: BatchDistributionItemOption[] = [];
  plans: ProgramPlanSummary[] = [];

  selectedTemplateId: number | null = null;
  selectedTemplateName = '';
  openTemplateMenuId: number | null = null;

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
  selectedPlanId: number | null = null;
  selectedPlanDetails: ProgramPlanDetailsResponse | null = null;

  planForm: {
    template_id: number | null;
    week_label: string;
    planned_date: string;
    target_unit_count: number;
    notes: string;
  } = {
    template_id: null,
    week_label: '',
    planned_date: '',
    target_unit_count: 100,
    notes: '',
  };

  planIssueDestination = '';
  planIssueReason = 'For Week 3';
  planIssueNotes = '';
  planRemainingLines: EditableRemainingLine[] = [];
  planProcuredLines: EditableProcuredLine[] = [];
  planIssueSummary: ProgramPlanDetailsResponse['issuance'] | null = null;
  planWizardStep: 1 | 2 | 3 = 1;
  showSaveConfirmDialog = false;
  pendingSavedTemplate: BatchDistributionTemplateSummary | null = null;
  showScheduleDialog = false;
  planStatusFilter: 'all' | ProgramPlanStatus = 'all';
  planSortDirection: 'desc' | 'asc' = 'desc';
  planDialogMode: 'create' | 'edit' = 'create';
  editingPlanId: number | null = null;
  openPlanMenuId: number | null = null;
  executingPlanId: number | null = null;
  expandedPlanId: number | null = null;
  planViewMode: 'list' | 'calendar' = 'list';
  calendarCurrentDate: Date = new Date();
  calendarDays: Array<{
    date: Date;
    isCurrentMonth: boolean;
    plans: ProgramPlanSummary[];
  }> = [];
  planStockReadiness: Map<number, { required: number; available: number; percentage: number; status: string; loading: boolean }> = new Map();
  planSearchTerm = '';
  planConfirmDialog: {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    action: 'cancel' | 'delete' | 'execute' | null;
    plan: ProgramPlanSummary | null;
  } = {
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    action: null,
    plan: null,
  };

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
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.loadItemOptions();
    this.loadPlans();
    this.buildCalendar();
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

  get planWizardTitle(): string {
    switch (this.planWizardStep) {
      case 1:
        return 'Review Shortages';
      case 2:
        return 'Receive Missing Items';
      case 3:
        return 'Execute Distribution';
      default:
        return 'Review Shortages';
    }
  }

  get filteredPlans(): ProgramPlanSummary[] {
    let filtered = this.plans;
    
    // Apply status filter
    if (this.planStatusFilter !== 'all') {
      filtered = filtered.filter((plan) => plan.status === this.planStatusFilter);
    }

    // Apply search filter
    if (this.planSearchTerm.trim()) {
      const searchLower = this.planSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((plan) => 
        plan.week_label.toLowerCase().includes(searchLower) ||
        plan.template_name.toLowerCase().includes(searchLower)
      );
    }

    return filtered.slice().sort((a, b) => {
      const aDate = new Date(a.planned_date).getTime();
      const bDate = new Date(b.planned_date).getTime();
      return this.planSortDirection === 'desc' ? bDate - aDate : aDate - bDate;
    });
  }

  get calendarMonthName(): string {
    return this.calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get calendarWeekDays(): string[] {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  get isPlanDialogEditing(): boolean {
    return this.planDialogMode === 'edit';
  }

  isPlanExecutable(plan: ProgramPlanSummary): boolean {
    if (plan.status !== 'planned') {
      return false;
    }

    const planDate = this.normalizeDate(plan.planned_date);
    const today = this.normalizeDate(new Date().toISOString().slice(0, 10));
    return planDate <= today;
  }

  private clearToastTimeout(): void {
    if (this.toastTimeout !== undefined) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = undefined;
    }
  }

  showToast(type: 'success' | 'error', message: string): void {
    this.toast.show(type, message);
  }

  toggleCalculator(): void {
    this.calculatorOpen = !this.calculatorOpen;
  }

  openCalculator(): void {
    this.calculatorOpen = true;
  }

  closeCalculator(): void {
    this.calculatorOpen = false;
  }

  toggleTemplateMenu(templateId: number, event: Event): void {
    event.stopPropagation();
    this.openTemplateMenuId = this.openTemplateMenuId === templateId ? null : templateId;
  }

  closeTemplateMenu(): void {
    this.openTemplateMenuId = null;
  }

  runTemplateMenuAction(
    action: 'calculate' | 'edit' | 'delete',
    template: BatchDistributionTemplateSummary,
  ): void {
    this.closeTemplateMenu();
    if (action === 'calculate') {
      this.selectTemplate(template);
      this.openCalculator();
      return;
    }

    if (action === 'edit') {
      this.editTemplate(template);
      return;
    }

    if (action === 'delete') {
      this.deleteTemplate(template);
    }
  }

  setTab(tab: 'distribution' | 'scheduled'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab !== 'distribution') {
      this.calculatorOpen = false;
    }
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
          this.toast.error(err?.error?.message || 'Failed to load templates.');
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
          this.toast.error(err?.error?.message || 'Failed to load item options.');
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
    this.closeTemplateMenu();
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
        this.toast.error(err?.error?.message || 'Failed to load template details.');
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
      this.toast.error('Select an item to add.');
      return;
    }

    const normalizedQty = Number(this.lineDraftQuantityPerBase);
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      this.toast.error('Quantity per base must be greater than zero.');
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
    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    if (this.openTemplateMenuId && !target.closest('.template-menu')) {
      this.openTemplateMenuId = null;
    }

    if (this.openPlanMenuId && !target.closest('.plan-menu')) {
      this.openPlanMenuId = null;
    }

    if (!this.itemComboboxOpen) {
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
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    if (this.templateForm.template_name.length > 100) {
      this.toast.error('Template name must be 100 characters or less.');
      return;
    }

    if (
      !Number.isFinite(Number(this.templateForm.base_unit_count)) ||
      Number(this.templateForm.base_unit_count) <= 0
    ) {
      this.toast.error('Standard batch size must be greater than zero.');
      return;
    }

    if (this.templateForm.notes && this.templateForm.notes.length > 500) {
      this.toast.error('Notes must be 500 characters or less.');
      return;
    }

    if (this.templateLines.length === 0) {
      this.toast.error('Add at least one item to the template.');
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

        this.toast.success('Template saved successfully.');
        this.loadTemplates();
        this.pendingSavedTemplate = this.buildTemplateSummary(response.data);
        this.showSaveConfirmDialog = true;
      },
      error: (err) => {
        this.savingTemplate = false;
        this.toast.error(err?.error?.message || 'Failed to save template.');
        this.cdr.detectChanges();
      },
    });
  }

  handleSaveConfirmation(shouldCalculate: boolean): void {
    this.showSaveConfirmDialog = false;
    this.showTemplateForm = false;
    this.isEditingTemplate = false;

    const template = this.pendingSavedTemplate;
    this.pendingSavedTemplate = null;
    if (!template) {
      return;
    }

    if (shouldCalculate) {
      this.openCalculator();
      this.selectTemplate(template);
    }
  }

  selectTemplate(summary: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
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
      this.toast.error('Select a template first.');
      return;
    }

    const normalizedTarget = Math.floor(Number(this.targetUnitCount));
    if (!Number.isFinite(normalizedTarget) || normalizedTarget <= 0) {
      this.toast.error('Target count must be greater than zero.');
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
        this.toast.error(err?.error?.message || 'Failed to calculate distribution.');
        this.cdr.detectChanges();
      },
    });
  }

  issueDistribution(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.selectedTemplateId) {
      this.toast.error('Select a template first.');
      return;
    }

    if (!this.calculation) {
      this.toast.error('Calculate distribution before issuing.');
      return;
    }

    if (this.hasTotalShortage) {
      this.toast.error('Cannot issue because one or more items have shortages.');
      return;
    }

    if (!this.destination.trim()) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    if (this.destination.length > 150) {
      this.toast.error('Destination must be 150 characters or less.');
      return;
    }

    if (this.reason && this.reason.length > 250) {
      this.toast.error('Reason must be 250 characters or less.');
      return;
    }

    if (this.issueNotes && this.issueNotes.length > 500) {
      this.toast.error('Notes must be 500 characters or less.');
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

  loadPlans(): void {
    this.loadingPlans = true;
    
    let params: { status?: ProgramPlanStatus; from_date?: string; to_date?: string } = {};
    
    // If calendar view, load only the current month
    if (this.planViewMode === 'calendar') {
      const firstDay = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth(), 1);
      const lastDay = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth() + 1, 0);
      
      params.from_date = this.formatDateForApi(firstDay);
      params.to_date = this.formatDateForApi(lastDay);
    }
    
    this.batchService.listProgramPlans(params).subscribe({
      next: (response) => {
        this.plans = response.data;
        this.loadingPlans = false;
        if (this.selectedPlanId) {
          const exists = this.plans.some((p) => p.plan_id === this.selectedPlanId);
          if (!exists) {
            this.selectedPlanId = null;
            this.selectedPlanDetails = null;
            this.planIssueSummary = null;
            this.planProcuredLines = [];
          }
        }
        this.buildCalendar();
        // Load stock readiness for all planned plans
        this.loadStockReadinessForPlans();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingPlans = false;
        this.toast.error(err?.error?.message || 'Failed to load scheduled plans.');
        this.cdr.detectChanges();
      },
    });
  }

  createPlan(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.planForm.template_id) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    if (!this.planForm.week_label.trim()) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    if (!this.planForm.planned_date) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    const targetCount = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
      this.toast.error('Target count must be greater than zero.');
      return;
    }

    this.savingPlan = true;
    this.batchService
      .createProgramPlan({
        template_id: this.planForm.template_id,
        week_label: this.planForm.week_label.trim(),
        planned_date: this.planForm.planned_date,
        target_unit_count: targetCount,
        notes: this.planForm.notes.trim() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.savingPlan = false;
          this.toast.success(response.message || 'Distribution Plan created successfully.');
          this.selectedPlanId = response.data.plan.plan_id;
          this.selectedPlanDetails = response.data;
          this.planIssueSummary = response.data.issuance ?? null;
          this.seedRemainingLinesFromCurrentDetails();
          this.seedProcuredLinesFromCurrentDetails();
          this.syncPlanWizardStep(response.data.plan.status);
          this.closeScheduleDialog();
          this.loadPlans();
        },
        error: (err) => {
          this.savingPlan = false;
          this.toast.error(err?.error?.message || 'Failed to create program plan.');
          this.cdr.detectChanges();
        },
      });
  }

  openScheduleDialog(): void {
    this.showScheduleDialog = true;
    this.planDialogMode = 'create';
    this.editingPlanId = null;
    this.resetPlanForm();
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog = false;
    this.savingPlan = false;
    this.planDialogMode = 'create';
    this.editingPlanId = null;
    this.resetPlanForm();
  }

  submitPlanDialog(): void {
    if (this.isPlanDialogEditing) {
      this.updatePlanLocal();
      return;
    }

    this.createPlan();
  }

  togglePlanSortDirection(): void {
    this.planSortDirection = this.planSortDirection === 'desc' ? 'asc' : 'desc';
  }

  togglePlanMenu(planId: number, event: Event): void {
    event.stopPropagation();
    this.openPlanMenuId = this.openPlanMenuId === planId ? null : planId;
  }

  closePlanMenu(): void {
    this.openPlanMenuId = null;
  }

  openEditPlan(plan: ProgramPlanSummary): void {
    if (this.isPlanLocked(plan)) {
      return;
    }
    this.planDialogMode = 'edit';
    this.editingPlanId = plan.plan_id;
    this.planForm = {
      template_id: plan.template_id,
      week_label: plan.week_label,
      planned_date: plan.planned_date,
      target_unit_count: plan.target_unit_count,
      notes: plan.notes ?? '',
    };
    this.showScheduleDialog = true;
  }

  openPlanConfirm(action: 'cancel' | 'delete' | 'execute', plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    if (action === 'cancel') {
      this.planConfirmDialog = {
        open: true,
        title: 'Cancel this plan?',
        message: 'This will mark the plan as cancelled. This action cannot be undone.',
        confirmText: 'Yes, cancel plan',
        cancelText: 'No',
        action,
        plan,
      };
      return;
    }

    if (action === 'delete') {
      this.planConfirmDialog = {
        open: true,
        title: 'Delete this plan?',
        message: 'This will permanently remove the record. This cannot be undone.',
        confirmText: 'Yes, delete',
        cancelText: 'No',
        action,
        plan,
      };
      return;
    }

    this.planConfirmDialog = {
      open: true,
      title: 'Mark this plan as completed?',
      message: 'This will log the distribution and update stock levels. This cannot be undone.',
      confirmText: 'Yes, complete plan',
      cancelText: 'No',
      action,
      plan,
    };
  }

  closePlanConfirm(): void {
    this.planConfirmDialog = {
      open: false,
      title: '',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      action: null,
      plan: null,
    };
  }

  confirmPlanAction(): void {
    const action = this.planConfirmDialog.action;
    const plan = this.planConfirmDialog.plan;
    if (!action || !plan) {
      this.closePlanConfirm();
      return;
    }

    if (action === 'delete') {
      this.removePlanLocal(plan.plan_id);
      this.toast.success('Plan deleted.');
      this.closePlanConfirm();
      return;
    }

    if (action === 'cancel') {
      this.cancelPlan(plan);
      this.closePlanConfirm();
      return;
    }

    this.executePlan(plan);
    this.closePlanConfirm();
  }

  selectPlan(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    
    // Toggle expansion
    if (this.expandedPlanId === plan.plan_id) {
      this.expandedPlanId = null;
      this.selectedPlanId = null;
      this.selectedPlanDetails = null;
      this.planIssueSummary = null;
      this.planProcuredLines = [];
      this.planRemainingLines = [];
      return;
    }
    
    // Expand new row and collapse previous
    this.expandedPlanId = plan.plan_id;
    this.selectedPlanId = plan.plan_id;
    this.loadPlanDetails(plan.plan_id);
  }

  togglePlanExpansion(plan: ProgramPlanSummary, event: Event): void {
    event.stopPropagation();
    this.selectPlan(plan);
  }

  isPlanExpanded(planId: number): boolean {
    return this.expandedPlanId === planId;
  }

  loadPlanDetails(planId: number): void {
    this.loadingPlanDetails = true;
    this.batchService.getProgramPlan(planId).subscribe({
      next: (response) => {
        this.loadingPlanDetails = false;
        this.selectedPlanDetails = response.data;
        this.planIssueSummary = response.data.issuance ?? null;
        this.seedRemainingLinesFromCurrentDetails();
        this.seedProcuredLinesFromCurrentDetails();
        this.syncPlanWizardStep(response.data.plan.status);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingPlanDetails = false;
        this.toast.error(err?.error?.message || 'Failed to load selected plan details.');
        this.cdr.detectChanges();
      },
    });
  }

  handlePlanStepOneNext(): void {
    if (!this.selectedPlanId || this.runningPlanAction) {
      return;
    }

    this.runPlanPrecheck(true);
  }

  handlePlanStepTwoNext(): void {
    if (!this.selectedPlanId || this.runningPlanAction) {
      return;
    }

    this.runPlanFinalCheck(true);
  }

  goToPlanStep(step: 1 | 2 | 3): void {
    if (step >= this.planWizardStep) {
      return;
    }

    this.planWizardStep = step;
  }

  runPlanPrecheck(advanceStep = false): void {
    if (!this.selectedPlanId) {
      return;
    }
    this.runningPlanAction = true;
    this.batchService.runProgramPrecheck(this.selectedPlanId).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.toast.success(response.message || 'Precheck completed.');
        this.loadPlanDetails(this.selectedPlanId!);
        this.loadPlans();
        if (advanceStep) {
          this.planWizardStep = 2;
        }
      },
      error: (err) => {
        this.runningPlanAction = false;
        this.toast.error(err?.error?.message || 'Failed to run precheck.');
        this.cdr.detectChanges();
      },
    });
  }

  runPlanFinalCheck(advanceStep = false): void {
    if (!this.selectedPlanId) {
      return;
    }

    if (!this.planIssueDestination.trim()) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    const procured_items = this.planProcuredLines
      .filter((line) => Number.isFinite(line.quantity_brought) && line.quantity_brought > 0)
      .map((line) => ({
        item_id: line.item_id,
        quantity_brought: Math.floor(Number(line.quantity_brought)),
        notes: line.notes.trim() || undefined,
      }));

    this.runningPlanAction = true;
    this.batchService.runProgramFinalCheck(this.selectedPlanId, {
      procured_items,
      issue_destination: this.planIssueDestination.trim(),
      issue_reason: this.planIssueReason.trim() || undefined,
      issue_notes: this.planIssueNotes.trim() || undefined,
    }).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.toast.success(response.message || 'Final check completed with receiving and issuance.');
        this.loadPlanDetails(this.selectedPlanId!);
        this.loadPlans();
        if (advanceStep) {
          this.planWizardStep = 3;
        }
      },
      error: (err) => {
        this.runningPlanAction = false;
        this.toast.error(err?.error?.message || 'Failed to run final check.');
        this.cdr.detectChanges();
      },
    });
  }

  completePlan(): void {
    if (!this.selectedPlanId) {
      return;
    }

    const remaining_items = this.planRemainingLines
      .filter((line) => Number.isFinite(line.remaining_quantity) && line.remaining_quantity >= 0)
      .map((line) => ({
        item_id: line.item_id,
        remaining_quantity: Number(line.remaining_quantity),
        notes: line.notes.trim() || undefined,
      }));

    this.runningPlanAction = true;
    this.batchService
      .completeProgramPlan(this.selectedPlanId, {
        status: 'completed',
        remaining_items,
      })
      .subscribe({
        next: (response) => {
          this.runningPlanAction = false;
          this.selectedPlanDetails = response.data;
          this.planIssueSummary = response.data.issuance ?? this.planIssueSummary;
          this.toast.success(response.message || 'Remainder stored back to inventory successfully.');
          this.loadPlans();
          this.seedRemainingLinesFromCurrentDetails();
          this.seedProcuredLinesFromCurrentDetails();
          this.planWizardStep = 3;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.runningPlanAction = false;
          this.toast.error(err?.error?.message || 'Failed to complete plan.');
          this.cdr.detectChanges();
        },
      });
  }

  executePlan(plan: ProgramPlanSummary): void {
    if (this.executingPlanId) {
      return;
    }
    this.executingPlanId = plan.plan_id;
    this.batchService
      .completeProgramPlan(plan.plan_id, {
        status: 'completed',
      })
      .subscribe({
        next: (response) => {
          this.executingPlanId = null;
          this.toast.success(response.message || 'Plan completed successfully.');
          this.applyPlanUpdate(response.data.plan);
          if (this.selectedPlanId === plan.plan_id) {
            this.selectedPlanDetails = response.data;
            this.planIssueSummary = response.data.issuance ?? this.planIssueSummary;
            this.seedRemainingLinesFromCurrentDetails();
            this.seedProcuredLinesFromCurrentDetails();
            this.syncPlanWizardStep(response.data.plan.status);
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.executingPlanId = null;
          this.toast.error(err?.error?.message || 'Failed to complete plan.');
          this.cdr.detectChanges();
        },
      });
  }

  cancelPlan(plan: ProgramPlanSummary): void {
    if (this.executingPlanId) {
      return;
    }
    this.executingPlanId = plan.plan_id;
    this.batchService
      .completeProgramPlan(plan.plan_id, {
        status: 'cancelled',
      })
      .subscribe({
        next: (response) => {
          this.executingPlanId = null;
          this.toast.success(response.message || 'Plan cancelled successfully.');
          this.applyPlanUpdate(response.data.plan);
          if (this.selectedPlanId === plan.plan_id) {
            this.selectedPlanDetails = response.data;
            this.planIssueSummary = response.data.issuance ?? this.planIssueSummary;
            this.seedRemainingLinesFromCurrentDetails();
            this.seedProcuredLinesFromCurrentDetails();
            this.syncPlanWizardStep(response.data.plan.status);
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.executingPlanId = null;
          this.toast.error(err?.error?.message || 'Failed to cancel plan.');
          this.cdr.detectChanges();
        },
      });
  }

  getPlanBadge(plan: ProgramPlanSummary): { label: string; className: string; icon: string } {
    if (this.isPlanOverdue(plan)) {
      return { label: 'Overdue', className: 'status-overdue', icon: 'ti-alert-circle' };
    }

    switch (plan.status) {
      case 'completed':
        return { label: 'Completed', className: 'status-completed', icon: 'ti-circle-check' };
      case 'cancelled':
        return { label: 'Cancelled', className: 'status-cancelled', icon: 'ti-ban' };
      default:
        return { label: 'Planned', className: 'status-planned', icon: 'ti-clock' };
    }
  }

  isPlanOverdue(plan: ProgramPlanSummary): boolean {
    if (plan.status !== 'planned') {
      return false;
    }
    const planDate = this.normalizeDate(plan.planned_date);
    const today = this.normalizeDate(new Date().toISOString().slice(0, 10));
    return planDate < today;
  }

  isPlanLocked(plan: ProgramPlanSummary): boolean {
    return plan.status === 'completed' || plan.status === 'cancelled';
  }

  getPlanStatusClass(status: ProgramPlanStatus | string): string {
    switch (status) {
      case 'planned':
        return 'tag-planned';
      case 'checked_pre':
        return 'tag-checked';
      case 'ready':
        return 'tag-ready';
      case 'completed':
        return 'tag-completed';
      case 'cancelled':
        return 'tag-cancelled';
      default:
        return '';
    }
  }

  private seedRemainingLinesFromCurrentDetails(): void {
    const details = this.selectedPlanDetails;
    if (!details) {
      this.planRemainingLines = [];
      return;
    }

    if (details.remaining_items && details.remaining_items.length > 0) {
      this.planRemainingLines = details.remaining_items.map((line) => ({
        item_id: line.item_id,
        item_code: line.item_code,
        item_description: line.item_description,
        remaining_quantity: Number(line.remaining_quantity) || 0,
        notes: line.notes || '',
      }));
      return;
    }

    this.planRemainingLines = details.inventory_check.items.map((line) => ({
      item_id: line.item_id,
      item_code: line.item_code,
      item_description: line.item_description,
      remaining_quantity: 0,
      notes: '',
    }));
  }

  private seedProcuredLinesFromCurrentDetails(): void {
    const details = this.selectedPlanDetails;
    if (!details) {
      this.planProcuredLines = [];
      return;
    }

    this.planProcuredLines = details.inventory_check.items
      .filter((line) => line.shortage_quantity > 0)
      .map((line) => ({
        item_id: line.item_id,
        item_code: line.item_code,
        item_description: line.item_description,
        shortage_quantity: Number(line.shortage_quantity) || 0,
        quantity_brought: 0,
        notes: '',
      }));
  }

  private syncPlanWizardStep(status: ProgramPlanStatus | string): void {
    switch (status) {
      case 'planned':
        this.planWizardStep = 1;
        break;
      case 'checked_pre':
        this.planWizardStep = 2;
        break;
      case 'ready':
      case 'completed':
        this.planWizardStep = 3;
        break;
      default:
        this.planWizardStep = 1;
        break;
    }
  }

  private deleteTemplate(summary: BatchDistributionTemplateSummary): void {
    const ok = confirm(`Delete template "${summary.template_name}"?`);
    if (!ok) {
      return;
    }

    this.batchService.deleteTemplate(summary.template_id).subscribe({
      next: (response: { success: boolean; message: string }) => {
        this.toast.success(response.message || 'Template deleted.');
        if (this.selectedTemplateId === summary.template_id) {
          this.selectedTemplateId = null;
          this.selectedTemplateName = '';
          this.calculation = null;
        }
        this.loadTemplates();
        this.cdr.detectChanges();
      },
      error: (err: { error?: { message?: string } }) => {
        this.toast.error(err?.error?.message || 'Failed to delete template.');
        this.cdr.detectChanges();
      },
    });
  }

  private buildTemplateSummary(
    details: BatchDistributionTemplateDetails,
  ): BatchDistributionTemplateSummary {
    return {
      template_id: details.template.template_id,
      template_name: details.template.template_name,
      distribution_type: details.template.distribution_type,
      distribution_type_label: details.template.distribution_type_label,
      base_unit_count: details.template.base_unit_count,
      notes: details.template.notes ?? null,
      is_active: details.template.is_active ?? true,
      created_at: details.template.created_at ?? '',
      updated_at: details.template.updated_at ?? '',
      item_count: details.items.length,
    };
  }

  private resetPlanForm(): void {
    this.planForm = {
      template_id: null,
      week_label: '',
      planned_date: '',
      target_unit_count: 100,
      notes: '',
    };
  }

  private updatePlanLocal(): void {
    if (!this.editingPlanId) {
      return;
    }

    this.savingPlan = true;

    if (!this.planForm.template_id) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    if (!this.planForm.week_label.trim()) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    if (!this.planForm.planned_date) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    const targetCount = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
      this.toast.error('Target count must be greater than zero.');
      return;
    }

    const template = this.templates.find((t) => t.template_id === this.planForm.template_id);
    this.plans = this.plans.map((plan) => {
      if (plan.plan_id !== this.editingPlanId) {
        return plan;
      }

      return {
        ...plan,
        template_id: this.planForm.template_id as number,
        template_name: template?.template_name ?? plan.template_name,
        distribution_type: template?.distribution_type ?? plan.distribution_type,
        base_unit_count: template?.base_unit_count ?? plan.base_unit_count,
        week_label: this.planForm.week_label.trim(),
        planned_date: this.planForm.planned_date,
        target_unit_count: targetCount,
        notes: this.planForm.notes.trim() || null,
      };
    });

    if (this.selectedPlanDetails && this.selectedPlanDetails.plan.plan_id === this.editingPlanId) {
      this.selectedPlanDetails = {
        ...this.selectedPlanDetails,
        plan: {
          ...this.selectedPlanDetails.plan,
          template_id: this.planForm.template_id as number,
          template_name: template?.template_name ?? this.selectedPlanDetails.plan.template_name,
          distribution_type: template?.distribution_type ?? this.selectedPlanDetails.plan.distribution_type,
          base_unit_count: template?.base_unit_count ?? this.selectedPlanDetails.plan.base_unit_count,
          week_label: this.planForm.week_label.trim(),
          planned_date: this.planForm.planned_date,
          target_unit_count: targetCount,
          notes: this.planForm.notes.trim() || null,
        },
      };
    }

    this.toast.success('Plan updated locally.');
    this.savingPlan = false;
    this.closeScheduleDialog();
    this.cdr.detectChanges();
  }

  private applyPlanUpdate(plan: ProgramPlanSummary): void {
    this.plans = this.plans.map((entry) =>
      entry.plan_id === plan.plan_id ? { ...entry, ...plan } : entry,
    );
  }

  private removePlanLocal(planId: number): void {
    this.plans = this.plans.filter((plan) => plan.plan_id !== planId);
    if (this.selectedPlanId === planId) {
      this.selectedPlanId = null;
      this.selectedPlanDetails = null;
      this.planIssueSummary = null;
      this.planProcuredLines = [];
    }
    this.cdr.detectChanges();
  }

  private normalizeDate(dateValue: string): number {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return 0;
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  }

  setPlanViewMode(mode: 'list' | 'calendar'): void {
    this.planViewMode = mode;
    if (mode === 'calendar') {
      this.buildCalendar();
      this.loadPlans();
    }
  }

  buildCalendar(): void {
    const year = this.calendarCurrentDate.getFullYear();
    const month = this.calendarCurrentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days: Array<{ date: Date; isCurrentMonth: boolean; plans: ProgramPlanSummary[] }> = [];
    
    // Add previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        plans: this.getPlansForDate(date),
      });
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        plans: this.getPlansForDate(date),
      });
    }
    
    // Add next month days to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        plans: this.getPlansForDate(date),
      });
    }
    
    this.calendarDays = days;
  }

  getPlansForDate(date: Date): ProgramPlanSummary[] {
    const dateStr = this.formatDateForApi(date);
    let filtered = this.plans.filter((plan) => plan.planned_date === dateStr);
    
    // Apply status filter
    if (this.planStatusFilter !== 'all') {
      filtered = filtered.filter((plan) => plan.status === this.planStatusFilter);
    }
    
    // Apply search filter
    if (this.planSearchTerm.trim()) {
      const searchLower = this.planSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((plan) => 
        plan.week_label.toLowerCase().includes(searchLower) ||
        plan.template_name.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }

  goToPreviousMonth(): void {
    this.calendarCurrentDate = new Date(
      this.calendarCurrentDate.getFullYear(),
      this.calendarCurrentDate.getMonth() - 1,
      1
    );
    this.buildCalendar();
    this.loadPlans();
  }

  goToNextMonth(): void {
    this.calendarCurrentDate = new Date(
      this.calendarCurrentDate.getFullYear(),
      this.calendarCurrentDate.getMonth() + 1,
      1
    );
    this.buildCalendar();
    this.loadPlans();
  }

  goToToday(): void {
    this.calendarCurrentDate = new Date();
    this.buildCalendar();
    this.loadPlans();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  openPlanFromCalendar(plan: ProgramPlanSummary, event: Event): void {
    event.stopPropagation();
    this.selectPlan(plan);
  }

  loadStockReadinessForPlans(): void {
    const plannedPlans = this.plans.filter(plan => plan.status === 'planned');
    
    plannedPlans.forEach(plan => {
      this.planStockReadiness.set(plan.plan_id, {
        required: 0,
        available: 0,
        percentage: 0,
        status: 'loading',
        loading: true,
      });
      
      this.batchService.getStockReadiness(plan.plan_id).subscribe({
        next: (response) => {
          this.planStockReadiness.set(plan.plan_id, {
            ...response.data,
            loading: false,
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.planStockReadiness.set(plan.plan_id, {
            required: 0,
            available: 0,
            percentage: 0,
            status: 'error',
            loading: false,
          });
          this.cdr.detectChanges();
        },
      });
    });
  }

  getStockReadiness(planId: number): { required: number; available: number; percentage: number; status: string; loading: boolean } | null {
    return this.planStockReadiness.get(planId) || null;
  }

  getStockReadinessColor(percentage: number): string {
    if (percentage >= 100) return '#10b981'; // Green
    if (percentage >= 50) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  }

  getStockReadinessBarClass(percentage: number): string {
    if (percentage >= 100) return 'stock-bar-ready';
    if (percentage >= 50) return 'stock-bar-partial';
    return 'stock-bar-insufficient';
  }
}
