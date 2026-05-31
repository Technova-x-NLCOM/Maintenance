import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiBaseUrl } from './api-base';

export interface OperationTypeRow {
  operation_type_id: number;
  operation_name: string;
  operation_direction: 'IN' | 'OUT';
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface OperationTypeListResponse {
  success: boolean;
  message: string;
  data: {
    data: OperationTypeRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

interface OperationTypeSingleResponse {
  success: boolean;
  message: string;
  data: OperationTypeRow;
}

interface OperationTypeOptionsResponse {
  success: boolean;
  message: string;
  data: Array<OperationTypeRow & { display_name?: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class OperationTypeService {
  private readonly baseUrl = `${getApiBaseUrl()}/inventory/operation-types`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  list(params?: { page?: number; per_page?: number; search?: string; direction?: string; is_active?: boolean }): Observable<OperationTypeListResponse> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', String(params.page));
    if (params?.per_page) httpParams = httpParams.set('per_page', String(params.per_page));
    if (params?.search?.trim()) httpParams = httpParams.set('search', params.search.trim());
    if (params?.direction?.trim()) httpParams = httpParams.set('operation_direction', params.direction.trim());
    if (typeof params?.is_active === 'boolean') httpParams = httpParams.set('is_active', String(params.is_active));

    return this.http.get<OperationTypeListResponse>(this.baseUrl, {
      headers: this.getHeaders(),
      params: httpParams
    });
  }

  getOptions(direction?: 'IN' | 'OUT'): Observable<OperationTypeOptionsResponse> {
    let params = new HttpParams();
    if (direction) {
      params = params.set('direction', direction);
    }

    return this.http.get<OperationTypeOptionsResponse>(`${this.baseUrl}/options`, {
      headers: this.getHeaders(),
      params
    });
  }

  create(payload: {
    operation_name: string;
    operation_direction: 'IN' | 'OUT';
    description?: string | null;
    is_active?: boolean;
  }): Observable<OperationTypeSingleResponse> {
    return this.http.post<OperationTypeSingleResponse>(this.baseUrl, payload, {
      headers: this.getHeaders()
    });
  }

  update(operationTypeId: number, payload: Partial<{
    operation_name: string;
    operation_direction: 'IN' | 'OUT';
    description?: string | null;
    is_active?: boolean;
  }>): Observable<OperationTypeSingleResponse> {
    return this.http.put<OperationTypeSingleResponse>(`${this.baseUrl}/${operationTypeId}`, payload, {
      headers: this.getHeaders()
    });
  }

  delete(operationTypeId: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${operationTypeId}`, {
      headers: this.getHeaders()
    });
  }
}