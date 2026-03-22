import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../../services/auth.service';
import { TopbarActionService } from '../../../services/topbar-action.service';
import { PaginationComponent } from '../../../components/pagination/pagination.component';
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

interface DashboardSectionCard {
  title: string;
  count: number;
  subtitle: string;
}

interface DashboardExpiryRow {
  itemName: string;
  batchLabel: string;
  daysLeft: number;
}

interface DashboardTransactionRow {
  dateLabel: string;
  itemName: string;
  type: string;
  quantityLabel: string;
  performedBy: string;
  destination: string;
}

interface DashboardPreviewResponse {
  totalItemTypesCount: number;
  inventoryValue: number;
  sectionCards: DashboardSectionCard[];
  expiryRows: DashboardExpiryRow[];
  recentTransactions: DashboardTransactionRow[];
}

@Component({
  selector: 'app-inventory-manager-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, PaginationComponent],
  templateUrl: './inventory-manager-dashboard.component.html',
  styleUrl: './inventory-manager-dashboard.component.scss'
})
export class InventoryManagerDashboardComponent implements OnInit, OnDestroy {
  user: User | null = null;
  stats: InventoryManagerStats | null = null;
  sectionCards: DashboardSectionCard[] = [];
  expiryRows: DashboardExpiryRow[] = [];
  recentTransactions: DashboardTransactionRow[] = [];
  txPage = 1;
  txPerPage = 5;
  totalItemTypesCount = 0;
  inventoryValue = 0;
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
    private topbarAction: TopbarActionService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
    this.loadDashboardData();
    this.topbarAction.setPrintHandler(() => window.print());

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
    this.topbarAction.setPrintHandler(null);
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

    const preview$ = this.http.get<DashboardPreviewResponse>(`${this.API_URL}/inventory-manager/dashboard-preview`, { headers: this.getAuthHeaders() })
      .pipe(catchError(err => {
        console.error('Error loading dashboard preview:', err);
        return of({
          totalItemTypesCount: 0,
          inventoryValue: 0,
          sectionCards: [],
          expiryRows: [],
          recentTransactions: []
        } as DashboardPreviewResponse);
      }));

    forkJoin([stats$, preview$]).subscribe({
      next: ([stats, preview]) => {
        this.ngZone.run(() => {
          this.stats = stats;
          this.totalItemTypesCount = Number(preview.totalItemTypesCount || 0);
          this.inventoryValue = Number(preview.inventoryValue || 0);
          this.sectionCards = Array.isArray(preview.sectionCards) ? preview.sectionCards : [];
          this.expiryRows = Array.isArray(preview.expiryRows) ? preview.expiryRows : [];
          this.recentTransactions = Array.isArray(preview.recentTransactions) ? preview.recentTransactions : [];
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

  formatCompactPeso(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return 'P0';
    }

    if (value >= 1000000) {
      return `P${(value / 1000000).toFixed(1)}M`;
    }

    if (value >= 1000) {
      return `P${(value / 1000).toFixed(1)}K`;
    }

    return `P${Math.round(value).toLocaleString()}`;
  }

  getAlertTone(daysLeft: number): 'critical' | 'warning' | 'safe' {
    if (daysLeft <= 7) return 'critical';
    if (daysLeft <= 14) return 'warning';
    return 'safe';
  }

  getTxTone(type: string): 'in' | 'out' | 'other' {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'IN') return 'in';
    if (normalized === 'OUT') return 'out';
    return 'other';
  }

  get txTotalPages(): number {
    return Math.max(1, Math.ceil(this.recentTransactions.length / this.txPerPage));
  }

  get pagedRecentTransactions(): DashboardTransactionRow[] {
    const start = (this.txPage - 1) * this.txPerPage;
    return this.recentTransactions.slice(start, start + this.txPerPage);
  }

  onTxPageChange(page: number): void {
    this.txPage = page;
  }
}
