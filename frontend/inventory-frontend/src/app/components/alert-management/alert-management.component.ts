import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Subscription, debounceTime, distinctUntilChanged, Subject } from 'rxjs';

export interface Alert {
  history_id: number;
  alert_type: string;
  alert_reference?: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'pending' | 'acknowledged' | 'resolved' | 'escalated';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  creator?: any;
  acknowledger?: any;
  resolver?: any;
}

export interface AlertFilters {
  type?: string;
  severity?: string;
  status?: string;
  search?: string;
}

export interface UserAlertSettings {
  alert_frequency: 'immediate' | 'daily' | 'weekly';
  expiry_warning_days: number;
  critical_expiry_days: number;
  warning_expiry_days: number;
  email_notifications: boolean;
  push_notifications: boolean;
}

@Component({
  selector: 'app-alert-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-management.component.html',
  styleUrl: './alert-management.component.scss'
})
export class AlertManagementComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef;

  alerts: Alert[] = [];
  selectedAlerts: Set<number> = new Set();
  filters: AlertFilters = {};
  loading = false;
  showFilters = false;
  showSettings = false;
  showAnalytics = false;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  perPage = 20;

  // Search
  private searchSubject = new Subject<string>();
  searchTerm = '';

  // Settings
  userSettings: UserAlertSettings = {
    alert_frequency: 'immediate',
    expiry_warning_days: 30,
    critical_expiry_days: 7,
    warning_expiry_days: 14,
    email_notifications: true,
    push_notifications: true
  };

  // Analytics
  analytics: any = null;

  // Mobile detection
  isMobile = false;
  isTablet = false;

  // Expose Math for template use
  Math = Math;

  private readonly API_URL = 'http://127.0.0.1:8000/api';
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.detectDevice();
  }

  ngOnInit() {
    this.loadAlerts();
    this.loadUserSettings();
    this.setupSearch();
    
    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      if (!this.showSettings && !this.showAnalytics) {
        this.loadAlerts();
      }
    }, 30000);

    this.subscriptions.push({
      unsubscribe: () => clearInterval(refreshInterval)
    } as Subscription);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private detectDevice() {
    const userAgent = navigator.userAgent;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    this.isTablet = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)|Android(?=.*\bTablet\b)/i.test(userAgent);
  }

  private setupSearch() {
    const searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.filters.search = searchTerm || undefined;
      this.currentPage = 1;
      this.loadAlerts();
    });

    this.subscriptions.push(searchSub);
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  loadAlerts() {
    this.loading = true;
    
    const params = new URLSearchParams();
    if (this.filters.type) params.append('type', this.filters.type);
    if (this.filters.severity) params.append('severity', this.filters.severity);
    if (this.filters.status) params.append('status', this.filters.status);
    if (this.filters.search) params.append('search', this.filters.search);
    params.append('page', this.currentPage.toString());
    params.append('per_page', this.perPage.toString());

    this.http.get<any>(`${this.API_URL}/alerts?${params.toString()}`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (response) => {
        this.alerts = response.data;
        this.currentPage = response.current_page;
        this.totalPages = response.last_page;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading alerts:', error);
        this.loading = false;
      }
    });
  }

  loadUserSettings() {
    this.http.get<UserAlertSettings>(`${this.API_URL}/alerts/settings`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (settings) => {
        this.userSettings = settings;
      },
      error: (error) => {
        console.error('Error loading user settings:', error);
      }
    });
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch() {
    this.searchTerm = '';
    this.searchSubject.next('');
  }

  toggleFilter(filterType: keyof AlertFilters, value: string) {
    if (this.filters[filterType] === value) {
      delete this.filters[filterType];
    } else {
      this.filters[filterType] = value;
    }
    this.currentPage = 1;
    this.loadAlerts();
  }

  clearFilters() {
    this.filters = {};
    this.currentPage = 1;
    this.loadAlerts();
  }

  toggleAlertSelection(alertId: number) {
    if (this.selectedAlerts.has(alertId)) {
      this.selectedAlerts.delete(alertId);
    } else {
      this.selectedAlerts.add(alertId);
    }
  }

  selectAllAlerts() {
    if (this.selectedAlerts.size === this.alerts.length) {
      this.selectedAlerts.clear();
    } else {
      this.alerts.forEach(alert => this.selectedAlerts.add(alert.history_id));
    }
  }

  bulkAcknowledge() {
    if (this.selectedAlerts.size === 0) return;

    const alertIds = Array.from(this.selectedAlerts);
    this.http.post(`${this.API_URL}/alerts/bulk-acknowledge`, {
      alert_ids: alertIds
    }, { headers: this.getHeaders() }).subscribe({
      next: (response: any) => {
        console.log(response.message);
        this.selectedAlerts.clear();
        this.loadAlerts();
      },
      error: (error) => {
        console.error('Error acknowledging alerts:', error);
      }
    });
  }

  bulkResolve() {
    if (this.selectedAlerts.size === 0) return;

    const alertIds = Array.from(this.selectedAlerts);
    this.http.post(`${this.API_URL}/alerts/bulk-resolve`, {
      alert_ids: alertIds
    }, { headers: this.getHeaders() }).subscribe({
      next: (response: any) => {
        console.log(response.message);
        this.selectedAlerts.clear();
        this.loadAlerts();
      },
      error: (error) => {
        console.error('Error resolving alerts:', error);
      }
    });
  }

  saveSettings() {
    this.http.put(`${this.API_URL}/alerts/settings`, this.userSettings, {
      headers: this.getHeaders()
    }).subscribe({
      next: (response: any) => {
        console.log('Settings saved successfully');
        this.showSettings = false;
      },
      error: (error) => {
        console.error('Error saving settings:', error);
      }
    });
  }

  loadAnalytics(period: string = '30d') {
    this.http.get(`${this.API_URL}/alerts/analytics?period=${period}`, {
      headers: this.getHeaders()
    }).subscribe({
      next: (analytics) => {
        this.analytics = analytics;
      },
      error: (error) => {
        console.error('Error loading analytics:', error);
      }
    });
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadAlerts();
    }
  }

  getSeverityClass(severity: string): string {
    return `severity-${severity}`;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  getPageNumbers(): number[] {
    const maxPages = Math.min(5, this.totalPages);
    return Array.from({ length: maxPages }, (_, i) => i + 1);
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.formatDate(dateString);
  }
}