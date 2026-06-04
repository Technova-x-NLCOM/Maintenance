import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
  NgZone,
  ElementRef,
  ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';
import { Subscription, filter, forkJoin, catchError, of, switchMap, map } from 'rxjs';
import { getApiBaseUrl } from '../../services/api-base';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartOptions,
  TooltipItem,
  registerables
} from 'chart.js';

Chart.register(...registerables);

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MonthTrendCount {
  current: number;
  previous: number;
}

export interface DashboardTrends {
  items: MonthTrendCount;
  transactions: MonthTrendCount;
  categories: MonthTrendCount;
  batches: MonthTrendCount;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalItems: number;
  lowStockItems: number;
  totalTransactions: number;
  pendingAlerts: number;
  totalCategories: number;
  expiringItems: number;
  schedulesToday?: number;
  overdueSchedules?: number;
  trends?: DashboardTrends;
}

export interface DashboardKpi {
  out_of_stock_items: number;
  below_reorder_items: number;
  expiring_critical: number;
  expiring_warning: number;
  scheduled_today: number;
  shortfall_today: number;
  overdue_schedules: number;
  total_active_stock: number;
  in_this_month: number;
  out_this_month: number;
  auto_allocations_month: number;
  discrepancy_this_month: number;
  shortage_variance_month: number;
  surplus_variance_month: number;
  discrepancy_trend: Array<{ month: string; surplus: number; shortage: number }>;
  upcoming_plans: Array<{
    plan_id: number;
    week_label: string;
    planned_date: string;
    status: string;
    target_unit_count: number;
    auto_allocated: boolean;
    template_name: string;
  }>;
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

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('discrepancyChart') discrepancyChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('movementChart') movementChartRef?: ElementRef<HTMLCanvasElement>;

  user: User | null = null;
  stats: DashboardStats | null = null;
  kpi: DashboardKpi | null = null;
  recentActivity: AuditLogEntry[] = [];
  systemAlerts: SystemAlert[] = [];

  readonly cardPreviewLimit = 5;
  readonly alertsViewAllRoute = '/dashboard/monitoring/stock-report';
  readonly activityViewAllRoute = '/dashboard/monitoring/transaction-history';
  loading = true;
  readonly skeletonCards = Array.from({ length: 4 });

  private routerSubscription: Subscription | null = null;
  private categoryChart: Chart<'bar'> | null = null;
  private movementChart: Chart<'line'> | null = null;

  // MoM trend chips
  stockTrend: KpiTrend     = { direction: 'steady', description: 'No change this month' };
  transactionTrend: KpiTrend = { direction: 'steady', description: 'No change this month' };
  categoryTrend: KpiTrend  = { direction: 'steady', description: 'No change this month' };
  alertsTrend: KpiTrend    = { direction: 'steady', description: 'No change this month' };

  // ── Chart data ───────────────────────────────────────────────────────────────

  discrepancyChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { label: 'Surplus', data: [], backgroundColor: 'rgba(22,163,74,0.75)', borderColor: '#16a34a', borderWidth: 1, borderRadius: 4 },
      { label: 'Shortage', data: [], backgroundColor: 'rgba(220,38,38,0.75)', borderColor: '#dc2626', borderWidth: 1, borderRadius: 4 }
    ]
  };

  readonly discrepancyChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { ticks: { color: '#51627d' }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: '#51627d', precision: 0 }, grid: { color: '#e2e8f0' } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: '#243349', usePointStyle: true, boxWidth: 10 } },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => `${ctx.dataset.label}: ${ctx.raw} units`
        }
      }
    }
  };

  stockMovementData: ChartData<'line'> = {
    labels: [],
    datasets: [
      { label: 'Items in',  data: [], borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.16)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
      { label: 'Items out', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.11)',  fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 }
    ]
  };

  readonly stockMovementOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { ticks: { color: '#51627d', maxTicksLimit: 8 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: '#51627d' }, grid: { color: '#e2e8f0' } }
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: '#243349', usePointStyle: true, boxWidth: 10 } },
      tooltip: {
        backgroundColor: '#0f172a',
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => `${ctx.dataset.label}: ${ctx.raw} items`,
        }
      }
    }
  };

  private readonly API_URL = getApiBaseUrl();

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  // ── Computed getters ──────────────────────────────────────────────────────────

  get topPriorityMessage(): string {
    if (!this.stats && !this.kpi) return 'Loading operational priorities...';
    const outOfStock  = this.kpi?.out_of_stock_items  ?? 0;
    const overdue     = this.kpi?.overdue_schedules   ?? 0;
    const expCritical = this.kpi?.expiring_critical   ?? 0;
    const dueToday    = this.kpi?.scheduled_today     ?? 0;
    const belowReorder = this.kpi?.below_reorder_items ?? 0;
    if (outOfStock  > 0) return `${outOfStock} item(s) are completely out of stock — restock immediately.`;
    if (overdue     > 0) return `${overdue} overdue schedule(s) need to be run or cancelled.`;
    if (expCritical > 0) return `${expCritical} batch(es) expire within 7 days — rotate or write off.`;
    if (dueToday    > 0) return `${dueToday} distribution schedule(s) are due today.`;
    if (belowReorder > 0) return `${belowReorder} item(s) are below reorder level — plan procurement.`;
    return 'All critical signals are stable. Operations look good.';
  }

  getTrendClass(direction: TrendDirection): string { return `trend-${direction}`; }

  get visibleSystemAlerts(): SystemAlert[] { return this.systemAlerts.slice(0, this.cardPreviewLimit); }
  get hiddenSystemAlertsCount(): number { return Math.max(this.systemAlerts.length - this.cardPreviewLimit, 0); }

  // ── Schedule helpers ──────────────────────────────────────────────────────────

  getScheduleRowClass(plan: DashboardKpi['upcoming_plans'][number]): string {
    const today = new Date().toISOString().split('T')[0];
    if (plan.planned_date < today)      return 'row-overdue';
    if (plan.planned_date === today)    return 'row-today';
    if (plan.status === 'ready')        return 'row-ready';
    if (plan.status === 'completed')    return 'row-completed';
    return '';
  }

  formatPlanDay(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit' });
  }

  formatPlanMonth(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
  }

  getPlanStatusLabel(status: string): string {
    const map: Record<string, string> = {
      planned: 'Planned', checked_pre: 'Pre-checked',
      ready: 'Allocated', completed: 'Done', cancelled: 'Cancelled'
    };
    return map[status] ?? status;
  }

  getPlanStatusChip(status: string): string {
    const map: Record<string, string> = {
      planned: 'chip-planned', checked_pre: 'chip-checked',
      ready: 'chip-ready', completed: 'chip-completed', cancelled: 'chip-cancelled'
    };
    return map[status] ?? '';
  }

  // ── Alert helpers ─────────────────────────────────────────────────────────────

  getAlertClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'alert-critical';
      case 'warning':  return 'alert-warning';
      case 'info':     return 'alert-info';
      default:         return '';
    }
  }

  getAlertRoute(alert: SystemAlert): string {
    const lookup = `${alert.type} ${alert.message}`.toLowerCase();
    if (lookup.includes('role') || lookup.includes('permission')) return '/dashboard/roles';
    if (lookup.includes('user') || lookup.includes('account'))    return '/dashboard/system-users';
    if (lookup.includes('stock') || lookup.includes('inventory') || lookup.includes('item') || lookup.includes('expire') || lookup.includes('batch')) return '/dashboard/inventory/items';
    if (lookup.includes('transaction') || lookup.includes('audit')) return '/dashboard/monitoring/transaction-history';
    if (lookup.includes('category')) return '/dashboard/inventory/categories';
    return '/dashboard/settings';
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'INSERT': return 'action-insert';
      case 'UPDATE': return 'action-update';
      case 'DELETE': return 'action-delete';
      default:       return '';
    }
  }

  getRelativeTime(dateString: string): string {
    const eventDate = new Date(dateString);
    if (Number.isNaN(eventDate.getTime())) return this.formatDate(dateString);
    const minutes = Math.floor((Date.now() - eventDate.getTime()) / 60000);
    if (minutes < 1)  return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)   return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)     return `${days} day${days > 1 ? 's' : ''} ago`;
    return this.formatDate(dateString);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  trackByAlert(_: number, alert: SystemAlert): string | number { return alert.alert_id; }
  trackByLog  (_: number, log:   AuditLogEntry): number        { return log.log_id; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => { this.user = user; });
    this.loadDashboardData();
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.route.snapshot.component === DashboardComponent) this.loadDashboardData();
      });
  }

  ngAfterViewInit(): void {
    this.applyResponsiveChartOptions();
    this.ensureChartsRendered();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.destroyCharts();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.applyResponsiveChartOptions();
    this.categoryChart?.resize();
    this.movementChart?.resize();
    this.refreshCharts();
  }

  // ── Data loading ──────────────────────────────────────────────────────────────

  loadDashboardData(): void {
    this.loading = true;

    const headers = this.getAuthHeaders();

    const stats$ = this.http
      .get<DashboardStats>(`${this.API_URL}/super-admin/stats`, { headers })
      .pipe(catchError(() => of({ totalUsers: 0, activeUsers: 0, totalItems: 0, lowStockItems: 0, totalTransactions: 0, pendingAlerts: 0, totalCategories: 0, expiringItems: 0 } as DashboardStats)));

    const alerts$ = this.http
      .get<SystemAlert[]>(`${this.API_URL}/super-admin/alerts`, { headers })
      .pipe(catchError(() => of([] as SystemAlert[])));

    const kpi$ = this.http
      .get<{ success: boolean; data: DashboardKpi }>(`${this.API_URL}/dashboard/kpi`, { headers })
      .pipe(catchError(() => of(null)));

    const transactions$ = this.getRecentTransactions(65).pipe(catchError(() => of([] as TransactionRecord[])));

    forkJoin([stats$, alerts$, kpi$, transactions$]).subscribe({
      next: ([stats, alerts, kpiRes, transactions]) => {
        this.ngZone.run(() => {
          this.stats = stats;
          this.systemAlerts = alerts;
          this.kpi = kpiRes?.data ?? null;
          this.applyTrendsFromStats(stats.trends);
          this.updateAlertTrendIndicators(alerts);
          this.applyLiveChartData([], transactions);
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

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' });
  }

  // ── Trend helpers ─────────────────────────────────────────────────────────────

  private applyTrendsFromStats(trends?: DashboardTrends): void {
    if (!trends) return;
    this.stockTrend       = this.buildMoMTrend(trends.items.current,        trends.items.previous,        'new items');
    this.transactionTrend = this.buildMoMTrend(trends.transactions.current,  trends.transactions.previous,  'transactions');
    this.categoryTrend    = this.buildMoMTrend(trends.categories.current,    trends.categories.previous,    'new categories');
  }

  private updateAlertTrendIndicators(alerts: SystemAlert[]): void {
    const now   = new Date();
    const curStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const cur  = alerts.filter(a => this.isInRange(a.created_at, curStart,  now)).length;
    const prev = alerts.filter(a => this.isInRange(a.created_at, prevStart, curStart)).length;
    this.alertsTrend = this.buildMoMTrend(cur, prev, 'alerts');
  }

  private buildMoMTrend(current: number, previous: number, label: string): KpiTrend {
    if (current === previous) return { direction: 'steady', description: `${current} ${label} this month (same as last month)` };
    if (previous <= 0) return { direction: current > 0 ? 'up' : 'steady', description: current > 0 ? `${current} ${label} this month (none last month)` : `No ${label} this month` };
    const delta = current - previous;
    const pct = Math.round((Math.abs(delta) / previous) * 100);
    return { direction: delta > 0 ? 'up' : 'down', description: `${delta > 0 ? 'Up' : 'Down'} ${pct}% vs last month (${previous} → ${current})` };
  }

  private isInRange(dateInput: string, start: Date, end: Date): boolean {
    const d = new Date(dateInput);
    return !Number.isNaN(d.getTime()) && d >= start && d < end;
  }

  // ── Chart helpers ─────────────────────────────────────────────────────────────

  private getStockReportRows() {
    const params = new HttpParams().set('page', '1').set('per_page', '500');
    return this.http
      .get<PaginatedApiResponse<StockReportRecord>>(`${this.API_URL}/inventory/transactions/stock-report`, { headers: this.getAuthHeaders(), params })
      .pipe(map(r => r.data.data || []));
  }

  private getRecentTransactions(daysBack: number) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);
    const from = dateFrom.toISOString().split('T')[0];
    const p1 = new HttpParams().set('page', '1').set('per_page', '100').set('date_from', from);

    return this.http
      .get<PaginatedApiResponse<TransactionRecord>>(`${this.API_URL}/inventory/transactions`, { headers: this.getAuthHeaders(), params: p1 })
      .pipe(
        switchMap(first => {
          const rows = first.data.data || [];
          const last = first.data.last_page || 1;
          if (last <= 1) return of(rows);
          const rest = Array.from({ length: last - 1 }, (_, i) => {
            const pp = new HttpParams().set('page', String(i + 2)).set('per_page', '100').set('date_from', from);
            return this.http.get<PaginatedApiResponse<TransactionRecord>>(`${this.API_URL}/inventory/transactions`, { headers: this.getAuthHeaders(), params: pp });
          });
          return forkJoin(rest).pipe(map(pages => [...rows, ...pages.flatMap(p => p.data.data || [])]));
        })
      );
  }

  private applyLiveChartData(stockRows: StockReportRecord[], transactions: TransactionRecord[]): void {
    // Discrepancy bar chart — driven by kpi.discrepancy_trend
    if (this.kpi?.discrepancy_trend?.length) {
      this.discrepancyChartData = {
        labels: this.kpi.discrepancy_trend.map(d => d.month),
        datasets: [
          { label: 'Surplus', data: this.kpi.discrepancy_trend.map(d => d.surplus),  backgroundColor: 'rgba(22,163,74,0.75)',  borderColor: '#16a34a', borderWidth: 1, borderRadius: 4 },
          { label: 'Shortage', data: this.kpi.discrepancy_trend.map(d => d.shortage), backgroundColor: 'rgba(220,38,38,0.75)', borderColor: '#dc2626', borderWidth: 1, borderRadius: 4 }
        ]
      };
    }

    // Line chart: 30-day IN vs OUT
    const { labels, itemsIn, itemsOut } = this.build30DayMovementSeries(transactions);
    this.stockMovementData = {
      labels,
      datasets: [
        { label: 'Items in',  data: itemsIn,  borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.16)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Items out', data: itemsOut, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.11)',  fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 }
      ]
    };
  }

  private build30DayMovementSeries(transactions: TransactionRecord[]): { labels: string[]; itemsIn: number[]; itemsOut: number[] } {
    const labels: string[] = [];
    const keys: string[]   = [];
    const inMap  = new Map<string, number>();
    const outMap = new Map<string, number>();
    const today  = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(today.getDate() - i);
      const k = d.toISOString().split('T')[0];
      keys.push(k);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      inMap.set(k, 0);
      outMap.set(k, 0);
    }

    transactions.forEach(t => {
      const d = new Date(t.transaction_date);
      if (Number.isNaN(d.getTime())) return;
      const k = d.toISOString().split('T')[0];
      const q = Number(t.quantity) || 0;
      if (t.transaction_type === 'IN'  && inMap.has(k))  inMap.set(k,  (inMap.get(k)  || 0) + q);
      if (t.transaction_type === 'OUT' && outMap.has(k)) outMap.set(k, (outMap.get(k) || 0) + q);
    });

    return { labels, itemsIn: keys.map(k => inMap.get(k) || 0), itemsOut: keys.map(k => outMap.get(k) || 0) };
  }

  // ── Chart lifecycle ───────────────────────────────────────────────────────────

  private renderCharts(): void {
    this.applyResponsiveChartOptions();
    if (this.discrepancyChartRef?.nativeElement) {
      this.categoryChart = new Chart(this.discrepancyChartRef.nativeElement, { type: 'bar', data: this.discrepancyChartData, options: this.discrepancyChartOptions });
    }
    if (this.movementChartRef?.nativeElement) {
      this.movementChart = new Chart(this.movementChartRef.nativeElement, { type: 'line', data: this.stockMovementData, options: this.stockMovementOptions });
    }
  }

  private refreshCharts(): void {
    if (this.categoryChart) { this.categoryChart.data = this.discrepancyChartData; this.categoryChart.update(); }
    if (this.movementChart) { this.movementChart.data = this.stockMovementData; this.movementChart.update(); }
  }

  private applyResponsiveChartOptions(): void {
    const x = this.stockMovementOptions?.scales?.['x'];
    if (x?.ticks) x.ticks.maxTicksLimit = window.innerWidth <= 768 ? 4 : 8;
  }

  private ensureChartsRendered(): void {
    setTimeout(() => {
      if (!this.categoryChart || !this.movementChart) { this.destroyCharts(); this.renderCharts(); }
      this.refreshCharts();
    }, 0);
  }

  private destroyCharts(): void {
    this.categoryChart?.destroy(); this.movementChart?.destroy();
    this.categoryChart = null; this.movementChart = null;
  }
}
