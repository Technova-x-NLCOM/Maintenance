import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { MaintenanceService } from '../../../services/maintenance.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TopbarActionService } from '../../../services/topbar-action.service';
import { PaginationComponent } from '../../../components/pagination/pagination.component';

type ReportTab = 'current' | 'near-expiry' | 'snapshots';

interface CurrentInventoryRow {
  itemCode: string;
  description: string;
  type: string;
  totalQty: number;
  unitValue: number;
  totalValue: number;
  nearestExpiry: string;
  stockHealthPct: number;
  stockHealthClass: 'healthy' | 'warning' | 'critical';
}

interface NearExpiryRow {
  daysLeft: number;
  item: string;
  batchNumber: string;
  qty: string;
  expiryDate: string;
  valueAtRisk: number;
}

interface SnapshotRow {
  snapshotDate: string;
  item: string;
  type: string;
  qtyOnDate: string;
  createdBy: string;
  notes: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
  activeTab: ReportTab = 'current';
  /** First wave: items + batches (Current Inventory). */
  loading = false;
  /** Second wave: expiry_alerts + inventory_snapshots (other tabs). */
  detailLoading = false;

  currentInventoryRows: CurrentInventoryRow[] = [];
  nearExpiryRows: NearExpiryRow[] = [];
  snapshotRows: SnapshotRow[] = [];

  totalItemTypes = 0;
  totalInventoryValue = 0;
  itemsBelowReorder = 0;

  reportsPerPage = 10;
  pageCurrent = 1;
  pageNear = 1;
  pageSnap = 1;

  constructor(
    private maintenanceService: MaintenanceService,
    private router: Router,
    private route: ActivatedRoute,
    private topbarAction: TopbarActionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const tab = String(params['tab'] || '').toLowerCase();
      if (tab === 'current' || tab === 'near-expiry' || tab === 'snapshots') {
        this.activeTab = tab;
      }
    });

    this.loadReportData();
    this.topbarAction.setPrintHandler(() => this.printCurrentView());
  }

  ngOnDestroy(): void {
    this.topbarAction.setPrintHandler(null);
  }

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
    if (tab === 'current') {
      this.pageCurrent = 1;
    }
    if (tab === 'near-expiry') {
      this.pageNear = 1;
    }
    if (tab === 'snapshots') {
      this.pageSnap = 1;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  get totalPagesCurrent(): number {
    return Math.max(1, Math.ceil(this.currentInventoryRows.length / this.reportsPerPage));
  }

  get pagedCurrentRows(): CurrentInventoryRow[] {
    const start = (this.pageCurrent - 1) * this.reportsPerPage;
    return this.currentInventoryRows.slice(start, start + this.reportsPerPage);
  }

  get totalPagesNear(): number {
    return Math.max(1, Math.ceil(this.nearExpiryRows.length / this.reportsPerPage));
  }

  get pagedNearExpiryRows(): NearExpiryRow[] {
    const start = (this.pageNear - 1) * this.reportsPerPage;
    return this.nearExpiryRows.slice(start, start + this.reportsPerPage);
  }

  get totalPagesSnap(): number {
    return Math.max(1, Math.ceil(this.snapshotRows.length / this.reportsPerPage));
  }

  get pagedSnapshotRows(): SnapshotRow[] {
    const start = (this.pageSnap - 1) * this.reportsPerPage;
    return this.snapshotRows.slice(start, start + this.reportsPerPage);
  }

  onPageCurrentChange(page: number): void {
    this.pageCurrent = page;
  }

  onPageNearChange(page: number): void {
    this.pageNear = page;
  }

  onPageSnapChange(page: number): void {
    this.pageSnap = page;
  }

  printCurrentView(): void {
    window.print();
  }

  exportCurrentView(): void {
    const csv = this.activeTab === 'current'
      ? this.toCsv(
          ['ITEM CODE', 'DESCRIPTION', 'TYPE', 'TOTAL QTY', 'UNIT VALUE', 'TOTAL VALUE', 'NEAREST EXPIRY'],
          this.currentInventoryRows.map(row => [
            row.itemCode,
            row.description,
            row.type,
            row.totalQty,
            this.formatCurrency(row.unitValue),
            this.formatCurrency(row.totalValue),
            row.nearestExpiry
          ])
        )
      : this.activeTab === 'near-expiry'
      ? this.toCsv(
          ['DAYS LEFT', 'ITEM', 'BATCH #', 'QTY', 'EXPIRY DATE', 'VALUE AT RISK'],
          this.nearExpiryRows.map(row => [
            row.daysLeft,
            row.item,
            row.batchNumber,
            row.qty,
            row.expiryDate,
            this.formatCurrency(row.valueAtRisk)
          ])
        )
      : this.toCsv(
          ['SNAPSHOT DATE', 'ITEM', 'TYPE', 'QTY ON DATE', 'CREATED BY', 'NOTES'],
          this.snapshotRows.map(row => [
            row.snapshotDate,
            row.item,
            row.type,
            row.qtyOnDate,
            row.createdBy,
            row.notes
          ])
        );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reports-${this.activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  openSnapshotTable(): void {
    this.router.navigate(['/dashboard/maintenance/inventory_snapshots']);
  }

  formatCurrency(value: number): string {
    return `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'N/A';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private loadReportData(): void {
    this.loading = true;
    this.detailLoading = true;
    this.cdr.markForCheck();

    forkJoin({
      items: this.maintenanceService.listRows('items', { page: 1, perPage: 1000 }).pipe(catchError(() => of({ data: [] }))),
      batches: this.maintenanceService.listRows('inventory_batches', { page: 1, perPage: 2000 }).pipe(catchError(() => of({ data: [] })))
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: ({ items, batches }) => {
          const itemRows = Array.isArray(items?.data) ? items.data : [];
          const batchRows = Array.isArray(batches?.data) ? batches.data : [];

          const itemsById = new Map<string, any>();
          itemRows.forEach((item: any) => {
            itemsById.set(String(item.item_id), item);
          });

          try {
            this.buildCurrentInventoryRows(itemRows, batchRows);
          } catch (e) {
            console.error('Reports: buildCurrentInventoryRows failed', e);
          }

          forkJoin({
            alerts: this.maintenanceService.listRows('expiry_alerts', { page: 1, perPage: 1000 }).pipe(catchError(() => of({ data: [] }))),
            snapshots: this.maintenanceService.listRows('inventory_snapshots', { page: 1, perPage: 1000 }).pipe(catchError(() => of({ data: [] })))
          })
            .pipe(
              finalize(() => {
                this.detailLoading = false;
                this.cdr.markForCheck();
              })
            )
            .subscribe({
              next: ({ alerts, snapshots }) => {
                const alertRows = Array.isArray(alerts?.data) ? alerts.data : [];
                const snapshotRows = Array.isArray(snapshots?.data) ? snapshots.data : [];

                try {
                  this.buildNearExpiryRows(alertRows, batchRows, itemsById);
                  this.buildSnapshotRows(snapshotRows, itemsById);
                } catch (e) {
                  console.error('Reports: build near-expiry / snapshots failed', e);
                }
              },
              error: (err) => {
                console.error('Reports: secondary load failed', err);
              }
            });
        },
        error: (err) => {
          console.error('Reports: primary load failed', err);
          this.detailLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private buildCurrentInventoryRows(itemRows: any[], batchRows: any[]): void {
    const batchByItem = new Map<string, any[]>();
    batchRows.forEach((batch: any) => {
      const itemId = String(batch.item_id ?? '');
      if (!itemId) {
        return;
      }
      const list = batchByItem.get(itemId) || [];
      list.push(batch);
      batchByItem.set(itemId, list);
    });

    this.currentInventoryRows = itemRows.map((item: any) => {
      const relatedBatches = batchByItem.get(String(item.item_id)) || [];

      const totalQty = relatedBatches.reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
      const unitValue = Number(item.unit_value || 0);
      const totalValue = totalQty * unitValue;
      const nearestExpiry = this.getNearestExpiry(relatedBatches);
      const reorderLevel = Number(item.reorder_level || 0);

      const health = this.getStockHealth(totalQty, reorderLevel);

      return {
        itemCode: String(item.item_code || item.item_id || '-'),
        description: String(item.item_description || item.name || '-'),
        type: String(item.item_type_name || item.type_name || item.item_type_id || '-'),
        totalQty,
        unitValue,
        totalValue,
        nearestExpiry,
        stockHealthPct: health.pct,
        stockHealthClass: health.level
      };
    }).sort((a, b) => b.totalValue - a.totalValue);

    this.totalInventoryValue = this.currentInventoryRows.reduce((sum, row) => sum + row.totalValue, 0);
    this.totalItemTypes = new Set(this.currentInventoryRows.map(row => row.type)).size;
    this.itemsBelowReorder = itemRows.filter((item: any) => {
      const reorder = Number(item.reorder_level || 0);
      if (reorder <= 0) {
        return false;
      }
      const qty = (batchByItem.get(String(item.item_id)) || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
      return qty <= reorder;
    }).length;

    this.pageCurrent = 1;
  }

  private buildNearExpiryRows(alertRows: any[], batchRows: any[], itemsById: Map<string, any>): void {
    const batchesById = new Map<string, any>();
    batchRows.forEach((batch: any) => {
      batchesById.set(String(batch.batch_id), batch);
    });

    this.nearExpiryRows = alertRows.map((alert: any) => {
      const batch = batchesById.get(String(alert.batch_id || ''));
      const item = batch ? itemsById.get(String(batch.item_id || '')) : null;
      const unitValue = Number(item?.unit_value || 0);
      const quantity = Number(batch?.quantity || 0);

      return {
        daysLeft: Number(alert.days_until_expiry || this.computeDaysLeft(batch?.expiry_date)),
        item: String(item?.item_description || item?.name || item?.item_code || 'Unknown Item'),
        batchNumber: String(batch?.batch_number || alert.batch_id || '-'),
        qty: `${quantity} ${item?.measurement_unit || 'units'}`,
        expiryDate: this.formatDate(batch?.expiry_date || alert.expiry_date),
        valueAtRisk: Number(alert.value_at_risk || quantity * unitValue)
      };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    this.pageNear = 1;
  }

  private buildSnapshotRows(snapshotRows: any[], itemsById: Map<string, any>): void {
    this.snapshotRows = [...snapshotRows].sort((a, b) => {
      const aTime = this.toTimestamp(a.snapshot_date);
      const bTime = this.toTimestamp(b.snapshot_date);
      return bTime - aTime;
    }).map((snapshot: any) => {
      const item = itemsById.get(String(snapshot.item_id || ''));
      return {
        snapshotDate: this.formatDate(snapshot.snapshot_date),
        item: String(item?.item_description || item?.item_code || snapshot.item_id || '-'),
        type: String(item?.item_type_name || item?.type_name || item?.item_type_id || '-'),
        qtyOnDate: `${Number(snapshot.quantity || 0)} ${item?.measurement_unit || 'units'}`,
        createdBy: String(snapshot.created_by_name || snapshot.created_by || '-'),
        notes: String(snapshot.notes || '-')
      };
    });

    this.pageSnap = 1;
  }

  private getNearestExpiry(batches: any[]): string {
    const validDates = batches
      .map(batch => batch.expiry_date)
      .filter((value: any) => !!value)
      .map((value: string) => new Date(value))
      .filter((date: Date) => !Number.isNaN(date.getTime()))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());

    if (!validDates.length) {
      return 'N/A';
    }

    return validDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private getStockHealth(totalQty: number, reorderLevel: number): { pct: number; level: 'healthy' | 'warning' | 'critical' } {
    if (reorderLevel <= 0) {
      return { pct: 100, level: 'healthy' };
    }

    if (totalQty <= reorderLevel) {
      return { pct: 25, level: 'critical' };
    }

    if (totalQty <= reorderLevel * 1.5) {
      return { pct: 45, level: 'warning' };
    }

    const normalized = Math.min(100, Math.round((totalQty / (reorderLevel * 3)) * 100));
    return { pct: Math.max(normalized, 55), level: 'healthy' };
  }

  private computeDaysLeft(expiryDate: string | null | undefined): number {
    if (!expiryDate) {
      return 9999;
    }
    const expiry = new Date(expiryDate);
    if (Number.isNaN(expiry.getTime())) {
      return 9999;
    }
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  private toTimestamp(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private toCsv(headers: string[], rows: Array<Array<string | number>>): string {
    const escapeValue = (value: string | number): string => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvRows = [headers.join(',')];
    rows.forEach(row => {
      csvRows.push(row.map(escapeValue).join(','));
    });

    return csvRows.join('\n');
  }
}
