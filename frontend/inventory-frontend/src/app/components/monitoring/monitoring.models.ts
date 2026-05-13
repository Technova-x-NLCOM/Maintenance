export interface TransactionRecord {
  transaction_id: number;
  transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT';
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
  batch_location_name?: string | null;
  from_location_name?: string | null;
  to_location_name?: string | null;
  performed_by_name: string;
  created_at: string;
}

export interface StockReportRecord {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name: string | null;
  category_name: string | null;
  location_id?: number | null;
  location_code?: string | null;
  location_name?: string | null;
  measurement_unit: string | null;
  reorder_level: number;
  current_stock: number;
  total_in: number;
  total_out: number;
}

export interface StorageInventoryItem {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name: string | null;
  category_name: string | null;
  measurement_unit: string | null;
  reorder_level: number;
  current_stock: number;
  is_low_stock: boolean;
}

export interface StorageInventoryLocation {
  location_id: number | null;
  location_code: string | null;
  location_name: string;
  location_type: string | null;
  item_count: number;
  total_stock: number;
  low_stock_count: number;
  items: StorageInventoryItem[];
}

export interface StorageInventoryResponse {
  success: boolean;
  message: string;
  data: {
    locations: StorageInventoryLocation[];
    location_count: number;
    total_items: number;
    total_stock: number;
  };
}

export interface Paginated<T> {
  success: boolean;
  data: { data: T[]; current_page: number; last_page: number; per_page: number; total: number; };
}
