import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

import {
  BatchDistributionService,
  LocationBreakdownItem,
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { AuditExportService } from '../../../services/audit-export.service';
import { getApiBaseUrl } from '../../../services/api-base';

// ── Derived types for readiness cache ────────────────────────────────────────
interface ReadinessCacheEntry {
  percentage: number;
  can_proceed: boolean;
  insufficient_items_count: number;
  status: 'ready' | 'partial' | 'insufficient';
  loading: boolean;
}

@Component({
  selector: 'app-scheduled-batches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ToastComponent],
  providers: [DatePipe],
  templateUrl: './scheduled-batches.component.html',
  styleUrls: ['./scheduled-batches.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduledBatchesComponent implements OnInit, OnDestroy {
  // ── list state ───────────────────────────────────────────────────────────
  plans: ProgramPlanSummary[] = [];
  loadingPlans = false;

  // ── filters ──────────────────────────────────────────────────────────────
  statusFilter: ProgramPlanStatus | '' = '';
  fromDate = '';
  toDate = '';
  searchTerm = '';
  private searchDebounce?: ReturnType<typeof setTimeout>;

  // ── detail state ─────────────────────────────────────────────────────────
  selectedPlanId: number | null = null;
  selectedPlan: ProgramPlanDetailsResponse | null = null;
  loadingPlanDetails = false;

  // ── readiness cache (plan_id → entry) ────────────────────────────────────
  private readinessCache = new Map<number, ReadinessCacheEntry>();

  // ── subscriptions ────────────────────────────────────────────────────────
  private plansSub?: Subscription;
  private detailSub?: Subscription;
  private readinessSubs = new Map<number, Subscription>();

  constructor(
    private batchService: BatchDistributionService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private datePipe: DatePipe,
    private auditExport: AuditExportService,
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  ngOnDestroy(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.plansSub?.unsubscribe();
    this.detailSub?.unsubscribe();
    this.readinessSubs.forEach((s) => s.unsubscribe());
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  loadPlans(): void {
    this.loadingPlans = true;
    this.plansSub?.unsubscribe();

    this.plansSub = this.batchService
      .listProgramPlans({
        status: this.statusFilter || undefined,
        from_date: this.fromDate || undefined,
        to_date: this.toDate || undefined,
      })
      .subscribe({
        next: (res) => {
          this.plans = res.data;
          this.loadingPlans = false;
          // Drop selected plan if no longer in list
          if (this.selectedPlanId && !this.plans.some((p) => p.plan_id === this.selectedPlanId)) {
            this.selectedPlanId = null;
            this.selectedPlan = null;
          }
          this.fetchReadinessForPlanned();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadingPlans = false;
          this.toast.error(err?.error?.message || 'Failed to load scheduled batches.');
          this.cdr.markForCheck();
        },
      });
  }

  private fetchReadinessForPlanned(): void {
    this.plans
      .filter((p) => p.status === 'planned' && !this.readinessCache.has(p.plan_id))
      .forEach((p) => {
        this.readinessCache.set(p.plan_id, {
          percentage: 0,
          can_proceed: false,
          insufficient_items_count: 0,
          status: 'insufficient',
          loading: true,
        });

        const sub = this.batchService.getStockReadiness(p.plan_id).subscribe({
          next: (res) => {
            this.readinessCache.set(p.plan_id, {
              percentage: res.data.percentage,
              can_proceed: res.data.can_proceed,
              insufficient_items_count: res.data.insufficient_items_count,
              status: res.data.status as 'ready' | 'partial' | 'insufficient',
              loading: false,
            });
            this.cdr.markForCheck();
          },
          error: () => {
            const e = this.readinessCache.get(p.plan_id);
            if (e) { e.loading = false; this.cdr.markForCheck(); }
          },
        });
        this.readinessSubs.set(p.plan_id, sub);
      });
  }

  selectPlan(plan: ProgramPlanSummary): void {
    if (this.selectedPlanId === plan.plan_id) return;
    this.selectedPlanId = plan.plan_id;
    this.selectedPlan = null;
    this.loadingPlanDetails = true;
    this.cdr.markForCheck();

    this.detailSub?.unsubscribe();
    this.detailSub = this.batchService.getProgramPlan(plan.plan_id).subscribe({
      next: (res) => {
        this.selectedPlan = res.data;
        this.loadingPlanDetails = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingPlanDetails = false;
        this.toast.error(err?.error?.message || 'Failed to load plan details.');
        this.cdr.markForCheck();
      },
    });
  }

  // ── Filters ──────────────────────────────────────────────────────────────

  onSearchInput(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.cdr.markForCheck(), 250);
  }

  applyFilters(): void {
    this.readinessCache.clear();
    this.loadPlans();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.searchTerm = '';
    this.readinessCache.clear();
    this.loadPlans();
  }

  // ── Computed list ─────────────────────────────────────────────────────────

  get filteredPlans(): ProgramPlanSummary[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.plans;
    return this.plans.filter(
      (p) =>
        p.week_label.toLowerCase().includes(q) ||
        p.template_name.toLowerCase().includes(q) ||
        (p.preferred_location_name ?? '').toLowerCase().includes(q),
    );
  }

  // ── Stats bar ─────────────────────────────────────────────────────────────

  get statsPlanned(): number { return this.plans.filter((p) => p.status === 'planned').length; }
  get statsReady(): number { return this.plans.filter((p) => p.status === 'ready').length; }
  get statsCompleted(): number { return this.plans.filter((p) => p.status === 'completed').length; }
  get statsCancelled(): number { return this.plans.filter((p) => p.status === 'cancelled').length; }

  // ── Readiness helpers ─────────────────────────────────────────────────────

  getReadiness(planId: number): ReadinessCacheEntry | null {
    return this.readinessCache.get(planId) ?? null;
  }

  readinessBarClass(r: ReadinessCacheEntry): string {
    if (r.status === 'ready') return 'bar-ready';
    if (r.status === 'partial') return 'bar-partial';
    return 'bar-insufficient';
  }

  // ── Status helpers ────────────────────────────────────────────────────────

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      planned: 'Planned',
      checked_pre: 'Pre-checked',
      ready: 'Stock Allocated',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      planned: 'tag-planned',
      checked_pre: 'tag-checked',
      ready: 'tag-ready',
      completed: 'tag-completed',
      cancelled: 'tag-cancelled',
    };
    return map[status] ?? 'tag-default';
  }

  isOverdue(plan: ProgramPlanSummary): boolean {
    if (plan.status === 'completed' || plan.status === 'cancelled') return false;
    return new Date(plan.planned_date) < new Date(new Date().toDateString());
  }

  isToday(plan: ProgramPlanSummary): boolean {
    return plan.planned_date === new Date().toISOString().split('T')[0];
  }

  // ── Location breakdown helpers ────────────────────────────────────────────

  get locationBreakdown(): LocationBreakdownItem[] {
    return this.selectedPlan?.location_breakdown ?? [];
  }

  totalPullForItem(item: LocationBreakdownItem): number {
    return item.locations.reduce((s, l) => s + l.pull_quantity, 0);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportExcel(): void {
    if (!this.filteredPlans.length) return;
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';

    const rows: any[][] = [
      ['Batch Label', 'Recipe', 'Type', 'Planned Date', 'Target', 'Status', 'Auto-Allocated', 'Reference', 'Issued Qty'],
      ...this.filteredPlans.map((p) => [
        p.week_label,
        p.template_name,
        p.distribution_type,
        p.planned_date,
        p.target_unit_count,
        this.statusLabel(p.status),
        p.auto_allocated_at ? 'Yes' : 'No',
        p.completed_reference ?? p.auto_allocation_ref ?? '—',
        p.completed_issued_qty ?? '—',
      ]),
    ];

    const wsData = [
      ['NLCOM - IMS'],
      ['Schedule Monitoring'],
      [`Generated: ${dateStr}`],
      [],
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colCount = rows[0].length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws['!cols'] = rows[0].map((_, ci) => ({
      wch: Math.min(rows.reduce((w, row) => Math.max(w, String(row[ci] ?? '').length), 10) + 2, 50),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule Monitoring');
    XLSX.writeFile(wb, 'schedule_monitoring.xlsx');
    this.auditExport.log('schedule_monitoring', 'excel', this.filteredPlans.length);
  }
}
