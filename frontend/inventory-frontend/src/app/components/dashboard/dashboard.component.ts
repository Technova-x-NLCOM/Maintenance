import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
  NgZone,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';
import { Subscription, filter, forkJoin, catchError, of, switchMap, map } from 'rxjs';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartOptions,
  TooltipItem,
  registerables
} from 'chart.js';

Chart.register(...registerables);

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

type TrendDirection = 'up' | 'down' | 'steady';

interface KpiTrend {
  direction: TrendDirection;
  description: string;
}

interface RestockRow {
  item: string;
  currentStock: number;
  minimumThreshold: number;
  status: 'critical' | 'warning' | 'healthy';
}

interface StockReportRecord {
  item_id: number;
  item_code: string;
  item_description: string;
  category_name: string | null;
  reorder_level: number;
  current_stock: number;
}

interface TransactionRecord {
  transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  transaction_date: string;
  batch_number?: string | null;
}

interface PaginatedApiResponse<T> {
  data: {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('restockChart') restockChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('movementChart') movementChartRef?: ElementRef<HTMLCanvasElement>;

  user: User | null = null;
  stats: DashboardStats | null = null;
  recentActivity: AuditLogEntry[] = [];
  systemAlerts: SystemAlert[] = [];
  readonly cardPreviewLimit = 3;
  readonly alertsViewAllRoute = '/dashboard/monitoring/stock-report';
  readonly activityViewAllRoute = '/dashboard/monitoring/transaction-history';
  loading = true;
  readonly skeletonCards = Array.from({ length: 5 });
  private routerSubscription: Subscription | null = null;
  private restockChart: Chart<'bar'> | null = null;
  private categoryChart: Chart<'doughnut'> | null = null;
  private movementChart: Chart<'line'> | null = null;
  stockTrend: KpiTrend = {
    direction: 'steady',
    description: 'No change this month'
  };
  usersTrend: KpiTrend = {
    direction: 'steady',
    description: 'No change this month'
  };
  transactionTrend: KpiTrend = {
    direction: 'steady',
    description: 'No change this month'
  };
  categoryTrend: KpiTrend = {
    direction: 'steady',
    description: 'No change this month'
  };
  alertsTrend: KpiTrend = {
    direction: 'steady',
    description: 'No change this month'
  };

  restockRows: RestockRow[] = [];

  restockBarData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Current stock',
        data: [],
        borderRadius: 6,
        backgroundColor: []
      },
      {
        label: 'Minimum threshold',
        data: [],
        borderRadius: 6,
        backgroundColor: '#94a3b8'
      }
    ]
  };

  readonly restockBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: '#51627d'
        },
        grid: {
          color: '#e2e8f0'
        }
      },
      y: {
        ticks: {
          color: '#243349'
        },
        grid: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: '#243349'
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        displayColors: false,
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const row = this.restockRows[context.dataIndex];
            const value = Number(context.raw) || 0;

            if (context.dataset.label === 'Current stock') {
              return `Current stock: ${value} units (${this.getStockStateLabel(row.status)} level)`;
            }

            return `Minimum needed: ${value} units`;
          },
          afterBody: (_context: TooltipItem<'bar'>[]) => 'Meaning: reorder when current stock is lower than minimum needed.'
        }
      }
    }
  };

  categoryDonutData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6
      }
    ]
  };

  readonly categoryDonutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#243349',
          usePointStyle: true,
          boxWidth: 10,
          padding: 16
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => {
            const label = context.label || '';
            const value = Number(context.raw) || 0;
            const total = context.dataset.data.reduce((sum: number, point: number) => sum + Number(point || 0), 0);
            const percent = total ? Math.round((value / total) * 100) : 0;
            return `${label}: ${value} items (${percent}% of inventory)`;
          },
          afterLabel: () => 'Click a legend item to show or hide a category.'
        }
      }
    }
  };

  stockMovementData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Items in',
        data: [],
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.16)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4
      },
      {
        label: 'Items out',
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.11)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4
      }
    ]
  };

  readonly stockMovementOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    scales: {
      x: {
        ticks: {
          color: '#51627d',
          maxTicksLimit: 8
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#51627d'
        },
        grid: {
          color: '#e2e8f0'
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#243349',
          usePointStyle: true,
          boxWidth: 10
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (context: TooltipItem<'line'>) => `${context.dataset.label}: ${context.raw} items`,
          afterBody: (_context: TooltipItem<'line'>[]) => 'Meaning: compare daily incoming stock versus outgoing stock.'
        }
      }
    }
  };

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
      return 'Loading operational priorities...';
    }

    if (this.stats.pendingAlerts > 0) {
      return `${this.stats.pendingAlerts} pending alert(s) need immediate review.`;
    }

    if (this.stats.expiringItems > 0) {
      return `${this.stats.expiringItems} item(s) are approaching expiration and should be rotated.`;
    }

    if (this.stats.lowStockItems > 0) {
      return `${this.stats.lowStockItems} item(s) are below stock threshold.`;
    }

    return 'All critical signals are currently stable.';
  }

  getTrendClass(direction: TrendDirection): string {
    return `trend-${direction}`;
  }

  get visibleSystemAlerts(): SystemAlert[] {
    return this.systemAlerts.slice(0, this.cardPreviewLimit);
  }

  get visibleRecentActivity(): AuditLogEntry[] {
    return this.recentActivity.slice(0, this.cardPreviewLimit);
  }

  get hiddenSystemAlertsCount(): number {
    return Math.max(this.systemAlerts.length - this.cardPreviewLimit, 0);
  }

  get hiddenRecentActivityCount(): number {
    return Math.max(this.recentActivity.length - this.cardPreviewLimit, 0);
  }

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
        if (this.route.snapshot.component === DashboardComponent) {
          this.loadDashboardData();
        }
      });
  }

  ngAfterViewInit() {
    this.ensureChartsRendered();
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    this.destroyCharts();
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

    const stockReport$ = this.getStockReportRows().pipe(catchError(err => {
      console.error('Error loading stock report:', err);
      return of([] as StockReportRecord[]);
    }));

    const transactions$ = this.getRecentTransactions(65).pipe(catchError(err => {
      console.error('Error loading 30-day transactions:', err);
      return of([] as TransactionRecord[]);
    }));

    forkJoin([stats$, activity$, alerts$, stockReport$, transactions$]).subscribe({
      next: ([stats, activity, alerts, stockReport, transactions]) => {
        this.ngZone.run(() => {
          this.stats = stats;
          this.recentActivity = activity;
          this.systemAlerts = alerts;
          this.updateTrendIndicators(transactions, alerts);
          this.applyLiveChartData(stockReport, transactions);
          this.refreshCharts();
          this.loading = false;
          this.cdr.detectChanges();
          this.ensureChartsRendered();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
          this.ensureChartsRendered();
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

    if (lookup.includes('role') || lookup.includes('permission') || lookup.includes('access')) {
      return '/dashboard/roles';
    }

    if (lookup.includes('user') || lookup.includes('account') || lookup.includes('login')) {
      return '/dashboard/system-users';
    }

    if (
      lookup.includes('stock') ||
      lookup.includes('inventory') ||
      lookup.includes('item') ||
      lookup.includes('expire') ||
      lookup.includes('batch')
    ) {
      return '/dashboard/inventory/items';
    }

    if (lookup.includes('transaction') || lookup.includes('audit') || lookup.includes('log')) {
      return '/dashboard/monitoring/transaction-history';
    }

    if (lookup.includes('category')) {
      return '/dashboard/inventory/categories';
    }

    return '/dashboard/settings';
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

  private renderCharts(): void {
    if (this.restockChartRef?.nativeElement) {
      this.restockChart = new Chart(this.restockChartRef.nativeElement, {
        type: 'bar',
        data: this.restockBarData,
        options: this.restockBarOptions
      });
    }

    if (this.categoryChartRef?.nativeElement) {
      this.categoryChart = new Chart(this.categoryChartRef.nativeElement, {
        type: 'doughnut',
        data: this.categoryDonutData,
        options: this.categoryDonutOptions
      });
    }

    if (this.movementChartRef?.nativeElement) {
      this.movementChart = new Chart(this.movementChartRef.nativeElement, {
        type: 'line',
        data: this.stockMovementData,
        options: this.stockMovementOptions
      });
    }
  }

  private refreshCharts(): void {
    if (this.restockChart) {
      this.restockChart.data = this.restockBarData;
      this.restockChart.update();
    }

    if (this.categoryChart) {
      this.categoryChart.data = this.categoryDonutData;
      this.categoryChart.update();
    }

    if (this.movementChart) {
      this.movementChart.data = this.stockMovementData;
      this.movementChart.update();
    }
  }

  private ensureChartsRendered(): void {
    setTimeout(() => {
      if (!this.restockChart || !this.categoryChart || !this.movementChart) {
        this.destroyCharts();
        this.renderCharts();
      }

      this.refreshCharts();
    }, 0);
  }

  private destroyCharts(): void {
    this.restockChart?.destroy();
    this.categoryChart?.destroy();
    this.movementChart?.destroy();

    this.restockChart = null;
    this.categoryChart = null;
    this.movementChart = null;
  }

  private getRestockColor(status: RestockRow['status']): string {
    if (status === 'critical') {
      return '#dc2626';
    }

    if (status === 'warning') {
      return '#f59e0b';
    }

    return '#16a34a';
  }

  private getStockStateLabel(status: RestockRow['status']): string {
    if (status === 'critical') {
      return 'critical';
    }

    if (status === 'warning') {
      return 'warning';
    }

    return 'healthy';
  }

  private getStockReportRows() {
    const params = new HttpParams().set('page', '1').set('per_page', '500');
    return this.http
      .get<PaginatedApiResponse<StockReportRecord>>(`${this.API_URL}/inventory/transactions/stock-report`, {
        headers: this.getAuthHeaders(),
        params
      })
      .pipe(map(response => response.data.data || []));
  }

  private getRecentTransactions(daysBack: number) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const dateFrom = fromDate.toISOString().split('T')[0];

    let pageOneParams = new HttpParams()
      .set('page', '1')
      .set('per_page', '100')
      .set('date_from', dateFrom);

    return this.http
      .get<PaginatedApiResponse<TransactionRecord>>(`${this.API_URL}/inventory/transactions`, {
        headers: this.getAuthHeaders(),
        params: pageOneParams
      })
      .pipe(
        switchMap(firstPage => {
          const firstPageRows = firstPage.data.data || [];
          const lastPage = firstPage.data.last_page || 1;

          if (lastPage <= 1) {
            return of(firstPageRows);
          }

          const remainingRequests = Array.from({ length: lastPage - 1 }, (_, index) => {
            const page = index + 2;
            const params = new HttpParams()
              .set('page', String(page))
              .set('per_page', '100')
              .set('date_from', dateFrom);

            return this.http.get<PaginatedApiResponse<TransactionRecord>>(`${this.API_URL}/inventory/transactions`, {
              headers: this.getAuthHeaders(),
              params
            });
          });

          return forkJoin(remainingRequests).pipe(
            map(otherPages => {
              const rows = otherPages.flatMap(page => page.data.data || []);
              return [...firstPageRows, ...rows];
            })
          );
        })
      );
  }

  private updateTrendIndicators(transactions: TransactionRecord[], alerts: SystemAlert[]): void {
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    const inCurrent = transactions
      .filter(txn => txn.transaction_type === 'IN' && this.isInRange(txn.transaction_date, currentMonthStart, new Date()))
      .reduce((sum, txn) => sum + (Number(txn.quantity) || 0), 0);

    const inPrevious = transactions
      .filter(txn => txn.transaction_type === 'IN' && this.isInRange(txn.transaction_date, previousMonthStart, currentMonthStart))
      .reduce((sum, txn) => sum + (Number(txn.quantity) || 0), 0);

    const txCountCurrent = transactions.filter(txn => this.isInRange(txn.transaction_date, currentMonthStart, new Date())).length;
    const txCountPrevious = transactions.filter(txn => this.isInRange(txn.transaction_date, previousMonthStart, currentMonthStart)).length;

    const usersCurrent = new Set(
      this.recentActivity
        .filter(log => this.isInRange(log.created_at, currentMonthStart, new Date()))
        .map(log => log.performed_by)
    ).size;
    const usersPrevious = new Set(
      this.recentActivity
        .filter(log => this.isInRange(log.created_at, previousMonthStart, currentMonthStart))
        .map(log => log.performed_by)
    ).size;

    const categoryCurrent = new Set(
      this.recentActivity
        .filter(log => log.table_name?.toLowerCase().includes('categor') && this.isInRange(log.created_at, currentMonthStart, new Date()))
        .map(log => log.record_id)
    ).size;
    const categoryPrevious = new Set(
      this.recentActivity
        .filter(log => log.table_name?.toLowerCase().includes('categor') && this.isInRange(log.created_at, previousMonthStart, currentMonthStart))
        .map(log => log.record_id)
    ).size;

    const alertsCurrent = alerts.filter(alert => this.isInRange(alert.created_at, currentMonthStart, new Date())).length;
    const alertsPrevious = alerts.filter(alert => this.isInRange(alert.created_at, previousMonthStart, currentMonthStart)).length;

    this.stockTrend = this.buildMoMTrend(inCurrent, inPrevious, 'incoming stock');
    this.usersTrend = this.buildMoMTrend(usersCurrent, usersPrevious, 'active users');
    this.transactionTrend = this.buildMoMTrend(txCountCurrent, txCountPrevious, 'transactions');
    this.categoryTrend = this.buildMoMTrend(categoryCurrent, categoryPrevious, 'category updates');
    this.alertsTrend = this.buildMoMTrend(alertsCurrent, alertsPrevious, 'alerts');
  }

  private buildMoMTrend(current: number, previous: number, label: string): KpiTrend {
    if (current === previous) {
      return {
        direction: 'steady',
        description: 'No change this month'
      };
    }

    if (previous <= 0) {
      return {
        direction: current > 0 ? 'up' : 'steady',
        description: current > 0 ? `Up from 0 last month (${label})` : 'No change this month'
      };
    }

    const delta = current - previous;
    const percent = Math.round((Math.abs(delta) / previous) * 100);
    return {
      direction: delta > 0 ? 'up' : 'down',
      description: `${delta > 0 ? 'Up' : 'Down'} ${percent}% this month`
    };
  }

  private isInRange(dateInput: string, start: Date, endExclusive: Date): boolean {
    const parsed = new Date(dateInput);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    return parsed >= start && parsed < endExclusive;
  }

  private applyLiveChartData(stockReportRows: StockReportRecord[], transactions: TransactionRecord[]): void {
    const lowStockRows = stockReportRows
      .filter(row => Number(row.reorder_level) > 0)
      .map(row => {
        const current = Number(row.current_stock) || 0;
        const minimum = Number(row.reorder_level) || 0;
        const ratio = minimum > 0 ? current / minimum : 1;
        const status: RestockRow['status'] = ratio < 0.7 ? 'critical' : ratio < 1 ? 'warning' : 'healthy';
        return {
          item: row.item_description,
          currentStock: current,
          minimumThreshold: minimum,
          status,
          gap: minimum - current
        };
      })
      .filter(row => row.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 6)
      .map(({ item, currentStock, minimumThreshold, status }) => ({ item, currentStock, minimumThreshold, status }));

    this.restockRows = lowStockRows;

    this.restockBarData = {
      labels: lowStockRows.map(row => row.item),
      datasets: [
        {
          label: 'Current stock',
          data: lowStockRows.map(row => row.currentStock),
          borderRadius: 6,
          backgroundColor: lowStockRows.map(row => this.getRestockColor(row.status))
        },
        {
          label: 'Minimum threshold',
          data: lowStockRows.map(row => row.minimumThreshold),
          borderRadius: 6,
          backgroundColor: '#94a3b8'
        }
      ]
    };

    const categoryTotals = new Map<string, number>();
    stockReportRows.forEach(row => {
      const key = row.category_name || 'Uncategorized';
      const current = Number(row.current_stock) || 0;
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + current);
    });

    const sortedCategories = Array.from(categoryTotals.entries())
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const categoryPalette = ['#0891b2', '#16a34a', '#f59e0b', '#4f46e5', '#f97316', '#14b8a6'];
    this.categoryDonutData = {
      labels: sortedCategories.map(([name]) => name),
      datasets: [
        {
          data: sortedCategories.map(([, total]) => total),
          backgroundColor: sortedCategories.map((_, index) => categoryPalette[index % categoryPalette.length]),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6
        }
      ]
    };

    const { labels, itemsIn, itemsOut } = this.build30DayMovementSeries(transactions);
    this.stockMovementData = {
      labels,
      datasets: [
        {
          label: 'Items in',
          data: itemsIn,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.16)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        },
        {
          label: 'Items out',
          data: itemsOut,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.11)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        }
      ]
    };
  }

  private build30DayMovementSeries(transactions: TransactionRecord[]): {
    labels: string[];
    itemsIn: number[];
    itemsOut: number[];
  } {
    const labels: string[] = [];
    const keys: string[] = [];
    const itemsInByDay = new Map<string, number>();
    const itemsOutByDay = new Map<string, number>();
    const today = new Date();

    for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - dayOffset);
      const key = date.toISOString().split('T')[0];
      keys.push(key);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      itemsInByDay.set(key, 0);
      itemsOutByDay.set(key, 0);
    }

    transactions.forEach(txn => {
      const txnDate = new Date(txn.transaction_date);
      if (Number.isNaN(txnDate.getTime())) {
        return;
      }

      const key = txnDate.toISOString().split('T')[0];
      const quantity = Number(txn.quantity) || 0;

      if (!itemsInByDay.has(key) && !itemsOutByDay.has(key)) {
        return;
      }

      if (txn.transaction_type === 'IN') {
        itemsInByDay.set(key, (itemsInByDay.get(key) || 0) + quantity);
      } else if (txn.transaction_type === 'OUT') {
        itemsOutByDay.set(key, (itemsOutByDay.get(key) || 0) + quantity);
      }
    });

    return {
      labels,
      itemsIn: keys.map(key => itemsInByDay.get(key) || 0),
      itemsOut: keys.map(key => itemsOutByDay.get(key) || 0)
    };
  }
}
