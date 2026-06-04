/**
 * Template / Recipe mixin for BatchDistributionComponent.
 *
 * Contains all state and methods related to creating, editing, duplicating,
 * deleting and calculating batch-distribution templates (recipes).
 *
 * Usage: extend BatchDistributionComponent from this class.
 */
import { ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  BatchDistributionCalculation,
  BatchDistributionItemOption,
  BatchDistributionService,
  BatchDistributionTemplateDetails,
  BatchDistributionTemplatePayload,
  BatchDistributionTemplateSummary,
  DistributionType,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { RecipeTypeOption, RecipeTypeService } from '../../../services/recipe-type.service';
import { InventoryItemService } from '../../../services/inventory-item.service';
import { EditableTemplateLine, TemplateConfirmDialog } from './batch-distribution-types';
import { ModalUtils } from '../../../shared/utils/modal.utils';

export abstract class BatchDistributionTemplateMixin {
  // ── injected dependencies (provided by concrete component) ──────────────
  protected abstract batchService: BatchDistributionService;
  protected abstract cdr: ChangeDetectorRef;
  protected abstract toast: ToastService;
  protected abstract recipeTypeService: RecipeTypeService;
  protected abstract itemService: InventoryItemService;

  // ── template list state ──────────────────────────────────────────────────
  loadingTemplates = false;
  loadingItemOptions = false;
  savingTemplate = false;
  calculating = false;
  issuing = false;

  templates: BatchDistributionTemplateSummary[] = [];
  itemOptions: BatchDistributionItemOption[] = [];

  selectedTemplateId: number | null = null;
  selectedTemplateName = '';
  openTemplateMenuId: number | null = null;

  searchTemplate = '';
  templateRecipeTypeFilter: 'all' | number = 'all';
  templateViewMode: 'card' | 'list' = 'card';
  templatePage = 1;
  readonly templatePageSize = 10;
  searchItem = '';

  showTemplateForm = false;
  isEditingTemplate = false;
  calculatorOpen = false;

  templateForm: {
    template_name: string;
    distribution_type: DistributionType;
    base_unit_count: number;
    notes: string;
    recipe_type_id: number | null;
  } = {
    template_name: '',
    distribution_type: 'feeding_program',
    base_unit_count: 100,
    notes: '',
    recipe_type_id: null,
  };

  recipeTypeOptions: RecipeTypeOption[] = [];
  locationOptions: Array<{ location_id: number; location_name: string; location_code: string }> = [];

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

  templateModalMode: 'create' | 'edit' | 'duplicate' = 'create';
  duplicateSourceTemplateName: string | null = null;
  loadingRecipeModal = false;
  showNewRecipeModal = false;
  showIngredientModal = false;
  selectedTemplateForDetails: BatchDistributionTemplateSummary | null = null;
  selectedTemplateDetails: BatchDistributionTemplateDetails | null = null;

  templateConfirmDialog: TemplateConfirmDialog = {
    open: false, title: '', message: '',
    confirmText: 'Delete', cancelText: 'Cancel',
    action: null, template: null,
  };

  readonly recipeLazyBatchSize = 10;
  visibleRecipeCount = 10;
  loadingMoreRecipes = false;

  protected readonly TEMPLATE_SEARCH_DEBOUNCE_MS = 300;
  protected loadTemplatesSub?: Subscription;
  protected templateSearchDebounce?: ReturnType<typeof setTimeout>;
  protected templatesBaseline: BatchDistributionTemplateSummary[] | null = null;
  protected loadItemOptionsSub?: Subscription;
  protected itemOptionsSearchDebounce?: ReturnType<typeof setTimeout>;
  protected itemOptionsBaseline: BatchDistributionItemOption[] | null = null;

  // ── computed getters ─────────────────────────────────────────────────────

  get selectedDistributionType(): DistributionType {
    if (this.calculation?.template?.distribution_type) {
      return this.calculation.template.distribution_type;
    }
    if (this.selectedTemplateId) {
      const t = this.templates.find((t) => t.template_id === this.selectedTemplateId);
      if (t) return t.distribution_type;
    }
    return this.templateForm.distribution_type;
  }

  get targetCountLabel(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Number of Relief Packs' : 'Target Attendees';
  }

  get perUnitLabel(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Qty' : 'Qty';
  }

  get targetUnitNounPlural(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Packs' : 'Attendees';
  }

  get recipeModalTitle(): string {
    switch (this.templateModalMode) {
      case 'edit': return 'Edit Recipe';
      case 'duplicate': return 'Duplicate Recipe';
      default: return 'Create New Recipe';
    }
  }

  get recipeModalSaveLabel(): string {
    if (this.savingTemplate) return 'Saving...';
    const warn = this.templateHasStockWarning ? ' With Warning' : '';
    switch (this.templateModalMode) {
      case 'edit': return `Update Recipe${warn}`;
      case 'duplicate': return `Save Duplicate${warn}`;
      default: return `Create Recipe${warn}`;
    }
  }

  get templateStockWarningCount(): number {
    return this.templateLines.filter((line) => this.templateLineExceedsStock(line)).length;
  }

  get templateHasStockWarning(): boolean {
    return this.templateStockWarningCount > 0;
  }

  get normalizedTargetUnitCount(): number {
    const v = Math.floor(Number(this.targetUnitCount));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  get normalizedBaseUnitCount(): number {
    const fromCalc = Number(this.calculation?.template?.base_unit_count ?? 0);
    if (Number.isFinite(fromCalc) && fromCalc > 0) return Math.floor(fromCalc);
    if (this.selectedTemplateId) {
      const t = this.templates.find((t) => t.template_id === this.selectedTemplateId);
      if (t && Number.isFinite(t.base_unit_count) && t.base_unit_count > 0) return Math.floor(t.base_unit_count);
    }
    const fromForm = Number(this.templateForm.base_unit_count);
    return Number.isFinite(fromForm) && fromForm > 0 ? Math.floor(fromForm) : 1;
  }

  get calculatedMultiplier(): number {
    const base = this.normalizedBaseUnitCount;
    return base <= 0 ? 0 : this.normalizedTargetUnitCount / base;
  }

  get totalTemplatePages(): number {
    return Math.max(1, Math.ceil(this.templates.length / this.templatePageSize));
  }

  get visibleRecipes(): BatchDistributionTemplateSummary[] {
    return this.templates.slice(0, this.visibleRecipeCount);
  }

  get hasMoreRecipes(): boolean {
    return this.visibleRecipeCount < this.templates.length;
  }

  get paginatedTemplates(): BatchDistributionTemplateSummary[] {
    const start = (this.templatePage - 1) * this.templatePageSize;
    return this.templates.slice(start, start + this.templatePageSize);
  }

  get canGoToPreviousTemplatePage(): boolean { return this.templatePage > 1; }
  get canGoToNextTemplatePage(): boolean { return this.templatePage < this.totalTemplatePages; }

  // ── calculation helpers ──────────────────────────────────────────────────

  calculateRequiredQuantity(amountPerServingOrPack: number): number {
    const perUnit = Number(amountPerServingOrPack);
    if (!Number.isFinite(perUnit) || perUnit <= 0) return 0;
    return perUnit * this.calculatedMultiplier;
  }

  getRowRequiredQuantity(row: { quantity_per_base: number; required_quantity_for_issuance?: number }): number {
    if (Number.isFinite(Number(row.required_quantity_for_issuance))) return Number(row.required_quantity_for_issuance);
    return this.calculateRequiredQuantity(row.quantity_per_base);
  }

  getRowShortageQuantity(row: { quantity_per_base: number; current_stock: number; shortage_quantity?: number }): number {
    if (Number.isFinite(Number(row.shortage_quantity))) return Number(row.shortage_quantity);
    return Math.max(0, this.getRowRequiredQuantity(row) - Number(row.current_stock || 0));
  }

  rowHasShortage(row: { quantity_per_base: number; current_stock: number }): boolean {
    return this.getRowShortageQuantity(row) > 0;
  }

  get totalRequiredQuantity(): number {
    if (!this.calculation) return 0;
    if (Number.isFinite(Number(this.calculation.summary.total_required_quantity_for_issuance)))
      return Number(this.calculation.summary.total_required_quantity_for_issuance);
    return this.calculation.items.reduce((sum, row) => sum + this.getRowRequiredQuantity(row), 0);
  }

  get totalShortageQuantity(): number {
    if (!this.calculation) return 0;
    const s = this.calculation.summary as { total_shortage_quantity?: number };
    if (Number.isFinite(Number(s.total_shortage_quantity))) return Number(s.total_shortage_quantity);
    return this.calculation.items.reduce((sum, row) => sum + this.getRowShortageQuantity(row), 0);
  }

  get hasTotalShortage(): boolean { return this.totalShortageQuantity > 0; }

  get shortageLineCount(): number {
    if (!this.calculation) return 0;
    if (Number.isFinite(Number(this.calculation.summary.insufficient_items_count)))
      return Number(this.calculation.summary.insufficient_items_count);
    return this.calculation.items.filter((row) => this.rowHasShortage(row)).length;
  }

  // ── template line helpers ────────────────────────────────────────────────

  templateLineRequiredQty(line: EditableTemplateLine): number {
    return Math.ceil(Number(line.quantity_per_base) || 0);
  }

  templateLineExceedsStock(line: EditableTemplateLine): boolean {
    const required = this.templateLineRequiredQty(line);
    const stock = Number(line.current_stock ?? this.getItemCurrentStock(line.item_id));
    if (!Number.isFinite(stock)) return false;
    return required > stock;
  }

  templateLineStockAfter(line: EditableTemplateLine): number {
    const stock = Number(line.current_stock ?? this.getItemCurrentStock(line.item_id));
    if (!Number.isFinite(stock)) return 0;
    return stock - this.templateLineRequiredQty(line);
  }

  getItemCurrentStock(itemId: number): number | string {
    const line = this.templateLines.find((e) => e.item_id === itemId);
    if (line && Number.isFinite(Number(line.current_stock))) return Number(line.current_stock);
    const opt = this.itemOptions.find((i) => i.item_id === itemId);
    if (opt && Number.isFinite(Number(opt.current_stock))) return Number(opt.current_stock);
    return '-';
  }

  getItemOptionById(itemId: number): BatchDistributionItemOption | undefined {
    return this.itemOptions.find((i) => i.item_id === itemId);
  }

  getItemLabel(itemId: number): string {
    const found = this.itemOptions.find((i) => i.item_id === itemId);
    return found ? `${found.item_code} - ${found.item_description}` : `Item #${itemId}`;
  }

  // ── data loading ─────────────────────────────────────────────────────────

  loadRecipeTypeOptions(): void {
    this.recipeTypeService.getOptions().subscribe({
      next: (res) => { this.recipeTypeOptions = res.data; this.cdr.detectChanges(); },
      error: () => { /* non-critical */ },
    });
  }

  loadLocationOptions(): void {
    this.itemService.getLocationOptions().subscribe({
      next: (res) => {
        this.locationOptions = (res.data || []).map((l: any) => ({
          location_id: l.location_id,
          location_name: l.location_name,
          location_code: l.location_code,
        }));
        this.cdr.detectChanges();
      },
      error: () => { this.locationOptions = []; },
    });
  }

  loadTemplates(): void {
    this.cancelTemplateSearchDebounce();
    this.loadingTemplates = true;
    this.loadTemplatesSub?.unsubscribe();
    this.loadTemplatesSub = this.batchService
      .listTemplates(
        this.searchTemplate || undefined,
        this.templateRecipeTypeFilter === 'all' ? undefined : this.templateRecipeTypeFilter,
      )
      .subscribe({
        next: (response) => {
          this.templates = response.data;
          this.resetRecipeLazyLoad();
          if (!this.searchTemplate.trim() && this.templateRecipeTypeFilter === 'all') {
            this.templatesBaseline = response.data.slice();
          }
          this.loadingTemplates = false;
          this.ensureTemplatePageInRange();
          if (this.selectedTemplateId && !this.templates.some((t) => t.template_id === this.selectedTemplateId)) {
            this.selectedTemplateId = null;
            this.selectedTemplateName = '';
            this.calculation = null;
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

  loadItemOptions(): void {
    this.cancelItemOptionsSearchDebounce();
    this.loadingItemOptions = true;
    this.loadItemOptionsSub?.unsubscribe();
    this.loadItemOptionsSub = this.batchService.listItemOptions(this.searchItem || undefined).subscribe({
      next: (response) => {
        this.itemOptions = response.data;
        if (!this.searchItem.trim()) this.itemOptionsBaseline = response.data.slice();
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

  loadTemplateDetails(templateId: number): void {
    this.batchService.getTemplate(templateId).subscribe({
      next: (response) => { this.selectedTemplateDetails = response.data; this.cdr.detectChanges(); },
      error: () => { this.toast.error('Failed to load recipe details'); this.closeIngredientModal(); },
    });
  }

  // ── search & pagination ──────────────────────────────────────────────────

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
    }, this.TEMPLATE_SEARCH_DEBOUNCE_MS);
  }

  clearTemplateSearchBox(): void {
    this.searchTemplate = '';
    this.cancelTemplateSearchDebounce();
    this.loadTemplatesSub?.unsubscribe();
    this.loadingTemplates = false;
    this.resetTemplatePagination();
    this.loadTemplates();
  }

  clearTemplateSearch(): void { this.clearTemplateSearchBox(); }
  searchTemplates(): void { this.cancelTemplateSearchDebounce(); this.resetTemplatePagination(); this.loadTemplates(); }
  onTemplateFilterChange(): void { this.resetTemplatePagination(); this.loadTemplates(); }
  setTemplateViewMode(mode: 'card' | 'list'): void { this.templateViewMode = mode; }

  goToTemplatePage(page: number): void {
    this.templatePage = Math.min(Math.max(Math.floor(Number(page)) || 1, 1), this.totalTemplatePages);
  }

  goToNextTemplatePage(): void { if (this.canGoToNextTemplatePage) this.templatePage++; }
  goToPreviousTemplatePage(): void { if (this.canGoToPreviousTemplatePage) this.templatePage--; }

  onRecipeListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 80) return;
    this.loadMoreRecipes();
  }

  loadMoreRecipes(): void {
    if (!this.hasMoreRecipes || this.loadingMoreRecipes || this.loadingTemplates) return;
    this.loadingMoreRecipes = true;
    this.visibleRecipeCount = Math.min(this.visibleRecipeCount + this.recipeLazyBatchSize, this.templates.length);
    this.loadingMoreRecipes = false;
    this.cdr.detectChanges();
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
    }, this.TEMPLATE_SEARCH_DEBOUNCE_MS);
  }

  clearItemSearchBox(): void {
    this.searchItem = '';
    this.cancelItemOptionsSearchDebounce();
    this.loadItemOptionsSub?.unsubscribe();
    this.loadingItemOptions = false;
    this.restoreItemOptionsBaseline();
  }

  searchItems(): void { this.cancelItemOptionsSearchDebounce(); this.loadItemOptions(); }
  resetItemSearch(): void { this.clearItemSearchBox(); }

  // ── combobox ─────────────────────────────────────────────────────────────

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
      event.preventDefault(); this.openItemCombobox(); return;
    }
    if (key === 'Escape') {
      event.preventDefault(); this.itemComboboxOpen = false; this.activeItemOptionIndex = -1; return;
    }
    if (!this.itemOptions.length) return;
    if (key === 'ArrowDown') {
      event.preventDefault();
      this.activeItemOptionIndex = Math.min(this.activeItemOptionIndex + 1, this.itemOptions.length - 1); return;
    }
    if (key === 'ArrowUp') {
      event.preventDefault();
      this.activeItemOptionIndex = Math.max(this.activeItemOptionIndex - 1, 0); return;
    }
    if (key === 'Enter' && this.activeItemOptionIndex >= 0) {
      event.preventDefault(); this.selectItemOption(this.itemOptions[this.activeItemOptionIndex]);
    }
  }

  onItemOptionHover(index: number): void { this.activeItemOptionIndex = index; }

  selectItemOption(item: BatchDistributionItemOption): void {
    this.lineDraftItemId = item.item_id;
    this.searchItem = `${item.item_code} - ${item.item_description} (Stock: ${item.current_stock})`;
    this.itemComboboxOpen = false;
    this.activeItemOptionIndex = -1;
  }

  // ── template line CRUD ───────────────────────────────────────────────────

  addLine(): void {
    if (!this.lineDraftItemId) { this.toast.error('Select an item to add.'); return; }
    const qty = Number(this.lineDraftQuantityPerBase);
    if (!Number.isFinite(qty) || qty <= 0) { this.toast.error('Quantity per base must be greater than zero.'); return; }
    const existing = this.templateLines.find((l) => l.item_id === this.lineDraftItemId);
    const opt = this.itemOptions.find((i) => i.item_id === this.lineDraftItemId);
    if (existing) {
      existing.quantity_per_base = qty;
      existing.notes = this.lineDraftNotes.trim();
      if (Number.isFinite(Number(opt?.current_stock))) existing.current_stock = Number(opt?.current_stock);
    } else {
      this.templateLines.push({ item_id: this.lineDraftItemId, quantity_per_base: qty, notes: this.lineDraftNotes.trim(), current_stock: Number(opt?.current_stock ?? 0) });
    }
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.searchItem = '';
    this.itemComboboxOpen = false;
    this.activeItemOptionIndex = -1;
    this.loadItemOptions();
  }

  removeLine(itemId: number): void { this.templateLines = this.templateLines.filter((l) => l.item_id !== itemId); }
  removeTemplateLine(index: number): void { this.templateLines.splice(index, 1); }

  // ── template CRUD ────────────────────────────────────────────────────────

  openNewRecipeModal(): void {
    this.templateModalMode = 'create';
    this.duplicateSourceTemplateName = null;
    this.loadingRecipeModal = false;
    this.showNewRecipeModal = true;
    this.showTemplateForm = true;
    this.isEditingTemplate = false;
    this.templateForm = { template_name: '', distribution_type: 'feeding_program', base_unit_count: 100, notes: '', recipe_type_id: null };
    this.templateLines = [];
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.cdr.detectChanges();
  }

  closeNewRecipeModal(): void {
    if (this.savingTemplate) {
      ModalUtils.bounce('.bd-new-recipe-modal');
      return;
    }
    this.showNewRecipeModal = false;
    this.showTemplateForm = false;
    this.isEditingTemplate = false;
    this.templateModalMode = 'create';
    this.duplicateSourceTemplateName = null;
    this.loadingRecipeModal = false;
    this.templateLines = [];
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.cdr.detectChanges();
  }

  startCreateTemplate(): void {
    this.showTemplateForm = true;
    this.isEditingTemplate = false;
    this.templateForm = { template_name: '', distribution_type: 'feeding_program', base_unit_count: 100, notes: '', recipe_type_id: null };
    this.templateLines = [];
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.cdr.detectChanges();
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

  editTemplate(summary: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.batchService.getTemplate(summary.template_id).subscribe({
      next: (response) => {
        const d = response.data;
        this.templateModalMode = 'edit';
        this.duplicateSourceTemplateName = null;
        this.loadingRecipeModal = false;
        this.showNewRecipeModal = true;
        this.showTemplateForm = true;
        this.isEditingTemplate = true;
        this.selectedTemplateId = d.template.template_id;
        this.selectedTemplateName = d.template.template_name;
        this.templateForm = {
          template_name: d.template.template_name,
          distribution_type: d.template.distribution_type,
          base_unit_count: d.template.base_unit_count,
          notes: d.template.notes ?? '',
          recipe_type_id: d.template.recipe_type_id ?? null,
        };
        this.templateLines = d.items.map((item) => ({ item_id: item.item_id, quantity_per_base: item.quantity_per_base, notes: '', current_stock: item.current_stock }));
        this.targetUnitCount = d.template.base_unit_count;
        this.lineDraftItemId = null;
        this.lineDraftQuantityPerBase = 1;
        this.lineDraftNotes = '';
        this.cdr.detectChanges();
      },
      error: (err) => { this.toast.error(err?.error?.message || 'Failed to load template details.'); this.cdr.detectChanges(); },
    });
  }

  duplicateTemplate(template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.loadingRecipeModal = true;
    this.templateModalMode = 'duplicate';
    this.duplicateSourceTemplateName = template.template_name;
    this.showNewRecipeModal = true;
    this.showTemplateForm = false;
    this.batchService.getTemplate(template.template_id).subscribe({
      next: (response) => {
        const d = response.data;
        this.showTemplateForm = true;
        this.isEditingTemplate = false;
        this.selectedTemplateId = null;
        this.selectedTemplateName = '';
        const originalName = d.template.template_name;
        const copyName = originalName.includes('(copy)') ? originalName : `${originalName} (copy)`;
        this.templateForm = { template_name: copyName, distribution_type: d.template.distribution_type, base_unit_count: d.template.base_unit_count, notes: d.template.notes ?? '', recipe_type_id: d.template.recipe_type_id ?? null };
        this.templateLines = d.items.map((item) => ({ item_id: item.item_id, quantity_per_base: item.quantity_per_base, notes: '', current_stock: item.current_stock }));
        this.targetUnitCount = d.template.base_unit_count;
        this.lineDraftItemId = null;
        this.lineDraftQuantityPerBase = 1;
        this.lineDraftNotes = '';
        this.loadingRecipeModal = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingRecipeModal = false;
        this.templateModalMode = 'create';
        this.duplicateSourceTemplateName = null;
        this.showNewRecipeModal = false;
        this.showTemplateForm = false;
        this.toast.error(err?.error?.message || 'Failed to load recipe for duplication.');
        this.cdr.detectChanges();
      },
    });
  }

  saveTemplate(): void {
    if (!this.templateForm.template_name.trim()) { this.toast.error('Please fill out all required fields (*)'); return; }
    if (this.templateForm.template_name.length > 100) { this.toast.error('Template name must be 100 characters or less.'); return; }
    if (!Number.isFinite(Number(this.templateForm.base_unit_count)) || Number(this.templateForm.base_unit_count) <= 0) {
      this.toast.error('Standard batch size must be greater than zero.'); return;
    }
    if (this.templateForm.notes && this.templateForm.notes.length > 500) { this.toast.error('Notes must be 500 characters or less.'); return; }
    if (this.templateLines.length === 0) { this.toast.error('Add at least one item to the template.'); return; }
    if (this.templateHasStockWarning) {
      this.templateConfirmDialog = {
        open: true,
        title: 'Save recipe with stock warning?',
        message: `${this.templateStockWarningCount} ingredient(s) exceed current stock for a standard batch (${this.templateForm.base_unit_count} units). You can save the recipe, but schedules using it cannot be run or allocated until stock is sufficient.`,
        confirmText: 'Save Anyway',
        cancelText: 'Go Back',
        action: 'save_stock_warning',
        template: null,
      };
      return;
    }
    this.performSaveTemplate();
  }

  performSaveTemplate(): void {
    const hadStockWarning = this.templateHasStockWarning;
    const payload: BatchDistributionTemplatePayload = {
      template_name: this.templateForm.template_name.trim(),
      distribution_type: this.templateForm.distribution_type,
      base_unit_count: Math.floor(Number(this.templateForm.base_unit_count)),
      notes: this.templateForm.notes.trim(),
      recipe_type_id: this.templateForm.recipe_type_id ?? null,
      items: this.templateLines.map((line) => ({ item_id: line.item_id, quantity_per_base: Number(line.quantity_per_base), notes: line.notes.trim() || null })),
    };
    this.savingTemplate = true;
    const request$ = this.isEditingTemplate && this.selectedTemplateId
      ? this.batchService.updateTemplate(this.selectedTemplateId, payload)
      : this.batchService.createTemplate(payload);
    request$.subscribe({
      next: (response) => {
        this.savingTemplate = false;
        const t = response.data.template;
        this.selectedTemplateId = t.template_id;
        this.selectedTemplateName = t.template_name;
        this.targetUnitCount = t.base_unit_count;
        this.templateForm = { template_name: t.template_name, distribution_type: t.distribution_type, base_unit_count: t.base_unit_count, notes: t.notes ?? '', recipe_type_id: t.recipe_type_id ?? null };
        this.templateLines = response.data.items.map((item: any) => ({ item_id: item.item_id, quantity_per_base: item.quantity_per_base, notes: '' }));
        const msg = this.templateModalMode === 'duplicate' ? 'Recipe duplicated successfully.' : this.templateModalMode === 'edit' ? 'Recipe updated successfully.' : 'Recipe created successfully.';
        this.toast.success(hadStockWarning ? `${msg} Some ingredients exceed current stock.` : msg);
        this.loadTemplates();
        this.showTemplateForm = false;
        this.isEditingTemplate = false;
        this.templateModalMode = 'create';
        this.duplicateSourceTemplateName = null;
        this.showNewRecipeModal = false;
        this.cdr.detectChanges();
      },
      error: (err) => { this.savingTemplate = false; this.toast.error(err?.error?.message || 'Failed to save template.'); this.cdr.detectChanges(); },
    });
  }

  selectTemplate(summary: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.selectedTemplateId = summary.template_id;
    this.selectedTemplateName = summary.template_name;
    this.targetUnitCount = summary.base_unit_count;
    this.calculation = null;
    this.cdr.detectChanges();
    this.calculate();
  }

  calculate(): void {
    if (!this.selectedTemplateId) { this.toast.error('Select a template first.'); return; }
    const target = Math.floor(Number(this.targetUnitCount));
    if (!Number.isFinite(target) || target <= 0) { this.toast.error('Target count must be greater than zero.'); return; }
    this.calculating = true;
    this.batchService.calculate(this.selectedTemplateId, target).subscribe({
      next: (response) => { this.calculation = response.data; this.calculating = false; this.cdr.detectChanges(); },
      error: (err) => { this.calculating = false; this.toast.error(err?.error?.message || 'Failed to calculate distribution.'); this.cdr.detectChanges(); },
    });
  }

  issueDistribution(): void {
    if (!this.selectedTemplateId) { this.toast.error('Select a template first.'); return; }
    if (!this.calculation) { this.toast.error('Calculate distribution before issuing.'); return; }
    if (this.hasTotalShortage) { this.toast.error('Cannot issue because one or more items have shortages.'); return; }
    if (!this.destination.trim()) { this.toast.error('Please fill out all required fields (*)'); return; }
    if (this.destination.length > 150) { this.toast.error('Destination must be 150 characters or less.'); return; }
    if (this.reason && this.reason.length > 250) { this.toast.error('Reason must be 250 characters or less.'); return; }
    if (this.issueNotes && this.issueNotes.length > 500) { this.toast.error('Notes must be 500 characters or less.'); return; }
    this.issuing = true;
    const target = Math.floor(Number(this.targetUnitCount));
    this.batchService.issue(this.selectedTemplateId, target, this.destination.trim(), this.reason.trim() || 'Batch Distribution', this.issueNotes.trim() || undefined).subscribe({
      next: () => {
        this.issuing = false;
        this.toast.show('success', 'Distribution recorded successfully');
        this.destination = '';
        this.issueNotes = '';
        this.reason = 'Batch Distribution';
        this.calculation = null;
        this.loadItemOptions();
        this.cdr.detectChanges();
      },
      error: (err) => { this.issuing = false; this.toast.show('error', err?.error?.message || 'Failed to issue batch distribution.'); this.cdr.detectChanges(); },
    });
  }

  confirmDeleteTemplate(template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.templateConfirmDialog = { open: true, title: 'Delete Recipe', message: `Are you sure you want to delete "${template.template_name}"? This action cannot be undone.`, confirmText: 'Delete', cancelText: 'Cancel', action: 'delete', template };
  }

  closeTemplateConfirm(): void {
    this.templateConfirmDialog = { open: false, title: '', message: '', confirmText: 'Delete', cancelText: 'Cancel', action: null, template: null };
  }

  confirmTemplateDialogAction(): void {
    const action = this.templateConfirmDialog.action;
    if (action === 'save_stock_warning') { this.closeTemplateConfirm(); this.performSaveTemplate(); return; }
    const template = this.templateConfirmDialog.template;
    if (!template) { this.closeTemplateConfirm(); return; }
    this.closeTemplateConfirm();
    this.deleteTemplate(template);
  }

  deleteTemplate(summary: BatchDistributionTemplateSummary): void {
    this.batchService.deleteTemplate(summary.template_id).subscribe({
      next: (response: any) => {
        this.toast.success(response.message || 'Template deleted.');
        if (this.selectedTemplateId === summary.template_id) { this.selectedTemplateId = null; this.selectedTemplateName = ''; this.calculation = null; }
        this.loadTemplates();
        this.cdr.detectChanges();
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Failed to delete template.'); this.cdr.detectChanges(); },
    });
  }

  // ── template menu ────────────────────────────────────────────────────────

  toggleTemplateMenu(templateId: number, event: Event): void { event.stopPropagation(); this.openTemplateMenuId = this.openTemplateMenuId === templateId ? null : templateId; }
  closeTemplateMenu(): void { this.openTemplateMenuId = null; }

  runTemplateMenuAction(action: 'calculate' | 'edit' | 'delete', template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    if (action === 'calculate') { this.selectTemplate(template); this.openCalculator(); return; }
    if (action === 'edit') { this.editTemplate(template); return; }
    if (action === 'delete') { this.confirmDeleteTemplate(template); }
  }

  toggleCalculator(): void { this.calculatorOpen = !this.calculatorOpen; }
  openCalculator(): void { this.calculatorOpen = true; }
  closeCalculator(): void { this.calculatorOpen = false; }

  // ── recipe details modal ─────────────────────────────────────────────────

  viewRecipeDetails(template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.selectedTemplateForDetails = template;
    this.loadTemplateDetails(template.template_id);
    this.showIngredientModal = true;
  }

  closeIngredientModal(): void { this.showIngredientModal = false; this.selectedTemplateForDetails = null; this.selectedTemplateDetails = null; }

  runRecipeFromDetails(): void {
    if (this.selectedTemplateForDetails) { this.closeIngredientModal(); this.runRecipeSchedule(this.selectedTemplateForDetails); }
  }

  /** Hook implemented by concrete component to open the schedule dialog from a template. */
  protected abstract runRecipeSchedule(template: BatchDistributionTemplateSummary): void;

  // ── private helpers ──────────────────────────────────────────────────────

  protected cancelTemplateSearchDebounce(): void {
    if (this.templateSearchDebounce !== undefined) { clearTimeout(this.templateSearchDebounce); this.templateSearchDebounce = undefined; }
  }

  protected restoreTemplatesBaseline(): void {
    if (this.templateRecipeTypeFilter !== 'all') { this.loadTemplates(); return; }
    if (this.templatesBaseline) {
      this.templates = this.templatesBaseline.slice();
      this.resetRecipeLazyLoad();
      this.ensureTemplatePageInRange();
      if (this.selectedTemplateId && !this.templates.some((t) => t.template_id === this.selectedTemplateId)) {
        this.selectedTemplateId = null; this.selectedTemplateName = ''; this.calculation = null;
      }
      this.cdr.detectChanges(); return;
    }
    this.loadTemplates();
  }

  protected cancelItemOptionsSearchDebounce(): void {
    if (this.itemOptionsSearchDebounce !== undefined) { clearTimeout(this.itemOptionsSearchDebounce); this.itemOptionsSearchDebounce = undefined; }
  }

  protected restoreItemOptionsBaseline(): void {
    if (this.itemOptionsBaseline) { this.itemOptions = this.itemOptionsBaseline.slice(); this.cdr.detectChanges(); return; }
    this.loadItemOptions();
  }

  protected resetRecipeLazyLoad(): void { this.visibleRecipeCount = this.recipeLazyBatchSize; this.loadingMoreRecipes = false; }
  protected resetTemplatePagination(): void { this.templatePage = 1; }

  protected ensureTemplatePageInRange(): void {
    if (this.templatePage > this.totalTemplatePages) this.templatePage = this.totalTemplatePages;
    if (this.templatePage < 1) this.templatePage = 1;
  }

  protected buildTemplateSummary(details: BatchDistributionTemplateDetails): BatchDistributionTemplateSummary {
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
      recipe_type_id: details.template.recipe_type_id ?? null,
      recipe_type_name: details.template.recipe_type_name ?? null,
    };
  }

  bounceModal(selector: string): void {
    const el = document.querySelector<HTMLElement>(`.${selector}`);
    if (!el) return;
    el.classList.remove('bounce');
    void el.offsetWidth;
    el.classList.add('bounce');
    setTimeout(() => el.classList.remove('bounce'), 400);
  }

  getStockStatusClass(stock: number): string {
    if (stock >= 100) return 'status-sufficient';
    if (stock >= 20) return 'status-low';
    return 'status-insufficient';
  }

  getStockStatusLabel(stock: number): string {
    if (stock >= 100) return '✓ Sufficient';
    if (stock >= 20) return '⚠ Low Stock';
    return '❌ Insufficient';
  }
}
