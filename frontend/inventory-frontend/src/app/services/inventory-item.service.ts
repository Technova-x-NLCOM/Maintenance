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
  is_active: boolean;
  created_by: number | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemPayload {
  item_code: string;
  item_description: string;
  item_type_id: number;
  category_id?: number | null;
  measurement_unit?: string | null;
  particular?: string | null;
  mg_dosage?: number | null;
  image_url?: string | null;
  remarks?: string | null;
  unit_value?: number | null;
  reorder_level?: number;
  is_active?: boolean;
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

@Injectable({
  providedIn: 'root'
})
export class InventoryItemService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api/inventory/items';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
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

  create(payload: InventoryItemPayload): Observable<ItemSingleResponse> {
    return this.http.post<ItemSingleResponse>(`${this.baseUrl}`, payload, {
      headers: this.getHeaders()
    });
  }

  update(itemId: number, payload: Partial<InventoryItemPayload>): Observable<ItemSingleResponse> {
    return this.http.put<ItemSingleResponse>(`${this.baseUrl}/${itemId}`, payload, {
      headers: this.getHeaders()
    });
  }

  updateStatus(itemId: number, is_active: boolean): Observable<ItemSingleResponse> {
    return this.http.patch<ItemSingleResponse>(
      `${this.baseUrl}/${itemId}/status`,
      { is_active },
      { headers: this.getHeaders() }
    );
  }
}
