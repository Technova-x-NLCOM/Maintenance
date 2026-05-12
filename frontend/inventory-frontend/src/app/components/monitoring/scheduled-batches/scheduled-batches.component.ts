import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  BatchDistributionService,
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-scheduled-batches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ToastComponent],
  templateUrl: './scheduled-batches.component.html',
  styleUrls: ['./scheduled-batches.component.scss'],
})
export class ScheduledBatchesComponent implements OnInit, OnDestroy {
  plans: ProgramPlanSummary[] = [];
  selectedPlan: ProgramPlanDetailsResponse | null = null;

  statusFilter: ProgramPlanStatus | '' = '';
  fromDate = '';
  toDate = '';

  loadingPlans = false;
  loadingPlanDetails = false;
  errorMessage = '';

  private plansSub?: Subscription;
  private planDetailsSub?: Subscription;

  constructor(
    private batchService: BatchDistributionService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.plansSub?.unsubscribe();
    this.planDetailsSub?.unsubscribe();
  }

  loadPlans(): void {
    this.loadingPlans = true;
    this.errorMessage = '';

    this.plansSub?.unsubscribe();
    this.plansSub = this.batchService
      .listProgramPlans({
        status: this.statusFilter || undefined,
        from_date: this.fromDate || undefined,
        to_date: this.toDate || undefined,
      })
      .subscribe({
        next: (response) => {
          this.plans = response.data;
          this.loadingPlans = false;

          if (this.selectedPlan) {
            const stillExists = this.plans.some((plan) => plan.plan_id === this.selectedPlan?.plan.plan_id);
            if (!stillExists) {
              this.selectedPlan = null;
            }
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loadingPlans = false;
          this.toast.error(err?.error?.message || 'Failed to load scheduled batches.');
          this.cdr.detectChanges();
        },
      });
  }

  applyFilters(): void {
    this.loadPlans();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.loadPlans();
  }

  selectPlan(plan: ProgramPlanSummary): void {
    this.loadingPlanDetails = true;
    this.errorMessage = '';

    this.planDetailsSub?.unsubscribe();
    this.planDetailsSub = this.batchService.getProgramPlan(plan.plan_id).subscribe({
      next: (response) => {
        this.selectedPlan = response.data;
        this.loadingPlanDetails = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingPlanDetails = false;
        this.toast.error(err?.error?.message || 'Failed to load batch plan details.');
        this.cdr.detectChanges();
      },
    });
  }

  getStatusClass(status: ProgramPlanStatus | string): string {
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
}
