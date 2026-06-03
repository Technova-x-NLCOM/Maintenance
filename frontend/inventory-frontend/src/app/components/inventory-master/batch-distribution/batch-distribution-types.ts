/**
 * Shared interfaces and type aliases for BatchDistributionComponent and its mixins.
 */

export interface EditableTemplateLine {
  item_id: number;
  quantity_per_base: number;
  notes: string;
  current_stock?: number;
}

export interface EditableRemainingLine {
  item_id: number;
  item_code: string;
  item_description: string;
  remaining_quantity: number;
  notes: string;
}

export interface EditableProcuredLine {
  item_id: number;
  item_code: string;
  item_description: string;
  shortage_quantity: number;
  quantity_brought: number;
  notes: string;
}

export interface StockReadinessEntry {
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

export interface PlanConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  action: 'cancel' | 'delete' | 'execute' | 'allocate' | null;
  plan: import('../../../services/batch-distribution.service').ProgramPlanSummary | null;
}

export interface TemplateConfirmDialog {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  action: 'delete' | 'save_stock_warning' | null;
  template: import('../../../services/batch-distribution.service').BatchDistributionTemplateSummary | null;
}
