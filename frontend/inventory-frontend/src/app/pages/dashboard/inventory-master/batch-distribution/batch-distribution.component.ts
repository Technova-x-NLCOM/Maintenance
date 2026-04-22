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
  ProgramPlanDetailsResponse,
  ProgramPlanStatus,
  ProgramPlanSummary,
} from '../../../../services/batch-distribution.service';

interface EditableTemplateLine {
  item_id: number;
  quantity_per_base: number;
  notes: string;
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
  loadingPlans = false;
  savingPlan = false;
  loadingPlanDetails = false;
  runningPlanAction = false;

  templates: BatchDistributionTemplateSummary[] = [];
  itemOptions: BatchDistributionItemOption[] = [];
  plans: ProgramPlanSummary[] = [];

  selectedTemplateId: number | null = null;
  selectedTemplateName = '';

  searchTemplate = '';
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
  planIssueReason = 'Scheduled Feeding Program Issuance';
  planIssueNotes = '';
  planRemainingLines: EditableRemainingLine[] = [];
  planProcuredLines: EditableProcuredLine[] = [];
  planIssueSummary: ProgramPlanDetailsResponse['issuance'] | null = null;

  errorMessage = '';
  successMessage = '';

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadTemplatesSub?: Subscription;
  private templateSearchDebounce?: ReturnType<typeof setTimeout>;
  private templatesBaseline: BatchDistributionTemplateSummary[] | null = null;

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
    this.loadPlans();
  }

  ngOnDestroy(): void {
    this.cancelTemplateSearchDebounce();
    this.cancelItemOptionsSearchDebounce();
    this.loadTemplatesSub?.unsubscribe();
    this.loadItemOptionsSub?.unsubscribe();
  }

  loadTemplates(): void {
    this.cancelTemplateSearchDebounce();
    this.loadingTemplates = true;
    this.loadTemplatesSub?.unsubscribe();
    this.loadTemplatesSub = this.batchService
      .listTemplates(this.searchTemplate || undefined)
      .subscribe({
        next: (response) => {
          this.templates = response.data;
          if (!this.searchTemplate.trim()) {
            this.templatesBaseline = response.data.slice();
          }
          this.loadingTemplates = false;

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
      this.restoreTemplatesBaseline();
      return;
    }
    this.templateSearchDebounce = setTimeout(() => {
      this.templateSearchDebounce = undefined;
      this.loadTemplates();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearTemplateSearchBox(): void {
    this.searchTemplate = '';
    this.cancelTemplateSearchDebounce();
    this.loadTemplatesSub?.unsubscribe();
    this.loadingTemplates = false;
    this.restoreTemplatesBaseline();
  }

  private cancelTemplateSearchDebounce(): void {
    if (this.templateSearchDebounce !== undefined) {
      clearTimeout(this.templateSearchDebounce);
      this.templateSearchDebounce = undefined;
    }
  }

  private restoreTemplatesBaseline(): void {
    if (this.templatesBaseline) {
      this.templates = this.templatesBaseline.slice();
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
    this.loadTemplates();
  }

  clearTemplateSearch(): void {
    this.clearTemplateSearchBox();
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
    if (existing) {
      existing.quantity_per_base = normalizedQty;
      existing.notes = this.lineDraftNotes.trim();
    } else {
      this.templateLines.push({
        item_id: this.lineDraftItemId,
        quantity_per_base: normalizedQty,
        notes: this.lineDraftNotes.trim(),
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

  saveTemplate(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.templateForm.template_name.trim()) {
      this.errorMessage = 'Template name is required.';
      return;
    }

    if (
      !Number.isFinite(this.templateForm.base_unit_count) ||
      this.templateForm.base_unit_count <= 0
    ) {
      this.errorMessage = 'Base count must be greater than zero.';
      return;
    }

    if (this.templateLines.length === 0) {
      this.errorMessage = 'Add at least one item to the template.';
      return;
    }

    const payload: BatchDistributionTemplatePayload = {
      template_name: this.templateForm.template_name.trim(),
      distribution_type: this.templateForm.distribution_type,
      base_unit_count: Math.floor(this.templateForm.base_unit_count),
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

    if (!this.calculation.summary.can_issue) {
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
        next: (response) => {
          this.issuing = false;
          this.successMessage = `Batch issued successfully. Reference: ${response.data.reference_number}`;
          this.calculate();
        },
        error: (err) => {
          this.issuing = false;
          this.errorMessage = err?.error?.message || 'Failed to issue batch distribution.';
          this.cdr.detectChanges();
        },
      });
  }

  loadPlans(): void {
    this.loadingPlans = true;
    this.batchService.listProgramPlans().subscribe({
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingPlans = false;
        this.errorMessage = err?.error?.message || 'Failed to load scheduled plans.';
        this.cdr.detectChanges();
      },
    });
  }

  createPlan(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.planForm.template_id) {
      this.errorMessage = 'Select a feeding template for the plan.';
      return;
    }

    if (!this.planForm.week_label.trim()) {
      this.errorMessage = 'Week label is required.';
      return;
    }

    if (!this.planForm.planned_date) {
      this.errorMessage = 'Planned date is required.';
      return;
    }

    const targetCount = Math.floor(Number(this.planForm.target_unit_count));
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
      this.errorMessage = 'Target count must be greater than zero.';
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
          this.successMessage = response.message || 'Program plan created successfully.';
          this.selectedPlanId = response.data.plan.plan_id;
          this.selectedPlanDetails = response.data;
          this.planIssueSummary = response.data.issuance ?? null;
          this.seedRemainingLinesFromCurrentDetails();
          this.seedProcuredLinesFromCurrentDetails();
          this.loadPlans();
        },
        error: (err) => {
          this.savingPlan = false;
          this.errorMessage = err?.error?.message || 'Failed to create program plan.';
          this.cdr.detectChanges();
        },
      });
  }

  selectPlan(plan: ProgramPlanSummary): void {
    this.selectedPlanId = plan.plan_id;
    this.loadPlanDetails(plan.plan_id);
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadingPlanDetails = false;
        this.errorMessage = err?.error?.message || 'Failed to load selected plan details.';
        this.cdr.detectChanges();
      },
    });
  }

  runPlanPrecheck(): void {
    if (!this.selectedPlanId) {
      return;
    }
    this.runningPlanAction = true;
    this.batchService.runProgramPrecheck(this.selectedPlanId).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.successMessage = response.message || 'Precheck completed.';
        this.loadPlanDetails(this.selectedPlanId!);
        this.loadPlans();
      },
      error: (err) => {
        this.runningPlanAction = false;
        this.errorMessage = err?.error?.message || 'Failed to run precheck.';
        this.cdr.detectChanges();
      },
    });
  }

  runPlanFinalCheck(): void {
    if (!this.selectedPlanId) {
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
    this.batchService.runProgramFinalCheck(this.selectedPlanId, { procured_items }).subscribe({
      next: (response) => {
        this.runningPlanAction = false;
        this.successMessage = response.message || 'Final check completed.';
        this.loadPlanDetails(this.selectedPlanId!);
        this.loadPlans();
      },
      error: (err) => {
        this.runningPlanAction = false;
        this.errorMessage = err?.error?.message || 'Failed to run final check.';
        this.cdr.detectChanges();
      },
    });
  }

  updatePlan(): void {
    if (!this.selectedPlanId) {
      return;
    }

    if (!this.planIssueDestination.trim()) {
      this.errorMessage = 'Issue destination is required.';
      return;
    }

    this.runningPlanAction = true;
    this.batchService
      .updateProgramPlan(this.selectedPlanId, {
        issue_destination: this.planIssueDestination.trim(),
        issue_reason: this.planIssueReason.trim() || undefined,
        issue_notes: this.planIssueNotes.trim() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.runningPlanAction = false;
          this.selectedPlanDetails = response.data;
          this.planIssueSummary = response.data.issuance ?? null;
          this.successMessage = response.message || 'Inventory issued successfully.';
          this.loadPlans();
          this.seedRemainingLinesFromCurrentDetails();
          this.seedProcuredLinesFromCurrentDetails();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.runningPlanAction = false;
          this.errorMessage = err?.error?.message || 'Failed to issue plan inventory.';
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
          this.successMessage = response.message || 'Plan completed successfully.';
          this.loadPlans();
          this.seedRemainingLinesFromCurrentDetails();
          this.seedProcuredLinesFromCurrentDetails();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.runningPlanAction = false;
          this.errorMessage = err?.error?.message || 'Failed to complete plan.';
          this.cdr.detectChanges();
        },
      });
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
}
