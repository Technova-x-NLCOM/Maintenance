 /**
 * BatchDistributionComponent
 *
 * Thin composition root. All logic lives in three focused mixin files:
 *
 *  • batch-distribution-template.mixin.ts  — recipe CRUD, item combobox, calculator
 *  • batch-distribution-plan.mixin.ts      — schedule CRUD, calendar, stock readiness
 *  • batch-distribution-execution.mixin.ts — 3-step "Run Batch" execution modal
 *
 * Shared types: batch-distribution-types.ts
 *
 * TypeScript does not support multiple class inheritance. We compose the mixins
 * by applying them in sequence with the applyMixins helper at the bottom of this file.
 * The component declares every property the mixins need via `declare` so Angular's
 * DI can inject the real services into the single constructor.
 */
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

import {
  BatchDistributionService,
  BatchDistributionTemplateSummary,
  ProgramPlanSummary,
} from '../../../services/batch-distribution.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { RecipeTypeService } from '../../../services/recipe-type.service';
import { InventoryItemService } from '../../../services/inventory-item.service';

import { BatchDistributionTemplateMixin } from './batch-distribution-template.mixin';
import { BatchDistributionPlanMixin } from './batch-distribution-plan.mixin';
import { BatchDistributionExecutionMixin } from './batch-distribution-execution.mixin';

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
        animate('200ms ease-out', style({ height: '*', opacity: '1' })),
      ]),
      transition(':leave', [
        style({ height: '*', opacity: '1', overflow: 'hidden' }),
        animate('200ms ease-in', style({ height: '0', opacity: '0' })),
      ]),
    ]),
  ],
})
export class BatchDistributionComponent implements OnInit, OnDestroy {
  // ── injected services ────────────────────────────────────────────────────
  protected batchService: BatchDistributionService;
  protected cdr: ChangeDetectorRef;
  protected toast: ToastService;
  protected recipeTypeService: RecipeTypeService;
  protected itemService: InventoryItemService;

  // ── tab / misc ───────────────────────────────────────────────────────────
  activeTab: 'distribution' | 'scheduled' = 'distribution';
  errorMessage = '';
  successMessage = '';
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private toastTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    batchService: BatchDistributionService,
    cdr: ChangeDetectorRef,
    toast: ToastService,
    recipeTypeService: RecipeTypeService,
    itemService: InventoryItemService,
  ) {
    this.batchService = batchService;
    this.cdr = cdr;
    this.toast = toast;
    this.recipeTypeService = recipeTypeService;
    this.itemService = itemService;
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.loadItemOptions();
    this.loadPlans();
    this.buildCalendar();
    this.loadRecipeTypeOptions();
    this.loadLocationOptions();
  }

  ngOnDestroy(): void {
    this.cancelTemplateSearchDebounce();
    this.cancelItemOptionsSearchDebounce();
    if (this.toastTimeout !== undefined) clearTimeout(this.toastTimeout);
    this.loadTemplatesSub?.unsubscribe();
    this.loadItemOptionsSub?.unsubscribe();
  }

  // ── tab ──────────────────────────────────────────────────────────────────
  setTab(tab: 'distribution' | 'scheduled'): void {
    this.activeTab = tab;
    this.errorMessage = '';
    this.successMessage = '';
    if (tab !== 'distribution') this.calculatorOpen = false;
  }

  showToast(type: 'success' | 'error', message: string): void {
    this.toast.show(type, message);
  }

  // ── bridge: recipe sidebar → schedule dialog ─────────────────────────────
  /** Called by template mixin's runRecipeFromDetails(). */
  protected runRecipeSchedule(template: BatchDistributionTemplateSummary): void {
    this.runRecipe(template);
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
      preferred_location_id: null,
      notes: '',
    };
  }

  // ── bridge: execution modal → plan list reload ───────────────────────────
  protected loadPlansAfterExecution(): void {
    this.loadPlans();
  }

  protected seedExecutionRemainderLinesFromItems(items: any[]): void {
    this.executionRemainderLines = items.map((l: any) => ({
      item_id: l.item_id,
      item_code: l.item_code,
      item_description: l.item_description,
      remaining_quantity: 0,
      notes: '',
    }));
  }

  // ── global click handler ─────────────────────────────────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target) return;
    if (this.openTemplateMenuId && !target.closest('.template-menu')) this.openTemplateMenuId = null;
    if (this.openPlanMenuId && !target.closest('.plan-menu')) this.openPlanMenuId = null;
    if (this.itemComboboxOpen && !target.closest('.template-item-combobox')) {
      this.itemComboboxOpen = false;
      this.activeItemOptionIndex = -1;
    }
  }
}

// ── apply mixins ─────────────────────────────────────────────────────────────
// Copies prototype methods from each mixin onto BatchDistributionComponent.
// This is the standard TypeScript mixin pattern for composing multiple classes.
function applyMixins(derivedCtor: any, ...baseCtors: any[]): void {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      if (name !== 'constructor') {
        Object.defineProperty(
          derivedCtor.prototype,
          name,
          Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ?? Object.create(null),
        );
      }
    });
  });
}

applyMixins(
  BatchDistributionComponent,
  BatchDistributionTemplateMixin,
  BatchDistributionPlanMixin,
  BatchDistributionExecutionMixin,
);

// Inform TypeScript that the component has all mixin members.
// The two conflicting signatures are overridden here with `any` to resolve TS2320:
//  - getRowShortageQuantity: typed differently in template mixin vs plan mixin stub
//  - applyPlanUpdate: protected method present in both plan and execution mixin
// Runtime behaviour is unaffected — applyMixins copies the real implementations.
export interface BatchDistributionComponent
  extends BatchDistributionTemplateMixin,
    BatchDistributionPlanMixin,
    BatchDistributionExecutionMixin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRowShortageQuantity(row: any): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyPlanUpdate(plan: any): void;
}
