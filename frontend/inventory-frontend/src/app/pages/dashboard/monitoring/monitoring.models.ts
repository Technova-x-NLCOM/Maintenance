export interface TransactionRecord {
  transaction_id: number;
  transaction_type: 'IN' | 'OUT';
  quantity: number;
  reference_number: string;
  transaction_date: string;
  reason: string | null;
  notes: string | null;
  destination: string | null;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  batch_number: string | null;
  performed_by_name: string;
  created_at: string;
}

export interface StockReportRecord {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name: string | null;
  category_name: string | null;
  measurement_unit: string | null;
  reorder_level: number;
  current_stock: number;
  total_in: number;
  total_out: number;
}

export interface Paginated<T> {
  success: boolean;
  data: { data: T[]; current_page: number; last_page: number; per_page: number; total: number; };
}
