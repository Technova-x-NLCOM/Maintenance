import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InventoryItem {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_id: number;
  item_type_name?: string;
  category_id: number | null;
  category_name?: string;
  measurement_unit: string | null;
  particular: string | null;
  mg_dosage: number | null;
  image_url: string | null;
  remarks: string | null;
  unit_value: number | null;
  reorder_level: number;
  shelf_life_days: number | null;
  is_active: boolean;
  created_by: number | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ItemFormOptions {
  item_types: Array<{ item_type_id: number; type_name: string }>;
  categories: Array<{ category_id: number; category_name: string }>;
}

interface PaginatedItemsResponse {
  success: boolean;
  message: string;
  data: {
    data: InventoryItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface ItemSingleResponse {
  success: boolean;
  message: string;
  data: InventoryItem;
}

interface ItemOptionsResponse {
  success: boolean;
  message: string;
  data: ItemFormOptions;
}

interface MinimumStockItem {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name?: string;
  category_name?: string;
  reorder_level: number;
  current_stock: number;
  shelf_life_days: number | null;
  is_active: boolean;
}

interface PaginatedMinimumStockResponse {
  success: boolean;
  message: string;
  data: {
    data: MinimumStockItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface ReceivingItem {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name?: string;
  category_name?: string;
  measurement_unit: string | null;
  shelf_life_days: number | null;
  image_url: string | null;
  current_stock: number;
  is_active: boolean;
}

interface PaginatedReceivingItemsResponse {
  success: boolean;
  message: string;
  data: {
    data: ReceivingItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface ReceivingTransactionRequest {
  item_id: number;
  quantity: number;
  batch_number: string;
  purchase_date: string;
  expiry_date?: string | null;
  manufactured_date?: string | null;
  supplier_info?: string | null;
  batch_value?: number | null;
  reason?: string | null;
  notes?: string | null;
}

interface ReceivingTransactionResponse {
  success: boolean;
  message: string;
  data: {
    batch_id: number;
    item_id: number;
    item_code: string;
    item_description: string;
    batch_number: string;
    quantity: number;
    purchase_date: string;
    expiry_date: string | null;
    manufactured_date: string | null;
    supplier_info: string | null;
    batch_value: number | null;
    shelf_life_days: number | null;
    expiry_date_auto_calculated?: boolean;
  };
}

interface IssuanceItem {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name?: string;
  category_name?: string;
  measurement_unit: string | null;
  image_url: string | null;
  current_stock: number;
  expired_stock?: number;
  expiry_date?: string | null; // Added expiration date
  shelf_life_days?: number | null; // Added shelf life in days
  adjustment_reason?: string; // Added reason for adjustment
}

interface PaginatedIssuanceItemsResponse {
  success: boolean;
  message: string;
  data: {
    data: IssuanceItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface IssuanceLineInput {
  item_id: number;
  quantity: number;
}

interface IssuanceTransactionRequest {
  destination: string;
  reason?: string;
  notes?: string;
  items: IssuanceLineInput[];
}

interface IssuanceTransactionResponse {
  success: boolean;
  message: string;
  data: {
    reference_number: string;
    destination: string;
    issued_lines: Array<{
      item_id: number;
      requested_quantity: number;
      issued_quantity: number;
    }>;
    total_issued_quantity: number;
  };
}

interface AdjustmentItem {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name?: string;
  category_name?: string;
  measurement_unit: string | null;
  image_url: string | null;
  current_stock: number;
  expired_stock: number;
  shelf_life_days: number | null;
}

interface PaginatedAdjustmentItemsResponse {
  success: boolean;
  message: string;
  data: {
    data: AdjustmentItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface AdjustmentTransactionRequest {
  item_id: number;
  adjustment_mode: 'increase' | 'decrease';
  quantity: number;
  reason: string;
  notes?: string;
  purchase_date?: string;
  expiry_date?: string;
  manufactured_date?: string;
  confirm_expiration?: boolean;
}

interface AdjustmentTransactionResponse {
  success: boolean;
  message: string;
  data: {
    reference_number: string;
    item_id: number;
    item_code: string;
    item_description: string;
    adjustment_mode: 'increase' | 'decrease';
    adjusted_quantity: number;
    previous_stock: number;
    new_stock: number;
    confirm_expiration: boolean;
    purchase_date?: string | null;
    expiry_date?: string | null;
    manufactured_date?: string | null;
  };
}

export type {
  ReceivingItem,
  PaginatedReceivingItemsResponse,
  ReceivingTransactionRequest,
  ReceivingTransactionResponse,
  IssuanceItem,
  PaginatedIssuanceItemsResponse,
  IssuanceLineInput,
  IssuanceTransactionRequest,
  IssuanceTransactionResponse,
  AdjustmentItem,
  PaginatedAdjustmentItemsResponse,
  AdjustmentTransactionRequest,
  AdjustmentTransactionResponse
};

@Injectable({
  providedIn: 'root'
})
export class InventoryItemService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api/inventory/items';

  constructor(private http: HttpClient) {}

  private getHeaders(includeJsonContentType: boolean = true): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : ''
    });

    if (includeJsonContentType) {
      headers = headers.set('Content-Type', 'application/json');
    }

    return headers;
  }

  list(params: {
    page?: number;
    per_page?: number;
    search?: string;
    item_type_id?: number;
    category_id?: number;
    is_active?: boolean;
  }): Observable<PaginatedItemsResponse> {
    let queryParams = new HttpParams();

    if (params.page) queryParams = queryParams.set('page', String(params.page));
    if (params.per_page) queryParams = queryParams.set('per_page', String(params.per_page));
    if (params.search) queryParams = queryParams.set('search', params.search.trim());
    if (params.item_type_id) queryParams = queryParams.set('item_type_id', String(params.item_type_id));
    if (params.category_id) queryParams = queryParams.set('category_id', String(params.category_id));
    if (typeof params.is_active === 'boolean') {
      queryParams = queryParams.set('is_active', String(params.is_active));
    }

    return this.http.get<PaginatedItemsResponse>(`${this.baseUrl}`, {
      headers: this.getHeaders(),
      params: queryParams
    });
  }

  getById(itemId: number): Observable<ItemSingleResponse> {
    return this.http.get<ItemSingleResponse>(`${this.baseUrl}/${itemId}`, {
      headers: this.getHeaders()
    });
  }

  getOptions(): Observable<ItemOptionsResponse> {
    return this.http.get<ItemOptionsResponse>(`${this.baseUrl}/options`, {
      headers: this.getHeaders()
    });
  }

  create(payload: FormData): Observable<ItemSingleResponse> {
    return this.http.post<ItemSingleResponse>(`${this.baseUrl}`, payload, {
      headers: this.getHeaders(false)
    });
  }

  update(itemId: number, payload: FormData): Observable<ItemSingleResponse> {
    return this.http.put<ItemSingleResponse>(`${this.baseUrl}/${itemId}`, payload, {
      headers: this.getHeaders(false)
    });
  }

  updateStatus(itemId: number, is_active: boolean): Observable<ItemSingleResponse> {
    return this.http.patch<ItemSingleResponse>(
      `${this.baseUrl}/${itemId}/status`,
      { is_active },
      { headers: this.getHeaders() }
    );
  }

  listMinimumStock(params: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
  }): Observable<PaginatedMinimumStockResponse> {
    let queryParams = new HttpParams();

    if (params.page) queryParams = queryParams.set('page', String(params.page));
    if (params.per_page) queryParams = queryParams.set('per_page', String(params.per_page));
    if (params.search) queryParams = queryParams.set('search', params.search.trim());
    if (typeof params.is_active === 'boolean') {
      queryParams = queryParams.set('is_active', String(params.is_active));
    }

    return this.http.get<PaginatedMinimumStockResponse>(`${this.baseUrl}/minimum-stock`, {
      headers: this.getHeaders(),
      params: queryParams
    });
  }

  updateMinimumStock(itemId: number, reorder_level: number): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.baseUrl}/${itemId}/minimum-stock`,
      { reorder_level },
      { headers: this.getHeaders() }
    );
  }

  bulkUpdateMinimumStock(updates: Array<{ item_id: number; reorder_level: number }>): Observable<{ success: boolean; message: string }> {
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.baseUrl}/minimum-stock/bulk`,
      { updates },
      { headers: this.getHeaders() }
    );
  }

  // Receiving Transaction Methods
  getReceivingItems(params?: {
    search?: string;
    per_page?: number;
    page?: number;
    item_type_id?: number;
    category_id?: number;
  }): Observable<PaginatedReceivingItemsResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.item_type_id) httpParams = httpParams.set('item_type_id', params.item_type_id.toString());
      if (params.category_id) httpParams = httpParams.set('category_id', params.category_id.toString());
    } else {
      httpParams = httpParams.set('per_page', '15');
    }

    return this.http.get<PaginatedReceivingItemsResponse>(
      'http://127.0.0.1:8000/api/inventory/receiving/items',
      { params: httpParams, headers: this.getHeaders() }
    );
  }

  createReceivingTransaction(data: ReceivingTransactionRequest): Observable<ReceivingTransactionResponse> {
    return this.http.post<ReceivingTransactionResponse>(
      'http://127.0.0.1:8000/api/inventory/receiving/create',
      data,
      { headers: this.getHeaders() }
    );
  }

  getIssuanceItems(params?: {
    search?: string;
    per_page?: number;
    page?: number;
    category_id?: number;
  }): Observable<PaginatedIssuanceItemsResponse> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.category_id) httpParams = httpParams.set('category_id', params.category_id.toString());
    } else {
      httpParams = httpParams.set('per_page', '12');
    }

    return this.http.get<PaginatedIssuanceItemsResponse>(
      'http://127.0.0.1:8000/api/inventory/issuance/items',
      { params: httpParams, headers: this.getHeaders() }
    );
  }

  createIssuanceTransaction(data: IssuanceTransactionRequest): Observable<IssuanceTransactionResponse> {
    return this.http.post<IssuanceTransactionResponse>(
      'http://127.0.0.1:8000/api/inventory/issuance/create',
      data,
      { headers: this.getHeaders() }
    );
  }

  getAdjustmentItems(params?: {
    search?: string;
    per_page?: number;
    page?: number;
    category_id?: number;
  }): Observable<PaginatedAdjustmentItemsResponse> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.category_id) httpParams = httpParams.set('category_id', params.category_id.toString());
    } else {
      httpParams = httpParams.set('per_page', '12');
    }

    return this.http.get<PaginatedAdjustmentItemsResponse>(
      'http://127.0.0.1:8000/api/inventory/adjustment/items',
      { params: httpParams, headers: this.getHeaders() }
    );
  }

  createAdjustmentTransaction(data: AdjustmentTransactionRequest): Observable<AdjustmentTransactionResponse> {
    return this.http.post<AdjustmentTransactionResponse>(
      'http://127.0.0.1:8000/api/inventory/adjustment/create',
      data,
      { headers: this.getHeaders() }
    );
  }
}
