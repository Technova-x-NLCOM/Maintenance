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
  ProgramPlanCheckItem,
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { RecipeTypeOption, RecipeTypeService } from '../../../services/recipe-type.service';

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
  completingPlan = false;
  calculatorOpen = false;

  templates: BatchDistributionTemplateSummary[] = [];
  itemOptions: BatchDistributionItemOption[] = [];
  plans: ProgramPlanSummary[] = [];

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
  planFinalCheckAttempted = false;
  planRemainingLines: EditableRemainingLine[] = [];
  planProcuredLines: EditableProcuredLine[] = [];
  planIssueSummary: ProgramPlanDetailsResponse['issuance'] | null = null;
  planWizardStep: 1 | 2 | 3 = 1;
  showPlanDetailsModal = false;
  showScheduleDialog = false;
  scheduleDialogStep: 1 | 2 = 1;
  showRecipeSidebar = false;
  showNewRecipeModal = false;
  templateModalMode: 'create' | 'edit' | 'duplicate' = 'create';
  duplicateSourceTemplateName: string | null = null;
  loadingRecipeModal = false;
  scheduleFilter: 'upcoming' | 'completed' | 'all' = 'upcoming';
  schedulingTemplate: BatchDistributionTemplateSummary | null = null;
  schedulingCalculation: BatchDistributionCalculation | null = null;
  scheduleDestination = '';
  scheduleReason = '';
  scheduleNotes = '';
  schedulePlannedDate = '';
  reservingPlanId: number | null = null;
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
  planStockReadiness: Map<
    number,
    {
      required: number;
      available: number;
      line_count: number;
      ready_line_count: number;
      insufficient_items_count: number;
      percentage: number;
      can_proceed: boolean;
      status: string;
      loading: boolean;
    }
  > = new Map();
  planSearchTerm = '';
  
  // Pagination properties
  currentPlanPage = 1;
  planPageSize = 10;
  readonly planPageSizeOptions = [5, 10, 25, 50];
  
  readonly recipeLazyBatchSize = 10;
  visibleRecipeCount = 10;
  loadingMoreRecipes = false;

  // 3-Step Execution Modal Properties
  showExecutionModal = false;
  executionStep: 1 | 2 | 3 = 1;
  selectedPlanForExecution: ProgramPlanSummary | null = null;
  executionStockCheck: any = null;
  executionDestination = '';
  executionReason = '';
  executionNotes = '';
  gapFillData: { [itemId: number]: number } = {};
  allGapsFilled = false;
  executingDistribution = false;
  executionIssuingStock = false;
  executionIssuanceSummary: ProgramPlanDetailsResponse['issuance'] | null = null;
  executionPlanDetails: ProgramPlanDetailsResponse | null = null;
  executionRemainderLines: EditableRemainingLine[] = [];
  loadingExecutionDetails = false;

  // Recipe Details Modal Properties
  showIngredientModal = false;
  selectedTemplateForDetails: BatchDistributionTemplateSummary | null = null;
  selectedTemplateDetails: BatchDistributionTemplateDetails | null = null;

  // Stock Allocation Modal Properties
  showStockAllocationModal = false;
  stockReservations: any[] = [];
  groupedReservations: any[] = [];
  selectedReservationDetails: any = null;
  
  planConfirmDialog: {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    action: 'cancel' | 'delete' | 'execute' | 'allocate' | null;
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

  templateConfirmDialog: {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    action: 'delete' | 'save_stock_warning' | null;
    template: BatchDistributionTemplateSummary | null;
  } = {
    open: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    action: null,
    template: null,
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
  private lastLoadedPlansParams: { status?: ProgramPlanStatus; from_date?: string; to_date?: string } = {};

  constructor(
    private batchService: BatchDistributionService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private recipeTypeService: RecipeTypeService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.loadItemOptions();
    this.loadPlans();
    this.buildCalendar();
    this.loadRecipeTypeOptions();
  }

  ngOnDestroy(): void {
    this.cancelTemplateSearchDebounce();
    this.cancelItemOptionsSearchDebounce();
    this.clearToastTimeout();
    this.loadTemplatesSub?.unsubscribe();
    this.loadItemOptionsSub?.unsubscribe();
  }

  loadRecipeTypeOptions(): void {
    this.recipeTypeService.getOptions().subscribe({
      next: (res) => {
        this.recipeTypeOptions = res.data;
        this.cdr.detectChanges();
      },
      error: () => {
        // Non-critical: fail silently, dropdown will just be empty
      },
    });
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

  get planTargetCountLabel(): string {
    const template =
      this.templates.find((t) => t.template_id === this.planForm.template_id) ??
      this.schedulingTemplate;
    if (template?.distribution_type === 'relief_goods') {
      return 'Number of Relief Packs';
    }
    if (template?.distribution_type === 'feeding_program') {
      return 'Target Attendees';
    }
    return 'Target Count';
  }

  get perUnitLabel(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Items per Pack' : 'Amount per Serving';
  }

  get targetUnitNounPlural(): string {
    return this.selectedDistributionType === 'relief_goods' ? 'Packs' : 'Attendees';
  }

  get recipeModalTitle(): string {
    switch (this.templateModalMode) {
      case 'edit':
        return 'Edit Recipe';
      case 'duplicate':
        return 'Duplicate Recipe';
      default:
        return 'Create New Recipe';
    }
  }

  get recipeModalSaveLabel(): string {
    if (this.savingTemplate) {
      return 'Saving...';
    }
    const warningSuffix = this.templateHasStockWarning ? ' With Warning' : '';
    switch (this.templateModalMode) {
      case 'edit':
        return `Update Recipe${warningSuffix}`;
      case 'duplicate':
        return `Save Duplicate${warningSuffix}`;
      default:
        return `Create Recipe${warningSuffix}`;
    }
  }

  get templateStockWarningCount(): number {
    return this.templateLines.filter((line) => this.templateLineExceedsStock(line)).length;
  }

  get templateHasStockWarning(): boolean {
    return this.templateStockWarningCount > 0;
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

  get displayedPlans(): ProgramPlanSummary[] {
    let filtered = this.filteredPlans;
    if (this.scheduleFilter === 'upcoming') {
      filtered = filtered.filter((plan) => plan.status !== 'completed' && plan.status !== 'cancelled');
    } else if (this.scheduleFilter === 'completed') {
      filtered = filtered.filter((plan) => plan.status === 'completed');
    }
    return filtered;
  }

  get scheduleHasWarning(): boolean {
    return !!this.schedulingCalculation?.items.some((row) => this.getRowShortageQuantity(row) > 0);
  }

  get calendarMonthName(): string {
    return this.calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get calendarWeekDays(): string[] {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  // Pagination getters
  get totalPlanPages(): number {
    return Math.ceil(this.filteredPlans.length / this.planPageSize) || 1;
  }

  get paginatedPlans(): ProgramPlanSummary[] {
    const startIndex = (this.currentPlanPage - 1) * this.planPageSize;
    const endIndex = startIndex + this.planPageSize;
    return this.filteredPlans.slice(startIndex, endIndex);
  }

  get isPlanDialogEditing(): boolean {
    return this.planDialogMode === 'edit';
  }

  isStockAllocated(plan: ProgramPlanSummary): boolean {
    return plan.status === 'ready';
  }

  hasPlanFullStockReadiness(plan: ProgramPlanSummary): boolean {
    const readiness = this.getStockReadiness(plan.plan_id);
    if (!readiness || readiness.loading) {
      return false;
    }
    return readiness.can_proceed || readiness.percentage >= 100;
  }

  canAllocateStock(plan: ProgramPlanSummary): boolean {
    if (plan.status !== 'planned') {
      return false;
    }
    return this.hasPlanFullStockReadiness(plan);
  }

  isPlanRunDateReached(plan: ProgramPlanSummary): boolean {
    const planDate = this.normalizeDate(plan.planned_date);
    const today = this.normalizeDate(new Date().toISOString().slice(0, 10));
    return planDate <= today;
  }

  showRunBatchAction(plan: ProgramPlanSummary): boolean {
    if (plan.status === 'completed' || plan.status === 'cancelled') {
      return false;
    }
    if (!['planned', 'checked_pre', 'ready'].includes(plan.status)) {
      return false;
    }
    return this.isPlanRunDateReached(plan);
  }

  isPlanScheduledToday(plan: ProgramPlanSummary): boolean {
    const planDate = this.normalizeDate(plan.planned_date);
    const today = this.normalizeDate(new Date().toISOString().slice(0, 10));
    return planDate === today;
  }

  /** Early allocation: planned status, full stock readiness, and planned date still in the future. */
  canAllocateEarly(plan: ProgramPlanSummary): boolean {
    if (!this.canAllocateStock(plan)) {
      return false;
    }
    const planDate = this.normalizeDate(plan.planned_date);
    const today = this.normalizeDate(new Date().toISOString().slice(0, 10));
    return planDate > today;
  }

  canRunBatch(plan: ProgramPlanSummary): boolean {
    if (!this.showRunBatchAction(plan)) {
      return false;
    }
    if (this.isStockAllocated(plan)) {
      return true;
    }
    return this.hasPlanFullStockReadiness(plan);
  }

  getRunBatchDisabledReason(plan: ProgramPlanSummary): string {
    if (!this.showRunBatchAction(plan)) {
      return '';
    }
    if (this.canRunBatch(plan)) {
      return '';
    }
    if (!this.hasPlanFullStockReadiness(plan)) {
      return 'Stock readiness must be 100% before you can run this batch.';
    }
    return '';
  }

  planBlocksRunAndAllocate(plan: ProgramPlanSummary): boolean {
    return plan.status === 'planned' && !this.hasPlanFullStockReadiness(plan);
  }

  /** @deprecated Use canRunBatch */
  isPlanExecutable(plan: ProgramPlanSummary): boolean {
    return this.canRunBatch(plan);
  }

  getRunBatchButtonLabel(plan: ProgramPlanSummary): string {
    return this.isStockAllocated(plan) ? 'Mark as complete' : '▶ Run Batch';
  }

  get executionModalTitle(): string {
    if (this.selectedPlanForExecution && this.isStockAllocated(this.selectedPlanForExecution)) {
      return 'Complete Batch';
    }
    return 'Run Batch';
  }

  get executionStockIssued(): boolean {
    if (this.executionIssuanceSummary) {
      return true;
    }
    return !!this.selectedPlanForExecution && this.isStockAllocated(this.selectedPlanForExecution);
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
      this.confirmDeleteTemplate(template);
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
    if (this.templateRecipeTypeFilter !== 'all') {
      this.loadTemplates();
      return;
    }

    if (this.templatesBaseline) {
      this.templates = this.templatesBaseline.slice();
      this.resetRecipeLazyLoad();
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

  onRecipeListScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const thresholdPx = 80;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - thresholdPx) {
      return;
    }
    this.loadMoreRecipes();
  }

  loadMoreRecipes(): void {
    if (!this.hasMoreRecipes || this.loadingMoreRecipes || this.loadingTemplates) {
      return;
    }
    this.loadingMoreRecipes = true;
    this.visibleRecipeCount = Math.min(
      this.visibleRecipeCount + this.recipeLazyBatchSize,
      this.templates.length,
    );
    this.loadingMoreRecipes = false;
    this.cdr.detectChanges();
  }

  private resetRecipeLazyLoad(): void {
    this.visibleRecipeCount = this.recipeLazyBatchSize;
    this.loadingMoreRecipes = false;
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
      recipe_type_id: null,
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
        this.templateModalMode = 'edit';
        this.duplicateSourceTemplateName = null;
        this.loadingRecipeModal = false;
        this.showNewRecipeModal = true;
        this.showTemplateForm = true;
        this.isEditingTemplate = true;
        this.selectedTemplateId = details.template.template_id;
        this.selectedTemplateName = details.template.template_name;

        this.templateForm = {
          template_name: details.template.template_name,
          distribution_type: details.template.distribution_type,
          base_unit_count: details.template.base_unit_count,
          notes: details.template.notes ?? '',
          recipe_type_id: details.template.recipe_type_id ?? null,
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
    el.classList.remove('bounce');
    // Force reflow so re-adding the class triggers the animation
    void el.offsetWidth;
    el.classList.add('bounce');
    setTimeout(() => el.classList.remove('bounce'), 400);
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

  removeTemplateLine(index: number): void {
    this.templateLines.splice(index, 1);
  }

  getItemOptionById(itemId: number): BatchDistributionItemOption | undefined {
    return this.itemOptions.find((item) => item.item_id === itemId);
  }

  getItemLabel(itemId: number): string {
    const found = this.itemOptions.find((item) => item.item_id === itemId);
    if (!found) {
      return `Item #${itemId}`;
    }

    return `${found.item_code} - ${found.item_description}`;
  }

  templateLineRequiredQty(line: EditableTemplateLine): number {
    return Math.ceil(Number(line.quantity_per_base) || 0);
  }

  templateLineExceedsStock(line: EditableTemplateLine): boolean {
    const required = this.templateLineRequiredQty(line);
    const stock = Number(line.current_stock ?? this.getItemCurrentStock(line.item_id));
    if (!Number.isFinite(stock)) {
      return false;
    }
    return required > stock;
  }

  templateLineStockAfter(line: EditableTemplateLine): number {
    const stock = Number(line.current_stock ?? this.getItemCurrentStock(line.item_id));
    if (!Number.isFinite(stock)) {
      return 0;
    }
    return stock - this.templateLineRequiredQty(line);
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

  private performSaveTemplate(): void {
    const hadStockWarning = this.templateHasStockWarning;
    const payload: BatchDistributionTemplatePayload = {
      template_name: this.templateForm.template_name.trim(),
      distribution_type: this.templateForm.distribution_type,
      base_unit_count: Math.floor(Number(this.templateForm.base_unit_count)),
      notes: this.templateForm.notes.trim(),
      recipe_type_id: this.templateForm.recipe_type_id ?? null,
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
          recipe_type_id: template.recipe_type_id ?? null,
        };

        this.templateLines = response.data.items.map((item) => ({
          item_id: item.item_id,
          quantity_per_base: item.quantity_per_base,
          notes: '',
        }));

        const savedMessage =
          this.templateModalMode === 'duplicate'
            ? 'Recipe duplicated successfully.'
            : this.templateModalMode === 'edit'
              ? 'Recipe updated successfully.'
              : 'Recipe created successfully.';
        this.toast.success(
          hadStockWarning ? `${savedMessage} Some ingredients exceed current stock.` : savedMessage,
        );
        this.loadTemplates();
        this.showTemplateForm = false;
        this.isEditingTemplate = false;
        this.templateModalMode = 'create';
        this.duplicateSourceTemplateName = null;
        this.showNewRecipeModal = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingTemplate = false;
        this.toast.error(err?.error?.message || 'Failed to save template.');
        this.cdr.detectChanges();
      },
    });
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
    
    const params = this.getCurrentPlansQueryParams();
    this.lastLoadedPlansParams = { ...params };
    
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

  private getCurrentPlansQueryParams(): { status?: ProgramPlanStatus; from_date?: string; to_date?: string } {
    const params: { status?: ProgramPlanStatus; from_date?: string; to_date?: string } = {};

    // Keep server query aligned with the active status filter when possible.
    if (this.planStatusFilter !== 'all') {
      params.status = this.planStatusFilter;
    }

    // If calendar view, load only the current month so the dataset matches the calendar viewport.
    if (this.planViewMode === 'calendar') {
      const firstDay = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth(), 1);
      const lastDay = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth() + 1, 0);

      params.from_date = this.formatDateForApi(firstDay);
      params.to_date = this.formatDateForApi(lastDay);
    }

    return params;
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
          // Advance the schedule modal instead of closing it.
          // Step 2 shows the inventory check (shortage review) for the newly created plan.
          this.scheduleDialogStep = 2;
          // Refresh with the same query params that were used for the current view,
          // so the list doesn't "jump" to a different dataset after save.
          this.currentPlanPage = 1;
          this.loadPlansUsingLastParams(response.data.plan);
        },
        error: (err) => {
          this.savingPlan = false;
          this.toast.error(err?.error?.message || 'Failed to create program plan.');
          this.cdr.detectChanges();
        },
      });
  }

  private loadPlansUsingLastParams(preferredPlan?: ProgramPlanSummary): void {
    this.loadingPlans = true;
    const params = this.lastLoadedPlansParams ?? {};

    this.batchService.listProgramPlans(params).subscribe({
      next: (response) => {
        this.plans = response.data;
        if (preferredPlan && !this.plans.some((plan) => plan.plan_id === preferredPlan.plan_id)) {
          this.plans = [preferredPlan, ...this.plans];
        }
        this.loadingPlans = false;
        this.buildCalendar();
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

  openScheduleDialog(): void {
    this.showScheduleDialog = true;
    this.planDialogMode = 'create';
    this.editingPlanId = null;
    this.scheduleDialogStep = 1;
    this.resetPlanForm();
  }

  openRecipeSidebarPanel(): void {
    this.showRecipeSidebar = true;
    this.resetRecipeLazyLoad();
  }

  closeRecipeSidebarPanel(): void {
    this.showRecipeSidebar = false;
  }

  runRecipe(template: BatchDistributionTemplateSummary): void {
    this.schedulingTemplate = template;
    this.showScheduleDialog = true;
    this.scheduleDialogStep = 1;
    this.scheduleDestination = '';
    this.scheduleReason = '';
    this.scheduleNotes = '';
    this.schedulePlannedDate = this.formatDateForApi(new Date());
    this.schedulingCalculation = null;
    this.planForm = {
      template_id: template.template_id,
      week_label: `${template.template_name} Batch`,
      planned_date: this.formatDateForApi(new Date()),
      target_unit_count: template.base_unit_count,
      notes: '',
    };
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog = false;
    this.savingPlan = false;
    this.planDialogMode = 'create';
    this.editingPlanId = null;
    this.scheduleDialogStep = 1;
    this.planFinalCheckAttempted = false;
    this.schedulingCalculation = null;
    this.schedulingTemplate = null;
    this.resetPlanForm();
  }

  submitPlanDialog(): void {
    if (this.isPlanDialogEditing) {
      this.updatePlanLocal();
      return;
    }

    if (this.scheduleDialogStep === 1) {
      this.validateScheduleStep();
      return;
    }
    if (this.scheduleDialogStep === 2) {
      this.createScheduleFromRecipe();
      return;
    }
  }

  validateScheduleStep(): void {
    if (!this.planForm.template_id) {
      this.toast.error('Please select a recipe.');
      return;
    }
    if (!this.schedulePlannedDate) {
      this.toast.error('Please select a planned date.');
      return;
    }
    const targetCount = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
      this.toast.error('Target servings must be greater than zero.');
      return;
    }
    if (!this.scheduleReason.trim()) {
      this.toast.error('Reason is required.');
      return;
    }
    if (this.scheduleReason.length > 250) {
      this.toast.error('Reason must be 250 characters or less.');
      return;
    }
    if (this.scheduleDestination.length > 150) {
      this.toast.error('Destination must be 150 characters or less.');
      return;
    }
    this.calculating = true;
    this.batchService.calculate(this.planForm.template_id, targetCount).subscribe({
      next: (response) => {
        this.calculating = false;
        this.schedulingCalculation = response.data;
        this.scheduleDialogStep = 2;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.calculating = false;
        this.toast.error(err?.error?.message || 'Failed to validate schedule requirements.');
        this.cdr.detectChanges();
      },
    });
  }

  createScheduleFromRecipe(): void {
    if (!this.planForm.template_id) {
      return;
    }
    if (!this.scheduleReason.trim()) {
      this.toast.error('Reason is required.');
      return;
    }
    const targetCount = Math.floor(Number(this.planForm.target_unit_count));
    this.savingPlan = true;
    const weekLabel = (this.scheduleDestination || this.schedulingTemplate?.template_name || 'Scheduled Batch').trim();
    const stitchedNotes = [
      `Reason: ${this.scheduleReason.trim()}`,
      this.scheduleNotes ? `Notes: ${this.scheduleNotes}` : '',
      this.scheduleDestination.trim() ? `Destination: ${this.scheduleDestination.trim()}` : '',
    ].filter(Boolean).join(' | ');
    this.batchService.createProgramPlan({
      template_id: this.planForm.template_id,
      week_label: weekLabel.slice(0, 50),
      planned_date: this.schedulePlannedDate,
      target_unit_count: targetCount,
      notes: stitchedNotes || undefined,
    }).subscribe({
      next: () => {
        this.savingPlan = false;
        this.toast.success('Schedule created successfully.');
        this.closeScheduleDialog();
        this.closeRecipeSidebarPanel();
        this.loadPlans();
      },
      error: (err) => {
        this.savingPlan = false;
        this.toast.error(err?.error?.message || 'Failed to create schedule.');
        this.cdr.detectChanges();
      },
    });
  }

  reservePlan(plan: ProgramPlanSummary): void {
    if (this.reservingPlanId) {
      return;
    }
    if (!this.hasPlanFullStockReadiness(plan)) {
      this.toast.error('Cannot reserve until all ingredients have sufficient stock for this schedule.');
      return;
    }
    this.reservingPlanId = plan.plan_id;
    this.batchService.reserveProgramPlan(plan.plan_id, {
      destination: `Reserved for ${plan.week_label}`,
      reason: 'Inventory Reservation',
      notes: 'Reserved from Recipe & Distribution',
    }).subscribe({
      next: () => {
        this.reservingPlanId = null;
        this.toast.success('Inventory reserved successfully.');
        this.loadPlans();
      },
      error: (err) => {
        this.reservingPlanId = null;
        this.toast.error(err?.error?.message || 'Failed to reserve inventory.');
        this.cdr.detectChanges();
      },
    });
  }

  togglePlanSortDirection(): void {
    this.planSortDirection = this.planSortDirection === 'desc' ? 'asc' : 'desc';
    this.currentPlanPage = 1; // Reset to first page when sorting changes
  }

  onPlanStatusFilterChange(): void {
    this.currentPlanPage = 1;
    // Keep backing dataset aligned with the filter so refreshes don't jump datasets.
    this.loadPlans();
  }

  // Pagination methods
  goToFirstPage(): void {
    this.currentPlanPage = 1;
  }

  goToPreviousPlanPage(): void {
    if (this.currentPlanPage > 1) {
      this.currentPlanPage--;
    }
  }

  goToNextPlanPage(): void {
    if (this.currentPlanPage < this.totalPlanPages) {
      this.currentPlanPage++;
    }
  }

  goToLastPage(): void {
    this.currentPlanPage = this.totalPlanPages;
  }

  onPlanPageSizeChange(): void {
    this.currentPlanPage = 1; // Reset to first page when page size changes
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
    this.closePlanMenu();
    this.planDialogMode = 'edit';
    this.editingPlanId = plan.plan_id;
    this.scheduleDialogStep = 1;
    this.schedulingTemplate = this.templates.find((t) => t.template_id === plan.template_id) ?? null;
    this.schedulingCalculation = null;
    this.planForm = {
      template_id: plan.template_id,
      week_label: plan.week_label,
      planned_date: plan.planned_date,
      target_unit_count: plan.target_unit_count,
      notes: plan.notes ?? '',
    };
    this.schedulePlannedDate = plan.planned_date;
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
      this.deletePlan(plan);
      this.closePlanConfirm();
      return;
    }

    if (action === 'cancel') {
      this.cancelPlan(plan);
      this.closePlanConfirm();
      return;
    }

    if (action === 'allocate') {
      this.closePlanConfirm();
      this.reservePlan(plan);
      return;
    }

    this.executePlan(plan);
    this.closePlanConfirm();
  }

  viewPlanDetails(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    this.selectedPlanId = plan.plan_id;
    this.showPlanDetailsModal = true;
    this.loadPlanDetails(plan.plan_id);
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
    this.planFinalCheckAttempted = false;
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

    this.planFinalCheckAttempted = true;

    if (!this.planIssueReason.trim()) {
      this.toast.error('Reason is required.');
      this.focusFinalCheckFirstInvalidField();
      return;
    }
    if (this.planIssueReason.length > 250) {
      this.toast.error('Reason must be 250 characters or less.');
      return;
    }
    if (this.planIssueDestination.length > 150) {
      this.toast.error('Destination must be 150 characters or less.');
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
      issue_destination: this.planIssueDestination.trim() || undefined,
      issue_reason: this.planIssueReason.trim(),
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

  private focusFinalCheckFirstInvalidField(): void {
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input[data-finalcheck-reason="true"]');
      el?.focus();
    }, 0);
  }

  private validateExecutionIssueFields(): { destination?: string; reason: string } | null {
    if (!this.executionReason.trim()) {
      this.toast.error('Reason is required.');
      return null;
    }
    if (this.executionReason.length > 250) {
      this.toast.error('Reason must be 250 characters or less.');
      return null;
    }
    if (this.executionDestination.length > 150) {
      this.toast.error('Destination must be 150 characters or less.');
      return null;
    }
    const reason = this.executionReason.trim();
    const destination = this.executionDestination.trim();
    return {
      reason,
      ...(destination ? { destination } : {}),
    };
  }

  completePlan(): void {
    if (!this.selectedPlanId || this.completingPlan) {
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
    this.completingPlan = true;
    this.batchService
      .completeProgramPlan(this.selectedPlanId, {
        status: 'completed',
        remaining_items,
      })
      .subscribe({
        next: (response) => {
          this.runningPlanAction = false;
          this.completingPlan = false;
          this.selectedPlanDetails = response.data;
          this.planIssueSummary = response.data.issuance ?? this.planIssueSummary;
          // Prefer a consistent UX-focused success message here (final step completion).
          this.toast.success(response.message || 'Batch distribution scheduled successfully!');
          this.loadPlans();
          this.seedRemainingLinesFromCurrentDetails();
          this.seedProcuredLinesFromCurrentDetails();
          this.planWizardStep = 3;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.runningPlanAction = false;
          this.completingPlan = false;
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
      case 'cancelled':
        return { label: 'Cancelled', className: 'status-cancelled', icon: 'ti-ban' };
      case 'completed':
        return { label: 'Completed', className: 'status-completed', icon: 'ti-circle-check' };
      case 'ready':
        return { label: 'Stock Allocated', className: 'status-ready', icon: 'ti-package' };
      case 'checked_pre':
        return { label: 'Pre-checked', className: 'status-checked-pre', icon: 'ti-clipboard-check' };
      default:
        return { label: 'Planned', className: 'status-planned', icon: 'ti-clock' };
    }
  }

  isPlanOverdue(plan: ProgramPlanSummary): boolean {
    if (plan.status === 'completed' || plan.status === 'cancelled') {
      return false;
    }
    const planDate = this.normalizeDate(plan.planned_date);
    const today = this.normalizeDate(new Date().toISOString().slice(0, 10));
    return planDate < today && plan.status !== 'ready';
  }

  isPlanLocked(plan: ProgramPlanSummary): boolean {
    return plan.status === 'completed' || plan.status === 'cancelled';
  }

  getPlanStatusClass(status: ProgramPlanStatus | string): string {
    switch (status) {
      case 'planned':
        return 'tag-planned';
      case 'checked_pre':
        return 'tag-checked-pre';
      case 'ready':
        return 'tag-ready';
      case 'cancelled':
        return 'tag-cancelled';
      case 'completed':
        return 'tag-completed';
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
      case 'ready':
      case 'completed':
      case 'cancelled':
        this.planWizardStep = 3;
        break;
      case 'checked_pre':
        this.planWizardStep = 2;
        break;
      default:
        this.planWizardStep = 1;
        break;
    }
  }

  private deleteTemplate(summary: BatchDistributionTemplateSummary): void {
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
      recipe_type_id: details.template.recipe_type_id ?? null,
      recipe_type_name: details.template.recipe_type_name ?? null,
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

    const planId = this.editingPlanId;
    this.savingPlan = true;

    this.batchService
      .updateProgramPlanSchedule(planId, {
        template_id: this.planForm.template_id as number,
        week_label: this.planForm.week_label.trim(),
        planned_date: this.planForm.planned_date,
        target_unit_count: targetCount,
        notes: this.planForm.notes.trim() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.savingPlan = false;
          this.applyPlanUpdate(response.data.plan);

          if (this.selectedPlanId === planId) {
            this.selectedPlanDetails = response.data;
            this.planIssueSummary = response.data.issuance ?? null;
            this.seedRemainingLinesFromCurrentDetails();
            this.seedProcuredLinesFromCurrentDetails();
            this.syncPlanWizardStep(response.data.plan.status);
          }

          this.toast.success(response.message || 'Schedule updated successfully.');
          this.buildCalendar();
          this.loadStockReadinessForPlans();
          this.closeScheduleDialog();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.savingPlan = false;
          this.toast.error(err?.error?.message || 'Failed to update schedule.');
          this.cdr.detectChanges();
        },
      });
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
    // Prevent state leakage between views (fixes "flashing" modal in calendar view).
    this.showScheduleDialog = false;
    this.scheduleDialogStep = 1;
    this.planFinalCheckAttempted = false;
    this.openPlanMenuId = null;
    this.planConfirmDialog.open = false;
    this.selectedPlanId = null;
    this.selectedPlanDetails = null;
    this.expandedPlanId = null;
    this.planWizardStep = 1;
    if (mode === 'calendar') {
      this.buildCalendar();
      this.loadPlans();
      return;
    }
    // Switching from calendar -> list should reload unbounded data (no month constraint),
    // otherwise the list can appear to "lose" rows that were just outside the calendar range.
    this.loadPlans();
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

  closePlanDetailModal(): void {
    this.showPlanDetailsModal = false;
    this.selectedPlanId = null;
    this.selectedPlanDetails = null;
    this.planIssueSummary = null;
    this.planProcuredLines = [];
    this.planRemainingLines = [];
    this.expandedPlanId = null;
  }

  loadStockReadinessForPlans(): void {
    const plannedPlans = this.plans.filter(plan => plan.status === 'planned');
    
    plannedPlans.forEach(plan => {
      this.planStockReadiness.set(plan.plan_id, {
        required: 0,
        available: 0,
        line_count: 0,
        ready_line_count: 0,
        insufficient_items_count: 0,
        percentage: 0,
        can_proceed: false,
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
            line_count: 0,
            ready_line_count: 0,
            insufficient_items_count: 0,
            percentage: 0,
            can_proceed: false,
            status: 'error',
            loading: false,
          });
          this.cdr.detectChanges();
        },
      });
    });
  }

  getStockReadiness(planId: number): {
    required: number;
    available: number;
    line_count: number;
    ready_line_count: number;
    insufficient_items_count: number;
    percentage: number;
    can_proceed: boolean;
    status: string;
    loading: boolean;
  } | null {
    return this.planStockReadiness.get(planId) || null;
  }

  getStockReadinessLabel(planId: number): string {
    const readiness = this.getStockReadiness(planId);
    if (!readiness || readiness.loading) {
      return 'Loading...';
    }
    if (readiness.line_count > 0) {
      return `${readiness.percentage}% (${readiness.ready_line_count}/${readiness.line_count} ingredients ready)`;
    }
    return `${readiness.percentage}%`;
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

  // Search functionality
  onPlanSearchInput(): void {
    this.currentPlanPage = 1; // Reset to first page when searching
  }

  clearPlanSearch(): void {
    this.planSearchTerm = '';
    this.currentPlanPage = 1;
  }

  // Stock reservation methods
  openStockReservationsModal(): void {
    this.loadStockReservations();
    this.showStockAllocationModal = true;
  }

  closeStockAllocationModal(): void {
    this.showStockAllocationModal = false;
    this.selectedReservationDetails = null;
    this.groupedReservations = [];
  }

  // Kebab menu methods for plans
  reserveStockForPlan(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    if (!this.canAllocateEarly(plan)) {
      if (this.isPlanScheduledToday(plan) && this.canAllocateStock(plan)) {
        this.toast.error('On the planned date, use Run Batch to issue stock instead of allocating early.');
      } else {
        this.toast.error('Allocate stock only when the schedule is planned, stock readiness is 100%, and the planned date is in the future.');
      }
      return;
    }
    this.planConfirmDialog = {
      open: true,
      title: 'Allocate stock early?',
      message: `Ingredients for "${plan.week_label}" (planned ${plan.planned_date}) will be issued from inventory now. This cannot be undone from this screen. Continue?`,
      confirmText: 'Allocate Stock',
      cancelText: 'Cancel',
      action: 'allocate',
      plan,
    };
  }

  editSchedule(plan: ProgramPlanSummary): void {
    this.openEditPlan(plan);
  }

  confirmDeletePlan(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    this.planConfirmDialog = {
      open: true,
      title: 'Delete Schedule',
      message: `Are you sure you want to delete "${plan.week_label}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      action: 'delete',
      plan: plan
    };
  }

  isStockReserved(plan: ProgramPlanSummary): boolean {
    return this.isStockAllocated(plan);
  }

  getItemsNeedingRestockCount(planId: number): number {
    const readiness = this.getStockReadiness(planId);
    if (!readiness || readiness.loading) {
      return 0;
    }
    return readiness.insufficient_items_count;
  }

  get allocatedPlans(): ProgramPlanSummary[] {
    return this.plans.filter((plan) => plan.status === 'ready');
  }

  // Recipe methods
  viewRecipeDetails(template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.selectedTemplateForDetails = template;
    this.loadTemplateDetails(template.template_id);
    this.showIngredientModal = true;
  }

  duplicateTemplate(template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.closeRecipeSidebarPanel();
    this.errorMessage = '';
    this.successMessage = '';
    this.loadingRecipeModal = true;
    this.templateModalMode = 'duplicate';
    this.duplicateSourceTemplateName = template.template_name;
    this.showNewRecipeModal = true;
    this.showTemplateForm = false;

    this.batchService.getTemplate(template.template_id).subscribe({
      next: (response) => {
        const details = response.data;
        this.showTemplateForm = true;
        this.isEditingTemplate = false;
        this.selectedTemplateId = null;
        this.selectedTemplateName = '';

        const originalName = details.template.template_name;
        const copyName = originalName.includes('(copy)')
          ? originalName
          : `${originalName} (copy)`;

        this.templateForm = {
          template_name: copyName,
          distribution_type: details.template.distribution_type,
          base_unit_count: details.template.base_unit_count,
          notes: details.template.notes ?? '',
          recipe_type_id: details.template.recipe_type_id ?? null,
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

  confirmDeleteTemplate(template: BatchDistributionTemplateSummary): void {
    this.closeTemplateMenu();
    this.templateConfirmDialog = {
      open: true,
      title: 'Delete Recipe',
      message: `Are you sure you want to delete "${template.template_name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      action: 'delete',
      template,
    };
  }

  closeTemplateConfirm(): void {
    this.templateConfirmDialog = {
      open: false,
      title: '',
      message: '',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      action: null,
      template: null,
    };
  }

  confirmTemplateDialogAction(): void {
    const action = this.templateConfirmDialog.action;
    if (action === 'save_stock_warning') {
      this.closeTemplateConfirm();
      this.performSaveTemplate();
      return;
    }

    const template = this.templateConfirmDialog.template;
    if (!template) {
      this.closeTemplateConfirm();
      return;
    }

    this.closeTemplateConfirm();
    this.deleteTemplate(template);
  }

  openNewRecipeModal(): void {
    this.templateModalMode = 'create';
    this.duplicateSourceTemplateName = null;
    this.loadingRecipeModal = false;
    this.showNewRecipeModal = true;
    this.showTemplateForm = true;
    this.isEditingTemplate = false;
    this.templateForm = {
      template_name: '',
      distribution_type: 'feeding_program',
      base_unit_count: 100,
      notes: '',
      recipe_type_id: null,
    };
    this.templateLines = [];
    this.lineDraftItemId = null;
    this.lineDraftQuantityPerBase = 1;
    this.lineDraftNotes = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();
  }

  closeNewRecipeModal(): void {
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

  // Execution modal methods
  startExecutionFlow(plan: ProgramPlanSummary): void {
    if (!this.showRunBatchAction(plan)) {
      this.toast.error('Run batch is available on or after the planned date for active schedules.');
      return;
    }
    if (!this.canRunBatch(plan)) {
      this.toast.error(
        this.getRunBatchDisabledReason(plan) ||
          'Cannot run this batch until stock readiness is 100%.',
      );
      return;
    }

    this.selectedPlanForExecution = { ...plan };
    this.executionIssuanceSummary = null;
    this.executionPlanDetails = null;
    this.executionDestination = '';
    this.executionReason = '';
    this.executionNotes = '';
    this.gapFillData = {};
    this.allGapsFilled = false;
    this.executingDistribution = false;
    this.executionIssuingStock = false;
    this.loadingExecutionDetails = false;

    if (this.isStockAllocated(plan)) {
      this.executionStep = 3;
      this.showExecutionModal = true;
      this.loadExecutionPlanDetails(plan.plan_id);
      return;
    }

    this.executionStep = 1;
    this.showExecutionModal = true;
    this.loadExecutionStockCheck(plan.plan_id);
    this.initializeGapFillData();
  }

  closeExecutionModal(): void {
    this.showExecutionModal = false;
    this.executionStep = 1;
    this.selectedPlanForExecution = null;
    this.executionStockCheck = null;
    this.executionPlanDetails = null;
    this.executionIssuanceSummary = null;
    this.executionRemainderLines = [];
    this.executionDestination = '';
    this.executionReason = '';
    this.executionNotes = '';
    this.gapFillData = {};
    this.allGapsFilled = false;
    this.executingDistribution = false;
    this.executionIssuingStock = false;
    this.loadingExecutionDetails = false;
  }

  proceedToFillGaps(): void {
    this.executionStep = 2;
    this.initializeGapFillData();
  }

  proceedToCompleteStep(): void {
    this.seedExecutionRemainderLines();
    this.executionStep = 3;
  }

  goBackToStockCheck(): void {
    this.executionStep = 1;
  }

  goBackToPreviousStep(): void {
    if (this.executionStep > 1) {
      this.executionStep = (this.executionStep - 1) as 1 | 2 | 3;
    }
  }

  confirmProcurementAndIssue(): void {
    const plan = this.selectedPlanForExecution;
    if (!plan) {
      return;
    }

    const issueFields = this.validateExecutionIssueFields();
    if (!issueFields) {
      return;
    }

    if (!this.allGapsFilled) {
      this.toast.error('Record procured quantities for all shortages before continuing.');
      return;
    }

    const procured_items = this.getShortageItems()
      .map((item) => ({
        item_id: item.item_id,
        quantity_brought: Math.floor(Number(this.gapFillData[item.item_id] || 0)),
        notes: this.executionNotes.trim() || undefined,
      }))
      .filter((line) => line.quantity_brought > 0);

    this.executionIssuingStock = true;
    this.batchService
      .runProgramFinalCheck(plan.plan_id, {
        procured_items,
        issue_destination: issueFields.destination,
        issue_reason: issueFields.reason,
        issue_notes: this.executionNotes.trim() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.executionIssuingStock = false;
          this.executionIssuanceSummary = response.data?.issuance ?? null;
          if (response.data?.check_result) {
            this.executionStockCheck = response.data.check_result;
          }
          this.applyExecutionPlanUpdate(plan.plan_id, 'ready');
          this.toast.success(response.message || 'Ingredients received and issued.');
          this.seedExecutionRemainderLines();
          this.executionStep = 3;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.executionIssuingStock = false;
          this.toast.error(err?.error?.message || 'Failed to receive and issue ingredients.');
          this.cdr.detectChanges();
        },
      });
  }

  issueStockForExecution(): void {
    const plan = this.selectedPlanForExecution;
    if (!plan || this.executionStockIssued) {
      return;
    }

    const issueFields = this.validateExecutionIssueFields();
    if (!issueFields) {
      return;
    }

    if (this.executionHasShortages) {
      this.toast.error('Resolve shortages in step 2 before issuing stock.');
      return;
    }

    this.executionIssuingStock = true;

    const onSuccess = (response: { message?: string; data?: ProgramPlanDetailsResponse }) => {
      this.executionIssuingStock = false;
      this.executionIssuanceSummary = response.data?.issuance ?? null;
      if (response.data?.inventory_check) {
        this.executionStockCheck = response.data.inventory_check;
        this.executionPlanDetails = response.data;
      }
      const nextStatus = (response.data?.plan?.status ?? 'ready') as ProgramPlanStatus;
      this.applyExecutionPlanUpdate(plan.plan_id, nextStatus);
      this.toast.success(response.message || 'Ingredients issued from inventory.');
      this.seedExecutionRemainderLines();
      this.cdr.detectChanges();
    };

    const onError = (err: { error?: { message?: string } }) => {
      this.executionIssuingStock = false;
      this.toast.error(err?.error?.message || 'Failed to issue ingredients.');
      this.cdr.detectChanges();
    };

    if (plan.status === 'planned') {
      this.batchService
        .reserveProgramPlan(plan.plan_id, {
          destination: issueFields.destination,
          reason: issueFields.reason,
          notes: this.executionNotes.trim() || undefined,
        })
        .subscribe({ next: onSuccess, error: onError });
      return;
    }

    this.batchService
      .runProgramFinalCheck(plan.plan_id, {
        issue_destination: issueFields.destination,
        issue_reason: issueFields.reason,
        issue_notes: this.executionNotes.trim() || undefined,
      })
      .subscribe({ next: onSuccess, error: onError });
  }

  completeBatchExecution(): void {
    const plan = this.selectedPlanForExecution;
    if (!plan) {
      return;
    }

    if (!this.executionStockIssued) {
      this.toast.error('Issue ingredients before completing the batch.');
      return;
    }

    const remaining_items = this.executionRemainderLines.map((line) => ({
      item_id: line.item_id,
      remaining_quantity: Number(line.remaining_quantity) || 0,
      notes: line.notes.trim() || undefined,
    }));

    this.executingDistribution = true;
    this.batchService
      .completeProgramPlan(plan.plan_id, {
        status: 'completed',
        remaining_items,
        issue_now: false,
      })
      .subscribe({
        next: (response) => {
          this.executingDistribution = false;
          const ref = this.executionIssuanceSummary?.reference_number;
          const message = response.message || (ref ? `Batch completed. Issuance: ${ref}` : 'Batch completed successfully.');
          this.toast.success(message);
          this.closeExecutionModal();
          this.loadPlans();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.executingDistribution = false;
          this.toast.error(err?.error?.message || 'Failed to complete batch.');
          this.cdr.detectChanges();
        },
      });
  }

  private applyExecutionPlanUpdate(planId: number, status: ProgramPlanStatus): void {
    if (this.selectedPlanForExecution?.plan_id === planId) {
      this.selectedPlanForExecution = { ...this.selectedPlanForExecution, status };
    }
    const index = this.plans.findIndex((p) => p.plan_id === planId);
    if (index >= 0) {
      this.plans[index] = { ...this.plans[index], status };
    }
  }

  private seedExecutionRemainderLines(): void {
    const items =
      this.executionPlanDetails?.inventory_check.items ??
      this.executionStockCheck?.items ??
      [];

    this.executionRemainderLines = items.map((line: ProgramPlanCheckItem) => ({
      item_id: line.item_id,
      item_code: line.item_code,
      item_description: line.item_description,
      remaining_quantity: 0,
      notes: '',
    }));
  }

  get executionHasShortages(): boolean {
    if (!this.executionStockCheck?.items) {
      return false;
    }
    return this.executionStockCheck.items.some((item: { has_shortage: boolean }) => item.has_shortage);
  }

  get canProceedFromStockCheck(): boolean {
    return !this.executionHasShortages;
  }

  get canCompleteProcurementStep(): boolean {
    return (
      !!this.executionReason.trim() &&
      this.allGapsFilled &&
      !this.executionIssuingStock
    );
  }

  get canIssueOnCompleteStep(): boolean {
    return (
      !!this.executionReason.trim() &&
      !this.executionHasShortages &&
      !this.executionIssuingStock
    );
  }

  get canSubmitBatchCompletion(): boolean {
    return this.executionStockIssued && !this.executingDistribution;
  }

  showStockShortageAlert(): void {
    this.toast.error('Cannot proceed — resolve stock shortages first.');
  }

  // Gap filling methods
  initializeGapFillData(): void {
    this.gapFillData = {};
    const shortageItems = this.getShortageItems();
    shortageItems.forEach(item => {
      this.gapFillData[item.item_id] = 0;
    });
    this.updateGapFillProgress();
  }

  getShortageItems(): any[] {
    if (!this.executionStockCheck) return [];
    return this.executionStockCheck.items.filter((item: any) => item.has_shortage);
  }

  trackByItemId(index: number, item: any): number {
    return item.item_id;
  }

  updateGapFillProgress(): void {
    const shortageItems = this.getShortageItems();
    this.allGapsFilled = shortageItems.every(item => {
      const filled = this.gapFillData[item.item_id] || 0;
      return filled >= item.shortage_quantity;
    });
  }

  getGapFillProgress(item: any): number {
    const filled = this.gapFillData[item.item_id] || 0;
    return (filled / item.shortage_quantity) * 100;
  }

  getRemainingGaps(): number {
    const shortageItems = this.getShortageItems();
    return shortageItems.filter(item => {
      const filled = this.gapFillData[item.item_id] || 0;
      return filled < item.shortage_quantity;
    }).length;
  }

  // Modal methods
  closeIngredientModal(): void {
    this.showIngredientModal = false;
    this.selectedTemplateForDetails = null;
    this.selectedTemplateDetails = null;
  }

  runRecipeFromDetails(): void {
    if (this.selectedTemplateForDetails) {
      this.closeIngredientModal();
      this.runRecipe(this.selectedTemplateForDetails);
    }
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

  viewCompletionSummary(plan: ProgramPlanSummary): void {
    this.viewPlanDetails(plan);
  }

  // Plan actions
  deletePlan(plan: ProgramPlanSummary): void {
    if (this.executingPlanId) {
      return;
    }

    this.executingPlanId = plan.plan_id;
    this.batchService.deleteProgramPlan(plan.plan_id).subscribe({
      next: (response) => {
        this.executingPlanId = null;
        this.toast.success(response.message || `Deleted plan: ${plan.week_label}`);
        this.removePlanLocal(plan.plan_id);
        this.loadPlans();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.executingPlanId = null;
        this.toast.error(err?.error?.message || 'Failed to delete plan.');
        this.cdr.detectChanges();
      }
    });
  }

  // API methods
  loadExecutionStockCheck(planId: number): void {
    this.loadingExecutionDetails = true;
    this.batchService.runProgramPrecheck(planId).subscribe({
      next: (response) => {
        this.loadingExecutionDetails = false;
        this.executionStockCheck = response.data?.check_result ?? response.data;
        this.applyExecutionPlanUpdate(planId, 'checked_pre');
        this.initializeGapFillData();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingExecutionDetails = false;
        this.toast.error(err?.error?.message || 'Failed to load stock check');
        this.closeExecutionModal();
      },
    });
  }

  loadExecutionPlanDetails(planId: number): void {
    this.loadingExecutionDetails = true;
    this.batchService.getProgramPlan(planId).subscribe({
      next: (response) => {
        this.loadingExecutionDetails = false;
        this.executionPlanDetails = response.data;
        this.executionStockCheck = response.data.inventory_check;
        this.seedExecutionRemainderLines();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingExecutionDetails = false;
        this.toast.error(err?.error?.message || 'Failed to load batch details');
        this.closeExecutionModal();
      },
    });
  }

  loadTemplateDetails(templateId: number): void {
    this.batchService.getTemplate(templateId).subscribe({
      next: (response) => {
        this.selectedTemplateDetails = response.data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toast.error('Failed to load recipe details');
        this.closeIngredientModal();
      }
    });
  }

  loadStockReservations(): void {
    this.stockReservations = this.allocatedPlans.map((plan) => ({
      item_code: plan.week_label,
      item_description: plan.template_name,
      unit: plan.planned_date,
      total_stock: plan.target_unit_count,
      reserved_amount: 'Allocated',
      available: plan.status,
      plan_id: plan.plan_id,
    }));
    this.groupedReservations = [];
    this.selectedReservationDetails = null;
  }
}
