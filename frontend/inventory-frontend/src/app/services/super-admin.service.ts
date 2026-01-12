import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalItems: number;
  lowStockItems: number;
  totalTransactions: number;
  pendingAlerts: number;
  totalCategories: number;
  expiringItems: number;
}

export interface AuditLogEntry {
  log_id: number;
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values: any;
  new_values: any;
  performed_by: number;
  performed_by_name?: string;
  ip_address: string;
  created_at: string;
}

export interface SystemAlert {
  alert_id: number;
  type: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  created_at: string;
  acknowledged: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SuperAdminService {
  private readonly API_URL = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      `${this.API_URL}/super-admin/stats`,
      { headers: this.getAuthHeaders() }
    );
  }

  getRecentActivity(limit: number = 10): Observable<AuditLogEntry[]> {
    return this.http.get<AuditLogEntry[]>(
      `${this.API_URL}/super-admin/activity?limit=${limit}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getSystemAlerts(): Observable<SystemAlert[]> {
    return this.http.get<SystemAlert[]>(
      `${this.API_URL}/super-admin/alerts`,
      { headers: this.getAuthHeaders() }
    );
  }

  acknowledgeAlert(alertId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.API_URL}/super-admin/alerts/${alertId}/acknowledge`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }
}
