import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MaintenanceTableInfo {
  name: string;
  primary_key: string | string[];
  soft_deletes: boolean;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private baseUrl = '/api/maintenance';

  constructor(private http: HttpClient) {}

  listTables(): Observable<MaintenanceTableInfo[]> {
    return this.http.get<MaintenanceTableInfo[]>(`${this.baseUrl}/tables`);
  }

  getSchema(table: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${table}/schema`);
  }

  listRows(table: string, opts: { page?: number; perPage?: number; showDeleted?: boolean } = {}): Observable<any> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', String(opts.page));
    if (opts.perPage) params = params.set('perPage', String(opts.perPage));
    if (opts.showDeleted) params = params.set('showDeleted', String(opts.showDeleted));
    return this.http.get<any>(`${this.baseUrl}/${table}/rows`, { params });
  }

  createRow(table: string, payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${table}/rows`, payload);
  }

  updateRow(table: string, id: string | number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${table}/rows/${id}`, payload);
  }

  deleteRow(table: string, id: string | number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${table}/rows/${id}`);
  }

  restoreRow(table: string, id: string | number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${table}/rows/${id}/restore`, {});
  }
}
