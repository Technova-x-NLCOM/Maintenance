/**
 * Schedule / Distribution Plan mixin for BatchDistributionComponent.
 *
 * Contains all state and methods related to creating, editing, running and
 * completing distribution plan schedules, including the calendar view.
 */
import { ChangeDetectorRef } from '@angular/core';
import {
  BatchDistributionCalculation,
  BatchDistributionService,
  BatchDistributionTemplateSummary,
  DistributionType,
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import {
  EditableProcuredLine,
  EditableRemainingLine,
  PlanConfirmDialog,
  StockReadinessEntry,
} from './batch-distribution-types';

export abstract class BatchDistributionPlanMixin {
  protected abstract batchService: BatchDistributionService;
  protected abstract cdr: ChangeDetectorRef;
  protected abstract toast: ToastService;

  // ── shared template state (provided by template mixin) ───────────────────
  abstract templates: BatchDistributionTemplateSummary[];

  // ── plan list state ──────────────────────────────────────────────────────
  loadingPlans = false;
  savingPlan = false;
  loadingPlanDetails = false;
  runningPlanAction = false;
  completingPlan = false;

  plans: ProgramPlanSummary[] = [];
  selectedPlanId: number | null = null;
  selectedPlanDetails: ProgramPlanDetailsResponse | null = null;
  planIssueSummary: ProgramPlanDetailsResponse['issuance'] | null = null;

  planForm: {
    template_id: number | null;
    week_label: string;
    planned_date: string;
    target_unit_count: number;
    preferred_location_id: number | null;
    notes: string;
  } = {
    template_id: null,
    week_label: '',
    planned_date: '',
    target_unit_count: 100,
    preferred_location_id: null,
    notes: '',
  };

  planIssueDestination = '';
  planIssueReason = '';
  planIssueNotes = '';
  planFinalCheckAttempted = false;
  planRemainingLines: EditableRemainingLine[] = [];
  planProcuredLines: EditableProcuredLine[] = [];
  planWizardStep: 1 | 2 | 3 = 1;

  showPlanDetailsModal = false;
  showScheduleDialog = false;
  scheduleDialogStep: 1 | 2 = 1;
  showRecipeSidebar = false;

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
  scheduleFilter: 'upcoming' | 'completed' | 'all' = 'upcoming';

  planViewMode: 'list' | 'calendar' = 'list';
  calendarCurrentDate: Date = new Date();
  calendarDays: Array<{ date: Date; isCurrentMonth: boolean; plans: ProgramPlanSummary[] }> = [];

  planStockReadiness: Map<number, StockReadinessEntry> = new Map();
  planSearchTerm = '';

  currentPlanPage = 1;
  planPageSize = 10;
  readonly planPageSizeOptions = [5, 10, 25, 50];

  showStockAllocationModal = false;
  stockReservations: any[] = [];
  groupedReservations: any[] = [];
  selectedReservationDetails: any = null;

  planConfirmDialog: PlanConfirmDialog = {
    open: false, title: '', message: '',
    confirmText: 'Confirm', cancelText: 'Cancel',
    action: null, plan: null,
  };

  /** Shared calculating flag — also used by template mixin for schedule step. */
  abstract calculating: boolean;

  protected lastLoadedPlansParams: { status?: ProgramPlanStatus; from_date?: string; to_date?: string } = {};

  // ── computed getters ─────────────────────────────────────────────────────

  get planTargetCountLabel(): string {
    const t = this.templates.find((t) => t.template_id === this.planForm.template_id) ?? this.schedulingTemplate;
    if (t?.distribution_type === 'relief_goods') return 'Number of Relief Packs';
    if (t?.distribution_type === 'feeding_program') return 'Target Attendees';
    return 'Target Count';
  }

  get planWizardTitle(): string {
    switch (this.planWizardStep) {
      case 1: return 'Review Shortages';
      case 2: return 'Receive Missing Items';
      case 3: return 'Execute Distribution';
      default: return 'Review Shortages';
    }
  }

  get filteredPlans(): ProgramPlanSummary[] {
    let filtered = this.plans;
    if (this.planStatusFilter !== 'all') filtered = filtered.filter((p) => p.status === this.planStatusFilter);
    if (this.planSearchTerm.trim()) {
      const s = this.planSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((p) => p.week_label.toLowerCase().includes(s) || p.template_name.toLowerCase().includes(s));
    }
    return filtered.slice().sort((a, b) => {
      const aDate = new Date(a.planned_date).getTime();
      const bDate = new Date(b.planned_date).getTime();
      return this.planSortDirection === 'desc' ? bDate - aDate : aDate - bDate;
    });
  }

  get displayedPlans(): ProgramPlanSummary[] {
    let filtered = this.filteredPlans;
    if (this.scheduleFilter === 'upcoming') filtered = filtered.filter((p) => p.status !== 'completed' && p.status !== 'cancelled');
    else if (this.scheduleFilter === 'completed') filtered = filtered.filter((p) => p.status === 'completed');
    return filtered;
  }

  get scheduleHasWarning(): boolean {
    return !!this.schedulingCalculation?.items.some((row) => this.getRowShortageQuantity(row) > 0);
  }

  /** Provided by template mixin via applyMixins — declared here so plan mixin can call it. */
  getRowShortageQuantity(_row: { quantity_per_base: number; current_stock: number; shortage_quantity?: number }): number { return 0; /* overridden by template mixin */ }

  get calendarMonthName(): string {
    return this.calendarCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  get calendarWeekDays(): string[] { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; }

  get totalPlanPages(): number { return Math.ceil(this.filteredPlans.length / this.planPageSize) || 1; }

  get paginatedPlans(): ProgramPlanSummary[] {
    const start = (this.currentPlanPage - 1) * this.planPageSize;
    return this.filteredPlans.slice(start, start + this.planPageSize);
  }

  get isPlanDialogEditing(): boolean { return this.planDialogMode === 'edit'; }
  get allocatedPlans(): ProgramPlanSummary[] { return this.plans.filter((p) => p.status === 'ready'); }

  // ── plan status helpers ──────────────────────────────────────────────────

  isStockAllocated(plan: ProgramPlanSummary): boolean { return plan.status === 'ready'; }
  isStockReserved(plan: ProgramPlanSummary): boolean { return this.isStockAllocated(plan); }

  hasPlanFullStockReadiness(plan: ProgramPlanSummary): boolean {
    const r = this.getStockReadiness(plan.plan_id);
    if (!r || r.loading) return false;
    return r.can_proceed || r.percentage >= 100;
  }

  canAllocateStock(plan: ProgramPlanSummary): boolean {
    return plan.status === 'planned' && this.hasPlanFullStockReadiness(plan);
  }

  isPlanRunDateReached(plan: ProgramPlanSummary): boolean {
    return this.normalizeDate(plan.planned_date) <= this.normalizeDate(new Date().toISOString().slice(0, 10));
  }

  isPlanScheduledToday(plan: ProgramPlanSummary): boolean {
    return this.normalizeDate(plan.planned_date) === this.normalizeDate(new Date().toISOString().slice(0, 10));
  }

  canAllocateEarly(plan: ProgramPlanSummary): boolean {
    if (!this.canAllocateStock(plan)) return false;
    return this.normalizeDate(plan.planned_date) > this.normalizeDate(new Date().toISOString().slice(0, 10));
  }

  showRunBatchAction(plan: ProgramPlanSummary): boolean {
    if (plan.status === 'completed' || plan.status === 'cancelled') return false;
    if (!['planned', 'checked_pre', 'ready'].includes(plan.status)) return false;
    return this.isPlanRunDateReached(plan);
  }

  canRunBatch(plan: ProgramPlanSummary): boolean {
    if (!this.showRunBatchAction(plan)) return false;
    if (this.isStockAllocated(plan)) return true;
    return this.hasPlanFullStockReadiness(plan);
  }

  getRunBatchDisabledReason(plan: ProgramPlanSummary): string {
    if (!this.showRunBatchAction(plan) || this.canRunBatch(plan)) return '';
    if (!this.hasPlanFullStockReadiness(plan)) return 'Stock readiness must be 100% before you can run this batch.';
    return '';
  }

  planBlocksRunAndAllocate(plan: ProgramPlanSummary): boolean {
    return plan.status === 'planned' && !this.hasPlanFullStockReadiness(plan);
  }

  /** @deprecated Use canRunBatch */
  isPlanExecutable(plan: ProgramPlanSummary): boolean { return this.canRunBatch(plan); }

  getRunBatchButtonLabel(plan: ProgramPlanSummary): string {
    return this.isStockAllocated(plan) ? 'Mark as complete' : '▶ Run Batch';
  }

  isPlanOverdue(plan: ProgramPlanSummary): boolean {
    if (plan.status === 'completed' || plan.status === 'cancelled') return false;
    return this.normalizeDate(plan.planned_date) < this.normalizeDate(new Date().toISOString().slice(0, 10)) && plan.status !== 'ready';
  }

  isPlanLocked(plan: ProgramPlanSummary): boolean {
    return plan.status === 'completed' || plan.status === 'cancelled';
  }

  getPlanBadge(plan: ProgramPlanSummary): { label: string; className: string; icon: string } {
    if (this.isPlanOverdue(plan)) return { label: 'Overdue', className: 'status-overdue', icon: 'ti-alert-circle' };
    switch (plan.status) {
      case 'cancelled': return { label: 'Cancelled', className: 'status-cancelled', icon: 'ti-ban' };
      case 'completed': return { label: 'Completed', className: 'status-completed', icon: 'ti-circle-check' };
      case 'ready': return { label: 'Stock Allocated', className: 'status-ready', icon: 'ti-package' };
      case 'checked_pre': return { label: 'Pre-checked', className: 'status-checked-pre', icon: 'ti-clipboard-check' };
      default: return { label: 'Planned', className: 'status-planned', icon: 'ti-clock' };
    }
  }

  getPlanStatusClass(status: ProgramPlanStatus | string): string {
    const map: Record<string, string> = { planned: 'tag-planned', checked_pre: 'tag-checked-pre', ready: 'tag-ready', cancelled: 'tag-cancelled', completed: 'tag-completed' };
    return map[status] ?? '';
  }

  // ── data loading ─────────────────────────────────────────────────────────

  loadPlans(): void {
    this.loadingPlans = true;
    const params = this.getCurrentPlansQueryParams();
    this.lastLoadedPlansParams = { ...params };
    this.batchService.listProgramPlans(params).subscribe({
      next: (response) => {
        this.plans = response.data;
        this.loadingPlans = false;
        if (this.selectedPlanId && !this.plans.some((p) => p.plan_id === this.selectedPlanId)) {
          this.selectedPlanId = null;
          this.selectedPlanDetails = null;
          this.planIssueSummary = null;
          this.planProcuredLines = [];
        }
        this.buildCalendar();
        this.loadStockReadinessForPlans();
        this.cdr.detectChanges();
      },
      error: (err) => { this.loadingPlans = false; this.toast.error(err?.error?.message || 'Failed to load scheduled plans.'); this.cdr.detectChanges(); },
    });
  }

  private getCurrentPlansQueryParams(): { status?: ProgramPlanStatus; from_date?: string; to_date?: string } {
    const params: { status?: ProgramPlanStatus; from_date?: string; to_date?: string } = {};
    if (this.planStatusFilter !== 'all') params.status = this.planStatusFilter;
    if (this.planViewMode === 'calendar') {
      const firstDay = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth(), 1);
      const lastDay = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth() + 1, 0);
      params.from_date = this.formatDateForApi(firstDay);
      params.to_date = this.formatDateForApi(lastDay);
    }
    return params;
  }

  protected loadPlansUsingLastParams(preferredPlan?: ProgramPlanSummary): void {
    this.loadingPlans = true;
    const params = this.lastLoadedPlansParams ?? {};
    this.batchService.listProgramPlans(params).subscribe({
      next: (response) => {
        this.plans = response.data;
        if (preferredPlan && !this.plans.some((p) => p.plan_id === preferredPlan.plan_id)) this.plans = [preferredPlan, ...this.plans];
        this.loadingPlans = false;
        this.buildCalendar();
        this.loadStockReadinessForPlans();
        this.cdr.detectChanges();
      },
      error: (err) => { this.loadingPlans = false; this.toast.error(err?.error?.message || 'Failed to load scheduled plans.'); this.cdr.detectChanges(); },
    });
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
      error: (err) => { this.loadingPlanDetails = false; this.toast.error(err?.error?.message || 'Failed to load selected plan details.'); this.cdr.detectChanges(); },
    });
  }

  // ── plan create / update ─────────────────────────────────────────────────

  openScheduleDialog(): void {
    this.showScheduleDialog = true;
    this.planDialogMode = 'create';
    this.editingPlanId = null;
    this.scheduleDialogStep = 1;
    this.resetPlanForm();
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
    if (this.isPlanDialogEditing) { this.updatePlanLocal(); return; }
    if (this.scheduleDialogStep === 1) { this.validateScheduleStep(); return; }
    if (this.scheduleDialogStep === 2) { this.createScheduleFromRecipe(); }
  }

  validateScheduleStep(): void {
    if (!this.planForm.template_id) { this.toast.error('Please select a recipe.'); return; }
    if (!this.schedulePlannedDate) { this.toast.error('Please select a planned date.'); return; }
    const target = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(target) || target <= 0) { this.toast.error('Target servings must be greater than zero.'); return; }
    if (this.scheduleReason.length > 250) { this.toast.error('Reason must be 250 characters or less.'); return; }
    if (this.scheduleDestination.length > 150) { this.toast.error('Destination must be 150 characters or less.'); return; }
    this.calculating = true;
    this.batchService.calculate(this.planForm.template_id, target).subscribe({
      next: (response) => { this.calculating = false; this.schedulingCalculation = response.data; this.scheduleDialogStep = 2; this.cdr.detectChanges(); },
      error: (err) => { this.calculating = false; this.toast.error(err?.error?.message || 'Failed to validate schedule requirements.'); this.cdr.detectChanges(); },
    });
  }

  createScheduleFromRecipe(): void {
    if (!this.planForm.template_id) return;
    const target = Math.floor(Number(this.planForm.target_unit_count));
    this.savingPlan = true;
    const weekLabel = (this.schedulingTemplate?.template_name || 'Scheduled Batch').trim();
    const stitchedNotes = [
      this.scheduleNotes ? this.scheduleNotes : '',
    ].filter(Boolean).join(' | ');
    this.batchService.createProgramPlan({
      template_id: this.planForm.template_id,
      week_label: weekLabel.slice(0, 50),
      planned_date: this.schedulePlannedDate,
      target_unit_count: target,
      preferred_location_id: this.planForm.preferred_location_id ?? undefined,
      notes: stitchedNotes || undefined,
    }).subscribe({
      next: () => {
        this.savingPlan = false;
        this.toast.success('Schedule created successfully.');
        this.closeScheduleDialog();
        this.closeRecipeSidebarPanel();
        this.loadPlans();
      },
      error: (err) => { this.savingPlan = false; this.toast.error(err?.error?.message || 'Failed to create schedule.'); this.cdr.detectChanges(); },
    });
  }

  createPlan(): void {
    if (!this.planForm.template_id || !this.planForm.week_label.trim() || !this.planForm.planned_date) {
      this.toast.error('Please fill out all required fields (*)'); return;
    }
    const target = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(target) || target <= 0) { this.toast.error('Target count must be greater than zero.'); return; }
    this.savingPlan = true;
    this.batchService.createProgramPlan({ template_id: this.planForm.template_id, week_label: this.planForm.week_label.trim(), planned_date: this.planForm.planned_date, target_unit_count: target, preferred_location_id: this.planForm.preferred_location_id ?? undefined, notes: this.planForm.notes.trim() || undefined }).subscribe({
      next: (response) => {
        this.savingPlan = false;
        this.toast.success(response.message || 'Distribution Plan created successfully.');
        this.selectedPlanId = response.data.plan.plan_id;
        this.selectedPlanDetails = response.data;
        this.planIssueSummary = response.data.issuance ?? null;
        this.seedRemainingLinesFromCurrentDetails();
        this.seedProcuredLinesFromCurrentDetails();
        this.syncPlanWizardStep(response.data.plan.status);
        this.scheduleDialogStep = 2;
        this.currentPlanPage = 1;
        this.loadPlansUsingLastParams(response.data.plan);
      },
      error: (err) => { this.savingPlan = false; this.toast.error(err?.error?.message || 'Failed to create program plan.'); this.cdr.detectChanges(); },
    });
  }

  private updatePlanLocal(): void {
    if (!this.editingPlanId || !this.planForm.template_id || !this.planForm.week_label.trim() || !this.planForm.planned_date) {
      this.toast.error('Please fill out all required fields (*)'); return;
    }
    const target = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(target) || target <= 0) { this.toast.error('Target count must be greater than zero.'); return; }
    const planId = this.editingPlanId;
    this.savingPlan = true;
    this.batchService.updateProgramPlanSchedule(planId, { template_id: this.planForm.template_id as number, week_label: this.planForm.week_label.trim(), planned_date: this.planForm.planned_date, target_unit_count: target, preferred_location_id: this.planForm.preferred_location_id ?? undefined, notes: this.planForm.notes.trim() || undefined }).subscribe({
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
      error: (err) => { this.savingPlan = false; this.toast.error(err?.error?.message || 'Failed to update schedule.'); this.cdr.detectChanges(); },
    });
  }

  // ── plan actions (run / complete / cancel / delete) ──────────────────────

  reservePlan(plan: ProgramPlanSummary): void {
    if (this.reservingPlanId) return;
    if (!this.hasPlanFullStockReadiness(plan)) { this.toast.error('Cannot reserve until all ingredients have sufficient stock for this schedule.'); return; }
    this.reservingPlanId = plan.plan_id;
    this.batchService.reserveProgramPlan(plan.plan_id, { destination: `Reserved for ${plan.week_label}`, reason: 'Inventory Reservation', notes: 'Reserved from Recipe & Distribution' }).subscribe({
      next: () => { this.reservingPlanId = null; this.toast.success('Inventory reserved successfully.'); this.loadPlans(); },
      error: (err) => { this.reservingPlanId = null; this.toast.error(err?.error?.message || 'Failed to reserve inventory.'); this.cdr.detectChanges(); },
    });
  }

  completePlan(): void {
    if (!this.selectedPlanId || this.completingPlan) return;
    const remaining_items = this.planRemainingLines.filter((l) => Number.isFinite(l.remaining_quantity) && l.remaining_quantity >= 0).map((l) => ({ item_id: l.item_id, remaining_quantity: Number(l.remaining_quantity), notes: l.notes.trim() || undefined }));
    this.runningPlanAction = true;
    this.completingPlan = true;
    this.batchService.completeProgramPlan(this.selectedPlanId, { status: 'completed', remaining_items }).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.completingPlan = false;
        this.selectedPlanDetails = response.data;
        this.planIssueSummary = response.data.issuance ?? this.planIssueSummary;
        this.toast.success(response.message || 'Batch distribution completed successfully.');
        this.loadPlans();
        this.seedRemainingLinesFromCurrentDetails();
        this.seedProcuredLinesFromCurrentDetails();
        this.planWizardStep = 3;
        this.cdr.detectChanges();
      },
      error: (err) => { this.runningPlanAction = false; this.completingPlan = false; this.toast.error(err?.error?.message || 'Failed to complete plan.'); this.cdr.detectChanges(); },
    });
  }

  executePlan(plan: ProgramPlanSummary): void {
    if (this.executingPlanId) return;
    this.executingPlanId = plan.plan_id;
    this.batchService.completeProgramPlan(plan.plan_id, { status: 'completed' }).subscribe({
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
      error: (err) => { this.executingPlanId = null; this.toast.error(err?.error?.message || 'Failed to complete plan.'); this.cdr.detectChanges(); },
    });
  }

  cancelPlan(plan: ProgramPlanSummary): void {
    if (this.executingPlanId) return;
    this.executingPlanId = plan.plan_id;
    this.batchService.completeProgramPlan(plan.plan_id, { status: 'cancelled' }).subscribe({
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
      error: (err) => { this.executingPlanId = null; this.toast.error(err?.error?.message || 'Failed to cancel plan.'); this.cdr.detectChanges(); },
    });
  }

  deletePlan(plan: ProgramPlanSummary): void {
    if (this.executingPlanId) return;
    this.executingPlanId = plan.plan_id;
    this.batchService.deleteProgramPlan(plan.plan_id).subscribe({
      next: (response: any) => {
        this.executingPlanId = null;
        this.toast.success(response.message || `Deleted plan: ${plan.week_label}`);
        this.removePlanLocal(plan.plan_id);
        this.loadPlans();
        this.cdr.detectChanges();
      },
      error: (err: any) => { this.executingPlanId = null; this.toast.error(err?.error?.message || 'Failed to delete plan.'); this.cdr.detectChanges(); },
    });
  }

  runPlanPrecheck(advanceStep = false): void {
    if (!this.selectedPlanId) return;
    this.runningPlanAction = true;
    this.batchService.runProgramPrecheck(this.selectedPlanId).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.toast.success(response.message || 'Precheck completed.');
        this.loadPlanDetails(this.selectedPlanId!);
        this.loadPlans();
        if (advanceStep) this.planWizardStep = 2;
      },
      error: (err) => { this.runningPlanAction = false; this.toast.error(err?.error?.message || 'Failed to run precheck.'); this.cdr.detectChanges(); },
    });
  }

  runPlanFinalCheck(advanceStep = false): void {
    if (!this.selectedPlanId) return;
    this.planFinalCheckAttempted = true;
    if (this.planIssueReason.length > 250) { this.toast.error('Reason must be 250 characters or less.'); return; }
    if (this.planIssueDestination.length > 150) { this.toast.error('Destination must be 150 characters or less.'); return; }
    const procured_items = this.planProcuredLines.filter((l) => Number.isFinite(l.quantity_brought) && l.quantity_brought > 0).map((l) => ({ item_id: l.item_id, quantity_brought: Math.floor(Number(l.quantity_brought)), notes: l.notes.trim() || undefined }));
    this.runningPlanAction = true;
    this.batchService.runProgramFinalCheck(this.selectedPlanId!, { procured_items, issue_destination: this.planIssueDestination.trim() || undefined, issue_reason: this.planIssueReason.trim() || undefined, issue_notes: this.planIssueNotes.trim() || undefined }).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.toast.success(response.message || 'Final check completed with receiving and issuance.');
        this.loadPlanDetails(this.selectedPlanId!);
        this.loadPlans();
        if (advanceStep) this.planWizardStep = 3;
      },
      error: (err) => { this.runningPlanAction = false; this.toast.error(err?.error?.message || 'Failed to run final check.'); this.cdr.detectChanges(); },
    });
  }

  // ── plan UI actions ──────────────────────────────────────────────────────

  selectPlan(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    if (this.expandedPlanId === plan.plan_id) {
      this.expandedPlanId = null; this.selectedPlanId = null; this.selectedPlanDetails = null;
      this.planIssueSummary = null; this.planProcuredLines = []; this.planRemainingLines = []; return;
    }
    this.expandedPlanId = plan.plan_id;
    this.selectedPlanId = plan.plan_id;
    this.planFinalCheckAttempted = false;
    this.loadPlanDetails(plan.plan_id);
  }

  togglePlanExpansion(plan: ProgramPlanSummary, event: Event): void { event.stopPropagation(); this.selectPlan(plan); }
  isPlanExpanded(planId: number): boolean { return this.expandedPlanId === planId; }

  viewPlanDetails(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    this.selectedPlanId = plan.plan_id;
    this.showPlanDetailsModal = true;
    this.loadPlanDetails(plan.plan_id);
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

  handlePlanStepOneNext(): void { if (!this.selectedPlanId || this.runningPlanAction) return; this.runPlanPrecheck(true); }
  handlePlanStepTwoNext(): void { if (!this.selectedPlanId || this.runningPlanAction) return; this.runPlanFinalCheck(true); }

  goToPlanStep(step: 1 | 2 | 3): void { if (step < this.planWizardStep) this.planWizardStep = step; }

  openEditPlan(plan: ProgramPlanSummary): void {
    if (this.isPlanLocked(plan)) return;
    this.closePlanMenu();
    this.planDialogMode = 'edit';
    this.editingPlanId = plan.plan_id;
    this.scheduleDialogStep = 1;
    this.schedulingTemplate = this.templates.find((t) => t.template_id === plan.template_id) ?? null;
    this.schedulingCalculation = null;
    this.planForm = { template_id: plan.template_id, week_label: plan.week_label, planned_date: plan.planned_date, target_unit_count: plan.target_unit_count, preferred_location_id: plan.preferred_location_id ?? null, notes: plan.notes ?? '' };
    this.schedulePlannedDate = plan.planned_date;
    this.showScheduleDialog = true;
  }

  editSchedule(plan: ProgramPlanSummary): void { this.openEditPlan(plan); }

  openPlanConfirm(action: 'cancel' | 'delete' | 'execute', plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    const configs: Record<string, Omit<PlanConfirmDialog, 'open' | 'plan'>> = {
      cancel: { title: 'Cancel this plan?', message: 'This will mark the plan as cancelled. This action cannot be undone.', confirmText: 'Yes, cancel plan', cancelText: 'No', action: 'cancel' },
      delete: { title: 'Delete this plan?', message: 'This will permanently remove the record. This cannot be undone.', confirmText: 'Yes, delete', cancelText: 'No', action: 'delete' },
      execute: { title: 'Mark this plan as completed?', message: 'This will log the distribution and update stock levels. This cannot be undone.', confirmText: 'Yes, complete plan', cancelText: 'No', action: 'execute' },
    };
    this.planConfirmDialog = { open: true, plan, ...configs[action] };
  }

  closePlanConfirm(): void {
    this.planConfirmDialog = { open: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', action: null, plan: null };
  }

  confirmPlanAction(): void {
    const { action, plan } = this.planConfirmDialog;
    if (!action || !plan) { this.closePlanConfirm(); return; }
    if (action === 'delete') { this.deletePlan(plan); this.closePlanConfirm(); return; }
    if (action === 'cancel') { this.cancelPlan(plan); this.closePlanConfirm(); return; }
    if (action === 'allocate') { this.closePlanConfirm(); this.reservePlan(plan); return; }
    this.executePlan(plan);
    this.closePlanConfirm();
  }

  confirmDeletePlan(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    this.planConfirmDialog = { open: true, title: 'Delete Schedule', message: `Are you sure you want to delete "${plan.week_label}"? This action cannot be undone.`, confirmText: 'Delete', cancelText: 'Cancel', action: 'delete', plan };
  }

  reserveStockForPlan(plan: ProgramPlanSummary): void {
    this.closePlanMenu();
    if (!this.canAllocateEarly(plan)) {
      if (this.isPlanScheduledToday(plan) && this.canAllocateStock(plan)) this.toast.error('On the planned date, use Run Batch to issue stock instead of allocating early.');
      else this.toast.error('Allocate stock only when the schedule is planned, stock readiness is 100%, and the planned date is in the future.');
      return;
    }
    this.planConfirmDialog = { open: true, title: 'Allocate stock early?', message: `Ingredients for "${plan.week_label}" (planned ${plan.planned_date}) will be issued from inventory now. This cannot be undone from this screen. Continue?`, confirmText: 'Allocate Stock', cancelText: 'Cancel', action: 'allocate', plan };
  }

  togglePlanMenu(planId: number, event: Event): void { event.stopPropagation(); this.openPlanMenuId = this.openPlanMenuId === planId ? null : planId; }
  closePlanMenu(): void { this.openPlanMenuId = null; }

  togglePlanSortDirection(): void { this.planSortDirection = this.planSortDirection === 'desc' ? 'asc' : 'desc'; this.currentPlanPage = 1; }
  onPlanStatusFilterChange(): void { this.currentPlanPage = 1; this.loadPlans(); }
  onPlanSearchInput(): void { this.currentPlanPage = 1; }
  clearPlanSearch(): void { this.planSearchTerm = ''; this.currentPlanPage = 1; }

  goToFirstPage(): void { this.currentPlanPage = 1; }
  goToPreviousPlanPage(): void { if (this.currentPlanPage > 1) this.currentPlanPage--; }
  goToNextPlanPage(): void { if (this.currentPlanPage < this.totalPlanPages) this.currentPlanPage++; }
  goToLastPage(): void { this.currentPlanPage = this.totalPlanPages; }
  onPlanPageSizeChange(): void { this.currentPlanPage = 1; }

  viewCompletionSummary(plan: ProgramPlanSummary): void { this.viewPlanDetails(plan); }

  openRecipeSidebarPanel(): void { this.showRecipeSidebar = true; }
  closeRecipeSidebarPanel(): void { this.showRecipeSidebar = false; }

  openStockReservationsModal(): void { this.loadStockReservations(); this.showStockAllocationModal = true; }
  closeStockAllocationModal(): void { this.showStockAllocationModal = false; this.selectedReservationDetails = null; this.groupedReservations = []; }

  getItemsNeedingRestockCount(planId: number): number {
    const r = this.getStockReadiness(planId);
    return (!r || r.loading) ? 0 : r.insufficient_items_count;
  }

  // ── calendar ─────────────────────────────────────────────────────────────

  setPlanViewMode(mode: 'list' | 'calendar'): void {
    this.planViewMode = mode;
    this.showScheduleDialog = false;
    this.scheduleDialogStep = 1;
    this.planFinalCheckAttempted = false;
    this.openPlanMenuId = null;
    this.planConfirmDialog.open = false;
    this.selectedPlanId = null;
    this.selectedPlanDetails = null;
    this.expandedPlanId = null;
    this.planWizardStep = 1;
    this.buildCalendar();
    this.loadPlans();
  }

  buildCalendar(): void {
    const year = this.calendarCurrentDate.getFullYear();
    const month = this.calendarCurrentDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const days: Array<{ date: Date; isCurrentMonth: boolean; plans: ProgramPlanSummary[] }> = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date, isCurrentMonth: false, plans: this.getPlansForDate(date) });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({ date, isCurrentMonth: true, plans: this.getPlansForDate(date) });
    }
    for (let day = 1; days.length < 42; day++) {
      const date = new Date(year, month + 1, day);
      days.push({ date, isCurrentMonth: false, plans: this.getPlansForDate(date) });
    }
    this.calendarDays = days;
  }

  getPlansForDate(date: Date): ProgramPlanSummary[] {
    const dateStr = this.formatDateForApi(date);
    let filtered = this.plans.filter((p) => p.planned_date === dateStr);
    if (this.planStatusFilter !== 'all') filtered = filtered.filter((p) => p.status === this.planStatusFilter);
    if (this.planSearchTerm.trim()) {
      const s = this.planSearchTerm.toLowerCase().trim();
      filtered = filtered.filter((p) => p.week_label.toLowerCase().includes(s) || p.template_name.toLowerCase().includes(s));
    }
    return filtered;
  }

  goToPreviousMonth(): void { this.calendarCurrentDate = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth() - 1, 1); this.buildCalendar(); this.loadPlans(); }
  goToNextMonth(): void { this.calendarCurrentDate = new Date(this.calendarCurrentDate.getFullYear(), this.calendarCurrentDate.getMonth() + 1, 1); this.buildCalendar(); this.loadPlans(); }
  goToToday(): void { this.calendarCurrentDate = new Date(); this.buildCalendar(); this.loadPlans(); }

  isToday(date: Date): boolean {
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  }

  formatDateForApi(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  get todayDateString(): string {
    return this.formatDateForApi(new Date());
  }

  openPlanFromCalendar(plan: ProgramPlanSummary, event: Event): void { event.stopPropagation(); this.selectPlan(plan); }

  // ── stock readiness ──────────────────────────────────────────────────────

  loadStockReadinessForPlans(): void {
    const plannedPlans = this.plans.filter((p) => p.status === 'planned');
    plannedPlans.forEach((plan) => {
      this.planStockReadiness.set(plan.plan_id, { required: 0, available: 0, line_count: 0, ready_line_count: 0, insufficient_items_count: 0, percentage: 0, can_proceed: false, status: 'loading', loading: true });
      this.batchService.getStockReadiness(plan.plan_id).subscribe({
        next: (response) => { this.planStockReadiness.set(plan.plan_id, { ...response.data, loading: false }); this.cdr.detectChanges(); },
        error: () => { this.planStockReadiness.set(plan.plan_id, { required: 0, available: 0, line_count: 0, ready_line_count: 0, insufficient_items_count: 0, percentage: 0, can_proceed: false, status: 'error', loading: false }); this.cdr.detectChanges(); },
      });
    });
  }

  getStockReadiness(planId: number): StockReadinessEntry | null { return this.planStockReadiness.get(planId) || null; }

  getStockReadinessLabel(planId: number): string {
    const r = this.getStockReadiness(planId);
    if (!r || r.loading) return 'Loading...';
    return r.line_count > 0 ? `${r.percentage}% (${r.ready_line_count}/${r.line_count} ingredients ready)` : `${r.percentage}%`;
  }

  getStockReadinessColor(percentage: number): string {
    if (percentage >= 100) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  }

  getStockReadinessBarClass(percentage: number): string {
    if (percentage >= 100) return 'stock-bar-ready';
    if (percentage >= 50) return 'stock-bar-partial';
    return 'stock-bar-insufficient';
  }

  // ── private helpers ──────────────────────────────────────────────────────

  protected seedRemainingLinesFromCurrentDetails(): void {
    const d = this.selectedPlanDetails;
    if (!d) { this.planRemainingLines = []; return; }
    if (d.remaining_items && d.remaining_items.length > 0) {
      this.planRemainingLines = d.remaining_items.map((l: any) => ({ item_id: l.item_id, item_code: l.item_code, item_description: l.item_description, remaining_quantity: Number(l.remaining_quantity) || 0, notes: l.notes || '' })); return;
    }
    this.planRemainingLines = d.inventory_check.items.map((l: any) => ({ item_id: l.item_id, item_code: l.item_code, item_description: l.item_description, remaining_quantity: 0, notes: '' }));
  }

  protected seedProcuredLinesFromCurrentDetails(): void {
    const d = this.selectedPlanDetails;
    if (!d) { this.planProcuredLines = []; return; }
    this.planProcuredLines = d.inventory_check.items.filter((l: any) => l.shortage_quantity > 0).map((l: any) => ({ item_id: l.item_id, item_code: l.item_code, item_description: l.item_description, shortage_quantity: Number(l.shortage_quantity) || 0, quantity_brought: 0, notes: '' }));
  }

  protected syncPlanWizardStep(status: ProgramPlanStatus | string): void {
    if (['ready', 'completed', 'cancelled'].includes(status)) { this.planWizardStep = 3; return; }
    if (status === 'checked_pre') { this.planWizardStep = 2; return; }
    this.planWizardStep = 1;
  }

  protected applyPlanUpdate(plan: ProgramPlanSummary): void {
    this.plans = this.plans.map((e) => e.plan_id === plan.plan_id ? { ...e, ...plan } : e);
  }

  protected removePlanLocal(planId: number): void {
    this.plans = this.plans.filter((p) => p.plan_id !== planId);
    if (this.selectedPlanId === planId) { this.selectedPlanId = null; this.selectedPlanDetails = null; this.planIssueSummary = null; this.planProcuredLines = []; }
    this.cdr.detectChanges();
  }

  protected normalizeDate(dateValue: string): number {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return 0;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  }

  protected resetPlanForm(): void {
    this.planForm = { template_id: null, week_label: '', planned_date: '', target_unit_count: 100, preferred_location_id: null, notes: '' };
  }

  private loadStockReservations(): void {
    this.stockReservations = this.allocatedPlans.map((p) => ({ item_code: p.week_label, item_description: p.template_name, unit: p.planned_date, total_stock: p.target_unit_count, reserved_amount: 'Allocated', available: p.status, plan_id: p.plan_id }));
    this.groupedReservations = [];
    this.selectedReservationDetails = null;
  }
}
