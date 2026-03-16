import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InventoryCategory {
  category_id: number;
  category_name: string;
  parent_category_id: number | null;
  parent_category_name?: string | null;
  description: string | null;
  created_at: string;
  child_count?: number;
  item_count?: number;
}

export interface CategoryItem {
  item_id: number;
  item_code: string;
  item_description: string;
  image_url?: string | null;
  is_active: boolean;
  category_id: number | null;
  category_name?: string | null;
  item_type_name?: string | null;
}

interface CategoryListResponse {
  success: boolean;
  message: string;
  data: InventoryCategory[];
}

interface CategorySingleResponse {
  success: boolean;
  message: string;
  data: InventoryCategory;
}

interface CategoryOptionsResponse {
  success: boolean;
  message: string;
  data: {
    categories: Array<{
      category_id: number;
      category_name: string;
      parent_category_id: number | null;
    }>;
  };
}

interface CategoryItemsResponse {
  success: boolean;
  message: string;
  data: CategoryItem[];
}

@Injectable({
  providedIn: 'root'
})
export class InventoryCategoryService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api/inventory/categories';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  list(search?: string): Observable<CategoryListResponse> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<CategoryListResponse>(this.baseUrl, {
      headers: this.getHeaders(),
      params
    });
  }

  getById(categoryId: number): Observable<CategorySingleResponse> {
    return this.http.get<CategorySingleResponse>(`${this.baseUrl}/${categoryId}`, {
      headers: this.getHeaders()
    });
  }

  getOptions(): Observable<CategoryOptionsResponse> {
    return this.http.get<CategoryOptionsResponse>(`${this.baseUrl}/options`, {
      headers: this.getHeaders()
    });
  }

  create(payload: {
    category_name: string;
    parent_category_id?: number | null;
    description?: string | null;
  }): Observable<CategorySingleResponse> {
    return this.http.post<CategorySingleResponse>(this.baseUrl, payload, {
      headers: this.getHeaders()
    });
  }

  update(
    categoryId: number,
    payload: Partial<{
      category_name: string;
      parent_category_id?: number | null;
      description?: string | null;
    }>
  ): Observable<CategorySingleResponse> {
    return this.http.put<CategorySingleResponse>(`${this.baseUrl}/${categoryId}`, payload, {
      headers: this.getHeaders()
    });
  }

  delete(categoryId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${categoryId}`, {
      headers: this.getHeaders()
    });
  }

  listCategoryItems(categoryId: number, search?: string): Observable<CategoryItemsResponse> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<CategoryItemsResponse>(`${this.baseUrl}/${categoryId}/items`, {
      headers: this.getHeaders(),
      params
    });
  }

  listAssignableItems(search?: string): Observable<CategoryItemsResponse> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<CategoryItemsResponse>(`${this.baseUrl}/items/available`, {
      headers: this.getHeaders(),
      params
    });
  }

  assignItem(categoryId: number, itemId: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/${categoryId}/items`,
      { item_id: itemId },
      { headers: this.getHeaders() }
    );
  }

  assignItems(categoryId: number, itemIds: number[]): Observable<{ success: boolean; message: string; assigned_count?: number }> {
    return this.http.post<{ success: boolean; message: string; assigned_count?: number }>(
      `${this.baseUrl}/${categoryId}/items`,
      { item_ids: itemIds },
      { headers: this.getHeaders() }
    );
  }

  removeItem(categoryId: number, itemId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${categoryId}/items/${itemId}`, {
      headers: this.getHeaders()
    });
  }
}
