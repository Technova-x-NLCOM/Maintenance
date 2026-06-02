import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiBaseUrl } from './api-base';

export interface RecipeTypeRow {
  recipe_type_id: number;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

interface RecipeTypeListResponse {
  success: boolean;
  message: string;
  data: {
    data: RecipeTypeRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface RecipeTypeSingleResponse {
  success: boolean;
  message: string;
  data: RecipeTypeRow;
}

export interface RecipeTypeOption {
  recipe_type_id: number;
  name: string;
}

interface RecipeTypeOptionsResponse {
  success: boolean;
  message: string;
  data: RecipeTypeOption[];
}

@Injectable({
  providedIn: 'root'
})
export class RecipeTypeService {
  private readonly baseUrl = `${getApiBaseUrl()}/inventory/recipe-types`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  list(params?: { page?: number; per_page?: number; search?: string }): Observable<RecipeTypeListResponse> {
    let httpParams = new HttpParams();
    if (params?.page)            httpParams = httpParams.set('page',     String(params.page));
    if (params?.per_page)        httpParams = httpParams.set('per_page', String(params.per_page));
    if (params?.search?.trim())  httpParams = httpParams.set('search',   params.search.trim());

    return this.http.get<RecipeTypeListResponse>(this.baseUrl, {
      headers: this.getHeaders(),
      params: httpParams
    });
  }

  getOptions(): Observable<RecipeTypeOptionsResponse> {
    return this.http.get<RecipeTypeOptionsResponse>(`${this.baseUrl}/options`, {
      headers: this.getHeaders()
    });
  }

  create(payload: { name: string; description?: string | null }): Observable<RecipeTypeSingleResponse> {
    return this.http.post<RecipeTypeSingleResponse>(this.baseUrl, payload, {
      headers: this.getHeaders()
    });
  }

  update(id: number, payload: { name: string; description?: string | null }): Observable<RecipeTypeSingleResponse> {
    return this.http.put<RecipeTypeSingleResponse>(`${this.baseUrl}/${id}`, payload, {
      headers: this.getHeaders()
    });
  }

  delete(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`, {
      headers: this.getHeaders()
    });
  }
}
