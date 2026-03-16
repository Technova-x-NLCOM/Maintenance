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
}
