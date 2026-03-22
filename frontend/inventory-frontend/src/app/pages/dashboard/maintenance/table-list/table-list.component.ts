import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef, DoCheck } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaintenanceService } from '../../../../services/maintenance.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { TopbarActionService } from '../../../../services/topbar-action.service';
import { 
  getFriendlyTableName as getTableName,
  getFriendlyColumnName as getColName,
  getTableDescription as getTableDesc
} from '../table-config';
import { PaginationComponent } from '../../../../components/pagination/pagination.component';

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './table-list.component.html',
  styleUrls: ['./table-list.component.scss']
})
export class TableListComponent implements OnInit, OnDestroy, DoCheck {
  @Input() parent: any;
  selectedTable: string | null = null;
  schema: { columns: string[]; primary_key: string | string[]; soft_deletes: boolean; relations?: Record<string, { ref_table: string; ref_key: string; label_column: string }>; lookups?: Record<string, Record<string | number, string>>; column_details?: Record<string, { nullable: boolean; type: string }> } | null = null;
  pkKey: string | null = null;
  pkKeys: string[] = []; // For composite primary keys
  rows: any[] = [];
  showDeleted = false;
  loading = false;
  
  // Pagination
  currentPage = 1;
  perPage = 15;
  total = 0;
  totalPages = 0;
  
  // Column visibility
  visibleColumns: Set<string> = new Set();
  columnSelectorOpen = false;
  
  // Search
  searchQuery = '';
  private searchTimeout: any;

  // View filters
  transactionTab: 'all' | 'in' | 'out' | 'adjustment' | 'transfer' = 'all';
  itemCategoryFilter = 'all';
  itemStatusFilter = 'all';
  transactionDateFrom = '';
  transactionDateTo = '';

  // Context + feedback
  actionSuccess = '';
  actionError = '';
  selectedItemContext: { id: string; name: string } | null = null;
  expirySummary = { critical: 0, warning: 0, caution: 0 };
  private selectedTableSnapshot: string | null = null;
  private readonly itemStateKey = 'maintenance_items_state';
  currentRole: 'super_admin' | 'inventory_manager' | null = null;

  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService,
    private topbarAction: TopbarActionService
  ) {}

  ngOnInit(): void {
    this.selectedTable = this.parent.selectedTable;
    this.selectedTableSnapshot = this.selectedTable;
    this.currentRole = this.authService.getCurrentUser()?.role ?? null;

    this.route.queryParams.subscribe(params => {
      this.applyRouteContext(params);
      if (this.selectedTable === 'inventory_batches') {
        this.fetchRows();
      }
    });

    if (this.selectedTable) {
      this.loadSchema();
      this.fetchRows();
    }

    this.topbarAction.setPrintHandler(() => window.print());
  }

  ngOnDestroy(): void {
    this.topbarAction.setPrintHandler(null);
  }

  ngDoCheck(): void {
    const latest = this.parent?.selectedTable ?? null;
    if (latest !== this.selectedTableSnapshot) {
      this.selectedTable = latest;
      this.selectedTableSnapshot = latest;
      this.resetTableState();
      this.loadSchema();
      this.fetchRows();
    }
  }

  loadSchema(): void {
    if (!this.selectedTable) return;
    this.api.getSchema(this.selectedTable).subscribe({
      next: (s) => {
        this.schema = s;
        // Handle both single and composite primary keys
        if (typeof s.primary_key === 'string') {
          this.pkKey = s.primary_key;
          this.pkKeys = [s.primary_key];
        } else if (Array.isArray(s.primary_key)) {
          this.pkKey = null;
          this.pkKeys = s.primary_key;
        }
        // Initialize all columns as visible
        this.visibleColumns = new Set(s.columns);
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading schema:', err)
    });
  }

  fetchRows(): void {
    if (!this.selectedTable) return;
    this.loading = true;
    this.cdr.markForCheck();

    const perPage = this.isBatchTable() && this.selectedItemContext ? 300 : this.perPage;

    this.api.listRows(this.selectedTable, {
      showDeleted: this.showDeleted, 
      page: this.currentPage, 
      perPage,
      search: this.searchQuery || undefined
    }).subscribe({
      next: (response: any) => {
        const rowData = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.data?.data)
            ? response.data.data
            : [];

        const pageValue = Number(response?.page ?? response?.current_page ?? this.currentPage ?? 1);
        const perPageValue = Number(response?.perPage ?? response?.per_page ?? this.perPage ?? 15);
        const totalValue = Number(response?.total ?? rowData.length);
        const totalPagesValue = Number(
          response?.last_page
            ?? (perPageValue > 0 ? Math.ceil(totalValue / perPageValue) : 1)
        );

        this.rows = rowData;
        this.currentPage = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
        this.perPage = Number.isFinite(perPageValue) && perPageValue > 0 ? perPageValue : 15;
        this.total = Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : rowData.length;
        this.totalPages = Number.isFinite(totalPagesValue) && totalPagesValue > 0 ? totalPagesValue : 1;
        if (this.isExpiryAlertsTable()) {
          this.computeExpirySummary();
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading rows:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  deleteRow(row: any): void {
    if (!this.selectedTable) return;
    // Check if we have a valid primary key
    if (!this.pkKey && this.pkKeys.length === 0) {
      alert('Cannot delete: No primary key defined for this table');
      return;
    }
    
    const tableName = this.getFriendlyTableName();
    const confirmMessage = `Are you sure you want to delete this ${tableName} record?\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
      // For composite keys, use the first key value
      const id = this.pkKey ? row[this.pkKey] : row[this.pkKeys[0]];
      this.api.deleteRow(this.selectedTable, id).subscribe({
        next: () => {
          this.fetchRows();
        },
        error: (err) => {
          console.error('Error deleting row:', err);
          alert('Error deleting record: ' + (err.error?.message || err.error?.error || 'Unknown error'));
        }
      });
    }
  }

  restoreRow(row: any): void {
    if (!this.selectedTable) return;
    // Check if we have a valid primary key
    if (!this.pkKey && this.pkKeys.length === 0) {
      alert('Cannot restore: No primary key defined for this table');
      return;
    }
    
    // For composite keys, use the first key value
    const id = this.pkKey ? row[this.pkKey] : row[this.pkKeys[0]];
    this.api.restoreRow(this.selectedTable, id).subscribe({
      next: () => this.fetchRows(),
      error: (err) => {
        console.error('Error restoring row:', err);
        alert('Error restoring record: ' + (err.error?.message || err.error?.error || 'Unknown error'));
      }
    });
  }

  canDelete(): boolean {
    return this.pkKey !== null || this.pkKeys.length > 0;
  }

  goBack(): void {
    if (this.isBatchTable() && this.selectedItemContext) {
      const saved = this.readItemsState();
      this.router.navigate(['/dashboard/maintenance/items'], {
        queryParams: {
          q: saved.searchQuery || '',
          category: saved.itemCategoryFilter || 'all',
          status: saved.itemStatusFilter || 'all',
          page: saved.currentPage || 1
        }
      });
      return;
    }

    this.parent.goToHome();
  }

  goToForm(row: any | null): void {
    this.parent.goToForm(row);
  }

  formatCell(column: string, row: any): any {
    if (!this.schema) return row[column];
    const value = row[column];

    if (value === null || value === undefined || value === '') {
      return '—';
    }
    
    // Handle boolean fields - display as Yes/No
    if (this.isBooleanField(column)) {
      if (value === 1 || value === true || value === '1') return 'Yes';
      if (value === 0 || value === false || value === '0') return 'No';
      return '—';
    }
    
    const lookups = this.schema.lookups || {};
    const map = lookups[column];
    if (map) {
      const key = row[column];
      if (key !== undefined && key !== null && map[key] !== undefined) {
        return map[key];
      }
    }
    return value;
  }

  isTransactionTable(): boolean {
    return this.selectedTable === 'inventory_transactions';
  }

  isItemsTable(): boolean {
    return this.selectedTable === 'items';
  }

  isBatchTable(): boolean {
    return this.selectedTable === 'inventory_batches';
  }

  isExpiryAlertsTable(): boolean {
    return this.selectedTable === 'expiry_alerts';
  }

  /** Sidebar + top bar navigation; no Back on inventory / expiry maintenance tables. */
  showTableBackButton(): boolean {
    if (!this.selectedTable) {
      return false;
    }
    const noBack = new Set([
      'expiry_alerts',
      'items',
      'inventory_batches',
      'inventory_transactions',
      'inventory_snapshots'
    ]);
    return !noBack.has(this.selectedTable);
  }

  isUsersTable(): boolean {
    return this.selectedTable === 'users';
  }

  setTransactionTab(tab: 'all' | 'in' | 'out' | 'adjustment' | 'transfer'): void {
    this.transactionTab = tab;
    this.syncTransactionQueryParams();
  }

  onItemFilterChange(): void {
    this.currentPage = 1;
    this.saveItemsState();
  }

  setTransactionDateRange(): void {
    this.currentPage = 1;
    this.syncTransactionQueryParams();
  }

  getDisplayedRows(): any[] {
    let list = [...this.rows];

    if (this.isBatchTable() && this.selectedItemContext) {
      list = list.filter(row => String(row['item_id'] ?? '') === this.selectedItemContext?.id);
    }

    if (this.isTransactionTable() && this.transactionTab !== 'all') {
      list = list.filter(row => {
        const type = String(row['transaction_type'] || '').toLowerCase();
        return type === this.transactionTab;
      });
    }

    if (this.isTransactionTable() && (this.transactionDateFrom || this.transactionDateTo)) {
      const fromDate = this.transactionDateFrom ? new Date(this.transactionDateFrom) : null;
      const toDate = this.transactionDateTo ? new Date(this.transactionDateTo) : null;

      list = list.filter(row => {
        const rawDate = row['transaction_date'] || row['created_at'];
        if (!rawDate) {
          return false;
        }
        const rowDate = new Date(rawDate);
        if (Number.isNaN(rowDate.getTime())) {
          return false;
        }
        if (fromDate && rowDate < fromDate) {
          return false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (rowDate > end) {
            return false;
          }
        }
        return true;
      });
    }

    if (this.isItemsTable()) {
      if (this.itemCategoryFilter !== 'all') {
        list = list.filter(row => String(row['category_id'] ?? '') === this.itemCategoryFilter);
      }

      if (this.itemStatusFilter !== 'all') {
        list = list.filter(row => {
          const active = row['is_active'] === 1 || row['is_active'] === true || row['is_active'] === '1';
          return this.itemStatusFilter === 'active' ? active : !active;
        });
      }

      this.saveItemsState();
    }

    if (this.isExpiryAlertsTable()) {
      list = list.sort((a, b) => this.getUrgencyRank(a) - this.getUrgencyRank(b));
    }

    return list;
  }

  viewBatches(row: any): void {
    if (!row) {
      return;
    }
    this.saveItemsState();
    const itemId = String(row['item_id'] ?? '');
    const itemName = String(row['item_description'] || row['item_code'] || row['item_name'] || itemId);
    this.router.navigate(['/dashboard/maintenance/inventory_batches'], {
      queryParams: {
        itemId,
        itemName,
        from: 'items'
      }
    });
  }

  recordTransactionFromBatch(row: any): void {
    const itemId = String(row['item_id'] ?? '');
    const batchId = String(row['batch_id'] ?? '');
    this.router.navigate(['/dashboard/maintenance/inventory_transactions'], {
      queryParams: {
        itemId,
        batchId,
        from: 'batches'
      }
    });
  }

  quarantineBatch(row: any): void {
    if (!this.isBatchTable()) {
      return;
    }
    const id = this.getRowPrimaryId(row);
    if (id === null) {
      this.showError('Unable to quarantine this batch. Missing identifier.');
      return;
    }
    this.api.updateRow('inventory_batches', id, { status: 'quarantined' }).subscribe({
      next: () => {
        this.showSuccess('Batch moved to quarantine.');
        this.fetchRows();
      },
      error: (err) => {
        this.showError(err?.error?.message || 'Failed to quarantine batch.');
      }
    });
  }

  acknowledgeAlert(row: any): void {
    this.updateAlertLifecycle(row, 'Acknowledged');
  }

  resolveAlert(row: any): void {
    this.updateAlertLifecycle(row, 'Resolved');
  }

  toggleUserStatus(row: any, activate: boolean): void {
    if (!this.isUsersTable() || this.currentRole !== 'super_admin') {
      return;
    }

    const id = this.getRowPrimaryId(row);
    if (id === null) {
      this.showError('Unable to update user status. Missing identifier.');
      return;
    }

    this.api.updateRow('users', id, { is_active: activate ? 1 : 0 }).subscribe({
      next: () => {
        this.showSuccess(activate ? 'User reactivated successfully.' : 'User deactivated successfully.');
        this.fetchRows();
      },
      error: (err) => {
        this.showError(err?.error?.message || 'Failed to update user status.');
      }
    });
  }

  canAcknowledge(row: any): boolean {
    if (!this.canAcknowledgeResolve()) {
      return false;
    }
    const status = String(row['status'] || '').toLowerCase();
    return status === '' || status === 'pending';
  }

  canResolve(row: any): boolean {
    if (!this.canAcknowledgeResolve()) {
      return false;
    }
    const status = String(row['status'] || '').toLowerCase();
    return status === 'acknowledged';
  }

  canCreate(): boolean {
    if (!this.currentRole) return false;
    if (this.currentRole === 'super_admin') return true;

    const managerAllowedTables = ['items', 'inventory_batches', 'inventory_transactions', 'expiry_alerts', 'inventory_snapshots'];
    return !!this.selectedTable && managerAllowedTables.includes(this.selectedTable);
  }

  canEditRow(): boolean {
    return this.canCreate();
  }

  canDeleteRow(): boolean {
    return this.currentRole === 'super_admin';
  }

  canExport(): boolean {
    return !!this.currentRole;
  }

  canQuarantine(): boolean {
    return this.currentRole === 'super_admin' || this.currentRole === 'inventory_manager';
  }

  canAcknowledgeResolve(): boolean {
    return this.currentRole === 'super_admin' || this.currentRole === 'inventory_manager';
  }

  getUrgencyLabel(row: any): string {
    const days = Number(row['days_until_expiry'] ?? 9999);
    if (days <= 7) return 'Critical';
    if (days <= 15) return 'Warning';
    return 'Caution';
  }

  exportDisplayedRows(): void {
    if (!this.schema) {
      return;
    }
    const cols = this.getVisibleColumns();
    const header = cols.map(col => this.getFriendlyColumnName(col)).join(',');
    const rows = this.getDisplayedRows().map(row => cols.map(col => this.escapeCsv(String(this.formatCell(col, row)))).join(','));
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.selectedTable || 'records'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getItemCategoryOptions(): Array<{ id: string; name: string }> {
    if (!this.isItemsTable()) {
      return [];
    }

    const fromLookup = this.schema?.lookups?.['category_id'];
    if (fromLookup) {
      return Object.entries(fromLookup)
        .map(([id, name]) => ({ id: String(id), name: String(name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const map = new Map<string, string>();
    this.rows.forEach(row => {
      const id = row['category_id'];
      const name = row['category_name'];
      if (id !== null && id !== undefined && name) {
        map.set(String(id), String(name));
      }
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getTransactionEmptyText(): string {
    switch (this.transactionTab) {
      case 'in':
        return 'IN transactions will appear here';
      case 'out':
        return 'OUT transactions will appear here';
      case 'adjustment':
        return 'Adjustment transactions will appear here';
      case 'transfer':
        return 'Transfer transactions will appear here';
      default:
        return 'No transactions found for the selected filters';
    }
  }

  getTagClass(column: string, value: any): string {
    const normalized = String(value || '').toLowerCase();

    if (column === 'transaction_type') {
      if (normalized === 'in') return 'tag tag-in';
      if (normalized === 'out') return 'tag tag-out';
      if (normalized === 'adjustment') return 'tag tag-adjustment';
      if (normalized === 'transfer') return 'tag tag-transfer';
      return 'tag';
    }

    if (column === 'status') {
      if (normalized.includes('active')) return 'tag tag-active';
      if (normalized.includes('pending')) return 'tag tag-pending';
      if (normalized.includes('acknowledged')) return 'tag tag-ack';
      if (normalized.includes('resolved')) return 'tag tag-active';
      if (normalized.includes('quarantine')) return 'tag tag-critical';
      if (normalized.includes('low')) return 'tag tag-low';
      return 'tag';
    }

    if (column === 'priority') {
      if (normalized.includes('critical')) return 'tag tag-critical';
      if (normalized.includes('warning')) return 'tag tag-warning';
      if (normalized.includes('caution')) return 'tag tag-caution';
      return 'tag';
    }

    return 'tag';
  }

  isBooleanField(column: string): boolean {
    const columnDetails = this.schema?.column_details || {};
    const details = columnDetails[column];
    if (!details) return false;
    const type = details.type?.toLowerCase() || '';
    return type.includes('tinyint') || type.includes('boolean') || 
           column === 'is_active' || column === 'is_primary' ||
           column.startsWith('can_') || column.startsWith('is_');
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.fetchRows();
  }

  toggleColumnVisibility(column: string): void {
    if (this.visibleColumns.has(column)) {
      this.visibleColumns.delete(column);
    } else {
      this.visibleColumns.add(column);
    }
    this.cdr.markForCheck();
  }

  isColumnVisible(column: string): boolean {
    return this.visibleColumns.has(column);
  }

  getVisibleColumns(): string[] {
    if (!this.schema) return [];
    return this.schema.columns.filter(col => this.visibleColumns.has(col));
  }

  toggleColumnSelector(): void {
    this.columnSelectorOpen = !this.columnSelectorOpen;
  }

  // Search methods
  onSearchChange(): void {
    // Debounce search to avoid too many API calls
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1; // Reset to first page on search
      this.fetchRows();
      if (this.isItemsTable()) {
        this.saveItemsState();
      }
    }, 300);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.fetchRows();
  }

  // Friendly name helpers
  getFriendlyTableName(): string {
    return this.selectedTable ? getTableName(this.selectedTable) : '';
  }

  getTableDescription(): string {
    return this.selectedTable ? getTableDesc(this.selectedTable) : '';
  }

  getFriendlyColumnName(column: string): string {
    return this.selectedTable ? getColName(this.selectedTable, column) : column;
  }

  private applyRouteContext(params: Record<string, string>): void {
    if (this.isBatchTable()) {
      const itemId = String(params['itemId'] || '');
      const itemName = String(params['itemName'] || '');
      this.selectedItemContext = itemId ? { id: itemId, name: itemName || `Item #${itemId}` } : null;
    }

    if (this.isItemsTable()) {
      const saved = this.readItemsState();
      this.searchQuery = params['q'] ?? saved.searchQuery ?? this.searchQuery;
      this.itemCategoryFilter = params['category'] ?? saved.itemCategoryFilter ?? this.itemCategoryFilter;
      this.itemStatusFilter = params['status'] ?? saved.itemStatusFilter ?? this.itemStatusFilter;
      this.currentPage = Number(params['page'] ?? saved.currentPage ?? this.currentPage);
    }

    if (this.isTransactionTable()) {
      const allowedTabs = new Set(['all', 'in', 'out', 'adjustment', 'transfer']);
      const tab = String(params['txTab'] || '').toLowerCase();
      if (allowedTabs.has(tab)) {
        this.transactionTab = tab as 'all' | 'in' | 'out' | 'adjustment' | 'transfer';
      }
      this.transactionDateFrom = params['from'] ?? this.transactionDateFrom;
      this.transactionDateTo = params['to'] ?? this.transactionDateTo;
    }
  }

  private saveItemsState(): void {
    if (!this.isItemsTable()) {
      return;
    }
    const payload = {
      searchQuery: this.searchQuery,
      itemCategoryFilter: this.itemCategoryFilter,
      itemStatusFilter: this.itemStatusFilter,
      currentPage: this.currentPage
    };
    sessionStorage.setItem(this.itemStateKey, JSON.stringify(payload));
  }

  private readItemsState(): any {
    try {
      const raw = sessionStorage.getItem(this.itemStateKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private getRowPrimaryId(row: any): string | number | null {
    if (this.pkKey) {
      return row[this.pkKey];
    }
    if (this.pkKeys.length > 0) {
      return row[this.pkKeys[0]];
    }
    return null;
  }

  private updateAlertLifecycle(row: any, nextStatus: 'Acknowledged' | 'Resolved'): void {
    if (!this.isExpiryAlertsTable()) {
      return;
    }

    const id = this.getRowPrimaryId(row);
    if (id === null) {
      this.showError('Unable to update alert status. Missing identifier.');
      return;
    }

    const user = this.authService.getCurrentUser();
    const now = new Date().toISOString();
    const payload: any = {
      status: nextStatus
    };

    if (nextStatus === 'Acknowledged') {
      payload.acknowledged_by = user?.user_id ?? row['acknowledged_by'] ?? null;
      payload.acknowledged_at = now;
    }

    if (nextStatus === 'Resolved') {
      payload.resolved_by = user?.user_id ?? row['resolved_by'] ?? null;
      payload.resolved_at = now;
      if (!row['acknowledged_at']) {
        payload.acknowledged_by = user?.user_id ?? row['acknowledged_by'] ?? null;
        payload.acknowledged_at = now;
      }
    }

    this.api.updateRow('expiry_alerts', id, payload).subscribe({
      next: () => {
        this.showSuccess(`Alert marked as ${nextStatus}.`);
        this.fetchRows();
      },
      error: (err) => {
        this.showError(err?.error?.message || 'Unable to update alert status.');
      }
    });
  }

  private computeExpirySummary(): void {
    const summary = { critical: 0, warning: 0, caution: 0 };
    this.rows.forEach(row => {
      const label = this.getUrgencyLabel(row).toLowerCase();
      if (label === 'critical') summary.critical += 1;
      if (label === 'warning') summary.warning += 1;
      if (label === 'caution') summary.caution += 1;
    });
    this.expirySummary = summary;
  }

  private getUrgencyRank(row: any): number {
    const label = this.getUrgencyLabel(row);
    if (label === 'Critical') return 1;
    if (label === 'Warning') return 2;
    return 3;
  }

  private showSuccess(message: string): void {
    this.actionSuccess = message;
    this.actionError = '';
    this.toastService.success(message);
    this.cdr.markForCheck();
  }

  private showError(message: string): void {
    this.actionError = message;
    this.actionSuccess = '';
    this.toastService.error(message);
    this.cdr.markForCheck();
  }

  private resetTableState(): void {
    this.transactionTab = 'all';
    this.transactionDateFrom = '';
    this.transactionDateTo = '';
    this.itemCategoryFilter = 'all';
    this.itemStatusFilter = 'all';
    this.selectedItemContext = null;
    this.actionSuccess = '';
    this.actionError = '';
  }

  private escapeCsv(value: string): string {
    const normalized = value ?? '';
    if (normalized.includes(',') || normalized.includes('"') || normalized.includes('\n')) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  }

  private syncTransactionQueryParams(): void {
    if (!this.isTransactionTable()) {
      return;
    }

    const queryParams: Record<string, string | null> = {
      txTab: this.transactionTab,
      from: this.transactionDateFrom || null,
      to: this.transactionDateTo || null
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}
