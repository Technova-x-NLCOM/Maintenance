import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import {
  BatchDistributionCalculation,
  BatchDistributionService,
  BatchDistributionTemplateSummary,
} from '../../../services/batch-distribution.service';
import { RecipeTypeService, RecipeTypeOption } from '../../../services/recipe-type.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-recipe-calculation-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './recipe-calculation-preview.component.html',
  styleUrls: ['./recipe-calculation-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCalculationPreviewComponent implements OnInit, OnDestroy {
  // ── template list ────────────────────────────────────────────────────────
  templates: BatchDistributionTemplateSummary[] = [];
  filteredTemplates: BatchDistributionTemplateSummary[] = [];
  recipeTypeOptions: RecipeTypeOption[] = [];
  loadingTemplates = false;

  // ── filters ──────────────────────────────────────────────────────────────
  searchQuery = '';
  recipeTypeFilter: number | 'all' = 'all';

  // ── selection + form ─────────────────────────────────────────────────────
  selectedTemplate: BatchDistributionTemplateSummary | null = null;
  targetUnitCount = 100;

  // ── calculation state ────────────────────────────────────────────────────
  calculation: BatchDistributionCalculation | null = null;
  calculating = false;

  // ── subscriptions ────────────────────────────────────────────────────────
  private subs: Subscription[] = [];
  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor(
    private batchService: BatchDistributionService,
    private recipeTypeService: RecipeTypeService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.loadRecipeTypeOptions();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  // ── data loading ─────────────────────────────────────────────────────────

  loadTemplates(): void {
    this.loadingTemplates = true;
    const recipeTypeId =
      this.recipeTypeFilter !== 'all' ? (this.recipeTypeFilter as number) : undefined;

    const sub = this.batchService.listTemplates(this.searchQuery.trim() || undefined, recipeTypeId).subscribe({
      next: (res) => {
        this.templates = res.data;
        this.applyClientFilter();
        this.loadingTemplates = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingTemplates = false;
        this.toast.error('Failed to load recipes.');
        this.cdr.markForCheck();
      },
    });
    this.subs.push(sub);
  }

  loadRecipeTypeOptions(): void {
    const sub = this.recipeTypeService.getOptions().subscribe({
      next: (res) => {
        this.recipeTypeOptions = res.data;
        this.cdr.markForCheck();
      },
      error: () => { /* non-critical */ },
    });
    this.subs.push(sub);
  }

  // ── filtering ────────────────────────────────────────────────────────────

  private applyClientFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredTemplates = this.templates.filter((t) => {
      const matchesSearch =
        !q ||
        t.template_name.toLowerCase().includes(q) ||
        (t.recipe_type_name ?? '').toLowerCase().includes(q);
      const matchesType =
        this.recipeTypeFilter === 'all' || t.recipe_type_id === this.recipeTypeFilter;
      return matchesSearch && matchesType;
    });
  }

  onSearchInput(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.applyClientFilter();
      this.cdr.markForCheck();
    }, 250);
  }

  onFilterChange(): void {
    this.applyClientFilter();
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyClientFilter();
    this.cdr.markForCheck();
  }

  // ── selection ────────────────────────────────────────────────────────────

  selectTemplate(template: BatchDistributionTemplateSummary): void {
    this.selectedTemplate = template;
    this.targetUnitCount = template.base_unit_count;
    this.calculation = null;
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedTemplate = null;
    this.calculation = null;
    this.cdr.markForCheck();
  }

  // ── calculation ──────────────────────────────────────────────────────────

  runCalculation(): void {
    if (!this.selectedTemplate || this.targetUnitCount < 1) return;

    this.calculating = true;
    this.calculation = null;
    this.cdr.markForCheck();

    const sub = this.batchService
      .calculate(this.selectedTemplate.template_id, this.targetUnitCount)
      .subscribe({
        next: (res) => {
          this.calculation = res.data;
          this.calculating = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.calculating = false;
          this.toast.error(err?.error?.message || 'Calculation failed. Please try again.');
          this.cdr.markForCheck();
        },
      });
    this.subs.push(sub);
  }

  resetCalculation(): void {
    this.calculation = null;
    this.cdr.markForCheck();
  }

  // ── view helpers ─────────────────────────────────────────────────────────

  get shortageCount(): number {
    return this.calculation?.items.filter((i) => i.has_shortage).length ?? 0;
  }

  get totalShortage(): number {
    return this.calculation?.items.reduce((acc, i) => acc + i.shortage_quantity, 0) ?? 0;
  }

  get canIssue(): boolean {
    return this.calculation?.summary.can_issue ?? false;
  }

  stockStatusClass(item: BatchDistributionCalculation['items'][number]): string {
    return item.has_shortage ? 'status-shortage' : 'status-ok';
  }

  stockStatusLabel(item: BatchDistributionCalculation['items'][number]): string {
    return item.has_shortage ? 'Shortage' : 'OK';
  }

  isSelectedTemplate(template: BatchDistributionTemplateSummary): boolean {
    return this.selectedTemplate?.template_id === template.template_id;
  }
}
