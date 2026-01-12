import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../../services/auth.service';

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
  performed_by: number;
  performed_by_name?: string;
  ip_address: string;
  created_at: string;
}

export interface SystemAlert {
  alert_id: number | string;
  type: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  created_at: string;
  acknowledged: boolean;
}

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './super-admin-dashboard.component.html',
  styleUrl: './super-admin-dashboard.component.scss'
})
export class SuperAdminDashboardComponent implements OnInit {
  user: User | null = null;
  stats: DashboardStats | null = null;
  recentActivity: AuditLogEntry[] = [];
  systemAlerts: SystemAlert[] = [];
  loading = true;

  private readonly API_URL = 'http://127.0.0.1:8000/api';

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.loadDashboardData();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  loadDashboardData() {
    this.loading = true;
    
    this.http.get<DashboardStats>(`${this.API_URL}/super-admin/stats`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (stats: DashboardStats) => {
          this.stats = stats;
        },
        error: () => {
          this.stats = {
            totalUsers: 0,
            activeUsers: 0,
            totalItems: 0,
            lowStockItems: 0,
            totalTransactions: 0,
            pendingAlerts: 0,
            totalCategories: 0,
            expiringItems: 0
          };
        }
      });

    this.http.get<AuditLogEntry[]>(`${this.API_URL}/super-admin/activity?limit=10`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (activity: AuditLogEntry[]) => {
          this.recentActivity = activity;
          this.loading = false;
        },
        error: () => {
          this.recentActivity = [];
          this.loading = false;
        }
      });

    this.http.get<SystemAlert[]>(`${this.API_URL}/super-admin/alerts`, { headers: this.getAuthHeaders() })
      .subscribe({
        next: (alerts: SystemAlert[]) => {
          this.systemAlerts = alerts;
        },
        error: () => {
          this.systemAlerts = [];
        }
      });
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'INSERT': return 'action-insert';
      case 'UPDATE': return 'action-update';
      case 'DELETE': return 'action-delete';
      default: return '';
    }
  }

  getAlertClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'alert-critical';
      case 'warning': return 'alert-warning';
      case 'info': return 'alert-info';
      default: return '';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
