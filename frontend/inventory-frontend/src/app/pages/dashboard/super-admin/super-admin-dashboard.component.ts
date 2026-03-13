import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../../services/auth.service';
import { OfflineService } from '../../../services/offline.service';
import { Subscription, filter, forkJoin, catchError, of } from 'rxjs';

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
export class SuperAdminDashboardComponent implements OnInit, OnDestroy {
  user: User | null = null;
  stats: DashboardStats | null = null;
  recentActivity: AuditLogEntry[] = [];
  systemAlerts: SystemAlert[] = [];
  loading = true;
  private routerSubscription: Subscription | null = null;

  private readonly API_URL = 'http://127.0.0.1:8000/api';

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private offlineService: OfflineService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.loadDashboardData();
    
    // Refresh data when navigating back to this component
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Check if this component's route is active
        if (this.route.snapshot.component === SuperAdminDashboardComponent) {
          this.loadDashboardData();
        }
      });

    // Listen for online/offline status
    this.offlineService.isOnline$.subscribe(isOnline => {
      if (isOnline) {
        this.loadDashboardData();
      } else {
        this.loadOfflineData();
      }
    });

    // Listen for sync events
    window.addEventListener('online-sync', () => {
      this.loadDashboardData();
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  loadDashboardData() {
    if (!this.offlineService.isOnline()) {
      this.loadOfflineData();
      return;
    }

    this.loading = true;
    
    const stats$ = this.http.get<DashboardStats>(`${this.API_URL}/super-admin/stats`, { headers: this.getAuthHeaders() })
      .pipe(catchError(err => {
        console.error('Error loading super admin stats:', err);
        return of({
          totalUsers: 0,
          activeUsers: 0,
          totalItems: 0,
          lowStockItems: 0,
          totalTransactions: 0,
          pendingAlerts: 0,
          totalCategories: 0,
          expiringItems: 0
        } as DashboardStats);
      }));

    const activity$ = this.http.get<AuditLogEntry[]>(`${this.API_URL}/super-admin/activity?limit=10`, { headers: this.getAuthHeaders() })
      .pipe(catchError(err => {
        console.error('Error loading activity:', err);
        return of([] as AuditLogEntry[]);
      }));

    const alerts$ = this.http.get<SystemAlert[]>(`${this.API_URL}/super-admin/alerts`, { headers: this.getAuthHeaders() })
      .pipe(catchError(err => {
        console.error('Error loading alerts:', err);
        return of([] as SystemAlert[]);
      }));

    forkJoin([stats$, activity$, alerts$]).subscribe({
      next: ([stats, activity, alerts]) => {
        this.ngZone.run(() => {
          this.stats = stats;
          this.recentActivity = activity;
          this.systemAlerts = alerts;
          this.loading = false;
          
          // Cache data for offline use
          this.offlineService.cacheData(alerts, { stats, activity });
          
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadOfflineData();
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  private loadOfflineData() {
    const cachedAlerts = this.offlineService.getCachedAlerts();
    const cachedData = this.offlineService.getCachedUserSettings();
    
    if (cachedData) {
      this.stats = cachedData?.stats || {
        totalUsers: 0,
        activeUsers: 0,
        totalItems: 0,
        lowStockItems: 0,
        totalTransactions: 0,
        pendingAlerts: 0,
        totalCategories: 0,
        expiringItems: 0
      };
      this.recentActivity = cachedData?.activity || [];
      this.systemAlerts = cachedAlerts;
      this.loading = false;
      this.cdr.detectChanges();
    }
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
