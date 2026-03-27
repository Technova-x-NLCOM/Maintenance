import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../../services/auth.service';
import { Subscription, filter, forkJoin, catchError, of } from 'rxjs';

export interface InventoryManagerStats {
  totalItems: number;
  lowStockItems: number;
  totalTransactions: number;
  myTransactions: number;
  pendingTransactions: number;
  pendingAlerts: number;
  totalCategories: number;
  expiringItems: number;
  activeBatches: number;
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
  selector: 'app-inventory-manager-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inventory-manager-dashboard.component.html',
  styleUrl: './inventory-manager-dashboard.component.scss'
})
export class InventoryManagerDashboardComponent implements OnInit, OnDestroy {
  user: User | null = null;
  stats: InventoryManagerStats | null = null;
  recentActivity: AuditLogEntry[] = [];
  systemAlerts: SystemAlert[] = [];
  loading = true;
  readonly skeletonCards = Array.from({ length: 4 });
  private routerSubscription: Subscription | null = null;

  private readonly API_URL = 'http://127.0.0.1:8000/api';

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  get topPriorityMessage(): string {
    if (!this.stats) {
      return 'Loading inventory priorities...';
    }

    if (this.stats.pendingAlerts > 0) {
      return `${this.stats.pendingAlerts} alert(s) require immediate inventory follow-up.`;
    }

    if (this.stats.expiringItems > 0) {
      return `${this.stats.expiringItems} item(s) are approaching expiration and should be rotated.`;
    }

    if (this.stats.lowStockItems > 0) {
      return `${this.stats.lowStockItems} item(s) are below stock threshold.`;
    }

    return 'Inventory operations are currently stable.';
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.loadDashboardData();
    
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.route.snapshot.component === InventoryManagerDashboardComponent) {
          this.loadDashboardData();
        }
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
    this.loading = true;
    
    const stats$ = this.http.get<InventoryManagerStats>(`${this.API_URL}/inventory-manager/stats`, { headers: this.getAuthHeaders() })
      .pipe(catchError(err => {
        console.error('Error loading inventory manager stats:', err);
        return of({
          totalItems: 0,
          lowStockItems: 0,
          totalTransactions: 0,
          myTransactions: 0,
          pendingTransactions: 0,
          pendingAlerts: 0,
          totalCategories: 0,
          expiringItems: 0,
          activeBatches: 0
        } as InventoryManagerStats);
      }));

    const activity$ = this.http.get<AuditLogEntry[]>(`${this.API_URL}/inventory-manager/activity?limit=10`, { headers: this.getAuthHeaders() })
      .pipe(catchError(err => {
        console.error('Error loading activity:', err);
        return of([] as AuditLogEntry[]);
      }));

    const alerts$ = this.http.get<SystemAlert[]>(`${this.API_URL}/inventory-manager/alerts`, { headers: this.getAuthHeaders() })
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
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
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

  getAlertRoute(alert: SystemAlert): string {
    const lookup = `${alert.type} ${alert.message}`.toLowerCase();

    if (lookup.includes('batch')) {
      return '/dashboard/inventory/batch-distribution';
    }

    if (lookup.includes('receive') || lookup.includes('receiving')) {
      return '/dashboard/inventory/receiving';
    }

    if (lookup.includes('issue') || lookup.includes('issuance')) {
      return '/dashboard/inventory/issuance';
    }

    if (lookup.includes('transaction') || lookup.includes('audit') || lookup.includes('log')) {
      return '/dashboard/monitoring/transaction-history';
    }

    if (
      lookup.includes('stock') ||
      lookup.includes('inventory') ||
      lookup.includes('item') ||
      lookup.includes('expire') ||
      lookup.includes('category')
    ) {
      return '/dashboard/inventory/items';
    }

    return '/dashboard/inventory/items';
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

  getRelativeTime(dateString: string): string {
    const eventDate = new Date(dateString);
    const elapsed = Date.now() - eventDate.getTime();

    if (Number.isNaN(eventDate.getTime())) {
      return this.formatDate(dateString);
    }

    const minutes = Math.floor(elapsed / (1000 * 60));

    if (minutes < 1) {
      return 'Just now';
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hr ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    return this.formatDate(dateString);
  }

  trackByAlert(_: number, alert: SystemAlert): string | number {
    return alert.alert_id;
  }

  trackByLog(_: number, log: AuditLogEntry): number {
    return log.log_id;
  }
}
