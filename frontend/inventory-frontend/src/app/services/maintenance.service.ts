import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface MaintenanceTableInfo {
  name: string;
  primary_key: string | string[];
  soft_deletes: boolean;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private baseUrl = 'http://127.0.0.1:8000/api/maintenance';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  listTables(): Observable<MaintenanceTableInfo[]> {
    return this.http.get<MaintenanceTableInfo[]>(`${this.baseUrl}/tables`, { headers: this.getHeaders() });
  }

  getSchema(table: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${table}/schema`, { headers: this.getHeaders() });
  }

  listRows(table: string, opts: { page?: number; perPage?: number; showDeleted?: boolean; search?: string } = {}): Observable<any> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', String(opts.page));
    if (opts.perPage) params = params.set('perPage', String(opts.perPage));
    if (opts.showDeleted) params = params.set('showDeleted', String(opts.showDeleted));
    if (opts.search) params = params.set('search', opts.search);
    return this.http.get<any>(`${this.baseUrl}/${table}/rows`, { params, headers: this.getHeaders() });
  }

  createRow(table: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${table}/rows`, payload, { headers: this.getHeaders() });
  }

  updateRow(table: string, id: string | number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${table}/rows/${id}`, payload, { headers: this.getHeaders() });
  }

  deleteRow(table: string, id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${table}/rows/${id}`, { headers: this.getHeaders() });
  }

  restoreRow(table: string, id: string | number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${table}/rows/${id}/restore`, {}, { headers: this.getHeaders() });
  }
}
