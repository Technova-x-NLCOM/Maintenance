/**
 * Execution modal mixin for BatchDistributionComponent.
 *
 * Contains the 3-step "Run Batch" execution modal: stock check → gap fill → complete.
 */
import { ChangeDetectorRef } from '@angular/core';
import {
  BatchDistributionService,
  ProgramPlanCheckItem,
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { EditableRemainingLine } from './batch-distribution-types';

export abstract class BatchDistributionExecutionMixin {
  protected abstract batchService: BatchDistributionService;
  protected abstract cdr: ChangeDetectorRef;
  protected abstract toast: ToastService;

  // ── abstract hooks from plan mixin ───────────────────────────────────────
  abstract isStockAllocated(plan: ProgramPlanSummary): boolean;
  abstract showRunBatchAction(plan: ProgramPlanSummary): boolean;
  abstract canRunBatch(plan: ProgramPlanSummary): boolean;
  abstract getRunBatchDisabledReason(plan: ProgramPlanSummary): string;
  protected applyPlanUpdate(plan: ProgramPlanSummary): void { /* provided by plan mixin via applyMixins */ }

  // ── execution modal state ────────────────────────────────────────────────
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

  // ── computed getters ─────────────────────────────────────────────────────

  get executionModalTitle(): string {
    return this.selectedPlanForExecution && this.isStockAllocated(this.selectedPlanForExecution) ? 'Complete Batch' : 'Run Batch';
  }

  get executionStockIssued(): boolean {
    if (this.executionIssuanceSummary) return true;
    return !!this.selectedPlanForExecution && this.isStockAllocated(this.selectedPlanForExecution);
  }

  get executionHasShortages(): boolean {
    return !!this.executionStockCheck?.items?.some((i: any) => i.has_shortage);
  }

  get canProceedFromStockCheck(): boolean { return !this.executionHasShortages; }

  get canCompleteProcurementStep(): boolean {
    return this.allGapsFilled && !this.executionIssuingStock;
  }

  get canIssueOnCompleteStep(): boolean {
    return !this.executionHasShortages && !this.executionIssuingStock;
  }

  get canSubmitBatchCompletion(): boolean {
    return this.executionStockIssued && !this.executingDistribution;
  }

  // ── flow control ─────────────────────────────────────────────────────────

  startExecutionFlow(plan: ProgramPlanSummary): void {
    if (!this.showRunBatchAction(plan)) { this.toast.error('Run batch is available on or after the planned date for active schedules.'); return; }
    if (!this.canRunBatch(plan)) { this.toast.error(this.getRunBatchDisabledReason(plan) || 'Cannot run this batch until stock readiness is 100%.'); return; }
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
      this.loadExecutionPlanDetails(plan.plan_id); return;
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

  proceedToFillGaps(): void { this.executionStep = 2; this.initializeGapFillData(); }
  proceedToCompleteStep(): void { this.seedExecutionRemainderLines(); this.executionStep = 3; }
  goBackToStockCheck(): void { this.executionStep = 1; }
  goBackToPreviousStep(): void { if (this.executionStep > 1) this.executionStep = (this.executionStep - 1) as 1 | 2 | 3; }
  showStockShortageAlert(): void { this.toast.error('Cannot proceed — resolve stock shortages first.'); }

  // ── issue actions ────────────────────────────────────────────────────────

  private validateExecutionIssueFields(): { destination?: string; reason?: string } {
    // destination and reason now come from the plan itself, not user input
    const plan = this.selectedPlanForExecution;
    const destination = plan?.week_label ?? 'Batch Distribution';
    return { destination, reason: 'Scheduled Batch Distribution' };
  }

  confirmProcurementAndIssue(): void {
    const plan = this.selectedPlanForExecution;
    if (!plan) return;
    if (!this.allGapsFilled) { this.toast.error('Record procured quantities for all shortages before continuing.'); return; }
    const issueFields = this.validateExecutionIssueFields();
    const procured_items = this.getShortageItems()
      .map((item) => ({ item_id: item.item_id, quantity_brought: Math.floor(Number(this.gapFillData[item.item_id] || 0)), notes: this.executionNotes.trim() || undefined }))
      .filter((l) => l.quantity_brought > 0);
    this.executionIssuingStock = true;
    this.batchService.runProgramFinalCheck(plan.plan_id, { procured_items, issue_destination: issueFields.destination, issue_reason: issueFields.reason, issue_notes: this.executionNotes.trim() || undefined }).subscribe({
      next: (response) => {
        this.executionIssuingStock = false;
        this.executionIssuanceSummary = response.data?.issuance ?? null;
        if (response.data?.check_result) this.executionStockCheck = response.data.check_result;
        this.applyExecutionPlanUpdate(plan.plan_id, 'ready');
        this.toast.success(response.message || 'Ingredients received and issued.');
        this.seedExecutionRemainderLines();
        this.executionStep = 3;
        this.cdr.detectChanges();
      },
      error: (err) => { this.executionIssuingStock = false; this.toast.error(err?.error?.message || 'Failed to receive and issue ingredients.'); this.cdr.detectChanges(); },
    });
  }

  issueStockForExecution(): void {
    const plan = this.selectedPlanForExecution;
    if (!plan || this.executionStockIssued) return;
    if (this.executionHasShortages) { this.toast.error('Resolve shortages in step 2 before issuing stock.'); return; }
    const issueFields = this.validateExecutionIssueFields();
    this.executionIssuingStock = true;
    const onSuccess = (response: { message?: string; data?: ProgramPlanDetailsResponse }) => {
      this.executionIssuingStock = false;
      this.executionIssuanceSummary = response.data?.issuance ?? null;
      if (response.data?.inventory_check) { this.executionStockCheck = response.data.inventory_check; this.executionPlanDetails = response.data; }
      const nextStatus = (response.data?.plan?.status ?? 'ready') as ProgramPlanStatus;
      this.applyExecutionPlanUpdate(plan.plan_id, nextStatus);
      this.toast.success(response.message || 'Ingredients issued from inventory.');
      this.seedExecutionRemainderLines();
      this.cdr.detectChanges();
    };
    const onError = (err: any) => { this.executionIssuingStock = false; this.toast.error(err?.error?.message || 'Failed to issue ingredients.'); this.cdr.detectChanges(); };
    if (plan.status === 'planned') {
      this.batchService.reserveProgramPlan(plan.plan_id, { destination: issueFields.destination, reason: issueFields.reason }).subscribe({ next: onSuccess, error: onError }); return;
    }
    this.batchService.runProgramFinalCheck(plan.plan_id, { issue_destination: issueFields.destination, issue_reason: issueFields.reason }).subscribe({ next: onSuccess, error: onError });
  }

  completeBatchExecution(): void {
    const plan = this.selectedPlanForExecution;
    if (!plan) return;
    if (!this.executionStockIssued) { this.toast.error('Issue ingredients before completing the batch.'); return; }
    const remaining_items = this.executionRemainderLines.map((l) => ({ item_id: l.item_id, remaining_quantity: Number(l.remaining_quantity) || 0, notes: l.notes.trim() || undefined }));
    this.executingDistribution = true;
    this.batchService.completeProgramPlan(plan.plan_id, { status: 'completed', remaining_items, issue_now: false }).subscribe({
      next: (response) => {
        this.executingDistribution = false;
        const ref = this.executionIssuanceSummary?.reference_number;
        this.toast.success(response.message || (ref ? `Batch completed. Issuance: ${ref}` : 'Batch completed successfully.'));
        this.closeExecutionModal();
        this.loadPlansAfterExecution();
        this.cdr.detectChanges();
      },
      error: (err) => { this.executingDistribution = false; this.toast.error(err?.error?.message || 'Failed to complete batch.'); this.cdr.detectChanges(); },
    });
  }

  /** Hook so plan mixin can refresh plan list after execution. */
  protected abstract loadPlansAfterExecution(): void;

  // ── gap filling ──────────────────────────────────────────────────────────

  initializeGapFillData(): void {
    this.gapFillData = {};
    this.getShortageItems().forEach((item) => { this.gapFillData[item.item_id] = 0; });
    this.updateGapFillProgress();
  }

  getShortageItems(): any[] {
    return this.executionStockCheck?.items?.filter((i: any) => i.has_shortage) ?? [];
  }

  updateGapFillProgress(): void {
    this.allGapsFilled = this.getShortageItems().every((item) => (this.gapFillData[item.item_id] || 0) >= item.shortage_quantity);
  }

  getGapFillProgress(item: any): number {
    return ((this.gapFillData[item.item_id] || 0) / item.shortage_quantity) * 100;
  }

  getRemainingGaps(): number {
    return this.getShortageItems().filter((item) => (this.gapFillData[item.item_id] || 0) < item.shortage_quantity).length;
  }

  trackByItemId(_index: number, item: any): number { return item.item_id; }

  // ── data loading ─────────────────────────────────────────────────────────

  loadExecutionStockCheck(planId: number): void {
    this.loadingExecutionDetails = true;
    this.batchService.runProgramPrecheck(planId).subscribe({
      next: (response) => {
        this.loadingExecutionDetails = false;
        this.executionStockCheck = response.data?.check_result ?? response.data;
        this.applyExecutionPlanUpdate(planId, 'checked_pre');
        this.initializeGapFillData();
        // Stay on step 1 so the user can review the stock check result.
        // They click "Issue & Continue →" (no shortages) or "Procure Shortages →" (shortages)
        // to advance. This keeps manual control explicit.
        this.cdr.detectChanges();
      },
      error: (err) => { this.loadingExecutionDetails = false; this.toast.error(err?.error?.message || 'Failed to load stock check'); this.closeExecutionModal(); },
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
      error: (err) => { this.loadingExecutionDetails = false; this.toast.error(err?.error?.message || 'Failed to load batch details'); this.closeExecutionModal(); },
    });
  }

  // ── private helpers ──────────────────────────────────────────────────────

  protected seedExecutionRemainderLines(): void {
    const items: ProgramPlanCheckItem[] = this.executionPlanDetails?.inventory_check.items ?? this.executionStockCheck?.items ?? [];
    this.executionRemainderLines = items.map((l) => ({ item_id: l.item_id, item_code: l.item_code, item_description: l.item_description, remaining_quantity: 0, notes: '' }));
  }

  protected applyExecutionPlanUpdate(planId: number, status: ProgramPlanStatus): void {
    if (this.selectedPlanForExecution?.plan_id === planId) this.selectedPlanForExecution = { ...this.selectedPlanForExecution, status };
    this.applyPlanUpdate({ plan_id: planId, status } as ProgramPlanSummary);
  }
}
