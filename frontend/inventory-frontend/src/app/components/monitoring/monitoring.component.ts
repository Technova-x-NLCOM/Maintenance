import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getApiBaseUrl } from '../../services/api-base';

export interface TransactionRecord {
  transaction_id: number;
  transaction_type: 'IN' | 'OUT';
  quantity: number;
  reference_number: string;
  transaction_date: string;
  reason: string | null;
  notes: string | null;
  destination: string | null;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  batch_number: string | null;
  performed_by_name: string;
  created_at: string;
}

export interface StockReportRecord {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name: string | null;
  category_name: string | null;
  measurement_unit: string | null;
  reorder_level: number;
  current_stock: number;
  total_in: number;
  total_out: number;
}

interface Paginated<T> {
  success: boolean;
  data: { data: T[]; current_page: number; last_page: number; per_page: number; total: number };
}

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './monitoring.component.html',
  styleUrl: './monitoring.component.scss',
})
export class MonitoringComponent implements OnInit, OnDestroy {
  activeTab: 'stock' | 'history' = 'stock';

  private readonly SEARCH_DEBOUNCE_MS = 300;

  // Stock Report state
  stockItems: StockReportRecord[] = [];
  stPage = 1;
  stLastPage = 1;
  stTotal = 0;
  stSearch = '';
  stLowStock = false;
  stLoading = false;
  stError = '';

  private stockLoadSub?: Subscription;
  private stSearchDebounceId?: ReturnType<typeof setTimeout>;
  private stPage1Baseline: {
    items: StockReportRecord[];
    lastPage: number;
    total: number;
    lowStock: boolean;
  } | null = null;

  // Transaction History state
  transactions: TransactionRecord[] = [];
  txPage = 1;
  txLastPage = 1;
  txTotal = 0;
  txSearch = '';
  txType: '' | 'IN' | 'OUT' = '';
  txDateFrom = '';
  txDateTo = '';
  txLoading = false;
  txError = '';

  private txLoadSub?: Subscription;
  private txSearchDebounceId?: ReturnType<typeof setTimeout>;
  private txPage1Baseline: {
    items: TransactionRecord[];
    lastPage: number;
    total: number;
    type: '' | 'IN' | 'OUT';
    dateFrom: string;
    dateTo: string;
  } | null = null;

  private readonly BASE = `${getApiBaseUrl()}/inventory/transactions`;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe,
  ) {}

  ngOnInit(): void {
    this.loadStock(1);
  }

  ngOnDestroy(): void {
    this.cancelStockSearchDebounce();
    this.cancelTxSearchDebounce();
    this.stockLoadSub?.unsubscribe();
    this.txLoadSub?.unsubscribe();
  }

  setTab(tab: 'stock' | 'history'): void {
    this.cancelStockSearchDebounce();
    this.cancelTxSearchDebounce();
    this.activeTab = tab;
    if (tab === 'history' && this.transactions.length === 0) this.loadTx(1);
    if (tab === 'stock' && this.stockItems.length === 0) this.loadStock(1);
  }

  // ── Stock Report ─────────────────────────────────────────────────
  loadStock(page = 1): void {
    this.stockLoadSub?.unsubscribe();
    this.stLoading = true;
    this.stError = '';
    let p = new HttpParams().set('page', String(page)).set('per_page', '25');
    if (this.stSearch.trim()) p = p.set('search', this.stSearch.trim());
    if (this.stLowStock) p = p.set('low_stock', '1');
    this.stockLoadSub = this.http
      .get<Paginated<StockReportRecord>>(`${this.BASE}/stock-report`, {
        headers: this.authHeaders(),
        params: p,
      })
      .subscribe({
        next: (res) => {
          this.stockItems = res.data.data;
          this.stPage = res.data.current_page;
          this.stLastPage = res.data.last_page;
          this.stTotal = res.data.total;
          if (res.data.current_page === 1 && !this.stSearch.trim()) {
            this.stPage1Baseline = {
              items: res.data.data.slice(),
              lastPage: res.data.last_page,
              total: res.data.total,
              lowStock: this.stLowStock,
            };
          }
          this.stLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.stError = 'Failed to load stock report.';
          this.stLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onStockSearchInput(): void {
    this.cancelStockSearchDebounce();
    const q = this.stSearch.trim();
    if (!q) {
      this.stockLoadSub?.unsubscribe();
      this.stLoading = false;
      this.stError = '';
      this.restoreStockSearchCleared();
      return;
    }
    this.stSearchDebounceId = setTimeout(() => {
      this.stSearchDebounceId = undefined;
      this.loadStock(1);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearStockSearchBox(): void {
    this.stSearch = '';
    this.cancelStockSearchDebounce();
    this.stockLoadSub?.unsubscribe();
    this.stLoading = false;
    this.stError = '';
    this.restoreStockSearchCleared();
  }

  private cancelStockSearchDebounce(): void {
    if (this.stSearchDebounceId !== undefined) {
      clearTimeout(this.stSearchDebounceId);
      this.stSearchDebounceId = undefined;
    }
  }

  private restoreStockSearchCleared(): void {
    if (
      this.stPage1Baseline &&
      this.stPage1Baseline.lowStock === this.stLowStock
    ) {
      this.stockItems = this.stPage1Baseline.items.slice();
      this.stPage = 1;
      this.stLastPage = this.stPage1Baseline.lastPage;
      this.stTotal = this.stPage1Baseline.total;
      this.cdr.detectChanges();
      return;
    }
    this.loadStock(1);
  }

  applyStock(): void {
    this.cancelStockSearchDebounce();
    this.loadStock(1);
  }

  clearStock(): void {
    this.cancelStockSearchDebounce();
    this.stockLoadSub?.unsubscribe();
    this.stSearch = '';
    this.stLowStock = false;
    this.loadStock(1);
  }

  // ── Transaction History ──────────────────────────────────────────
  loadTx(page = 1): void {
    this.txLoadSub?.unsubscribe();
    this.txLoading = true;
    this.txError = '';
    let p = new HttpParams().set('page', String(page)).set('per_page', '20');
    if (this.txSearch.trim()) p = p.set('search', this.txSearch.trim());
    if (this.txType) p = p.set('type', this.txType);
    if (this.txDateFrom) p = p.set('date_from', this.txDateFrom);
    if (this.txDateTo) p = p.set('date_to', this.txDateTo);
    this.txLoadSub = this.http
      .get<Paginated<TransactionRecord>>(this.BASE, { headers: this.authHeaders(), params: p })
      .subscribe({
        next: (res) => {
          this.transactions = res.data.data;
          this.txPage = res.data.current_page;
          this.txLastPage = res.data.last_page;
          this.txTotal = res.data.total;
          if (res.data.current_page === 1 && !this.txSearch.trim()) {
            this.txPage1Baseline = {
              items: res.data.data.slice(),
              lastPage: res.data.last_page,
              total: res.data.total,
              type: this.txType,
              dateFrom: this.txDateFrom,
              dateTo: this.txDateTo,
            };
          }
          this.txLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.txError = 'Failed to load transactions.';
          this.txLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onTxSearchInput(): void {
    this.cancelTxSearchDebounce();
    const q = this.txSearch.trim();
    if (!q) {
      this.txLoadSub?.unsubscribe();
      this.txLoading = false;
      this.txError = '';
      this.restoreTxSearchCleared();
      return;
    }
    this.txSearchDebounceId = setTimeout(() => {
      this.txSearchDebounceId = undefined;
      this.loadTx(1);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearTxSearchBox(): void {
    this.txSearch = '';
    this.cancelTxSearchDebounce();
    this.txLoadSub?.unsubscribe();
    this.txLoading = false;
    this.txError = '';
    this.restoreTxSearchCleared();
  }

  private cancelTxSearchDebounce(): void {
    if (this.txSearchDebounceId !== undefined) {
      clearTimeout(this.txSearchDebounceId);
      this.txSearchDebounceId = undefined;
    }
  }

  private restoreTxSearchCleared(): void {
    if (
      this.txPage1Baseline &&
      this.txPage1Baseline.type === this.txType &&
      this.txPage1Baseline.dateFrom === this.txDateFrom &&
      this.txPage1Baseline.dateTo === this.txDateTo
    ) {
      this.transactions = this.txPage1Baseline.items.slice();
      this.txPage = 1;
      this.txLastPage = this.txPage1Baseline.lastPage;
      this.txTotal = this.txPage1Baseline.total;
      this.cdr.detectChanges();
      return;
    }
    this.loadTx(1);
  }

  applyTx(): void {
    this.cancelTxSearchDebounce();
    this.loadTx(1);
  }

  clearTx(): void {
    this.cancelTxSearchDebounce();
    this.txLoadSub?.unsubscribe();
    this.txSearch = '';
    this.txType = '';
    this.txDateFrom = '';
    this.txDateTo = '';
    this.loadTx(1);
  }

  // ── Pagination ───────────────────────────────────────────────────
  pageRange(current: number, last: number): number[] {
    const s = Math.max(1, current - 2),
      e = Math.min(last, current + 2);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }

  // ── Export Excel ─────────────────────────────────────────────────
  exportExcel(): void {
    const isStock = this.activeTab === 'stock';
    const rows = isStock ? this.stockToRows(this.stockItems) : this.txToRows(this.transactions);
    if (rows.length <= 1) return;

    const title = isStock ? 'Stock Report' : 'Transaction History';
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';
    const wsData = [['NLCOM - IMS'], [title], [`Generated: ${dateStr}`], [], ...rows];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colCount = rows[0].length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    const dataRows = wsData.slice(4);
    ws['!cols'] = Array.from({ length: colCount }, (_, ci) => {
      const max = dataRows.reduce((w, row) => {
        const val = row[ci] != null ? String(row[ci]) : '';
        return Math.max(w, val.length);
      }, 10);
      return { wch: Math.min(max + 2, 60) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isStock ? 'Stock Report' : 'Transaction History');
    XLSX.writeFile(wb, isStock ? 'stock_report.xlsx' : 'transaction_history.xlsx');
  }

  // ── Export PDF ───────────────────────────────────────────────────
  exportPdf(): void {
    const isStock = this.activeTab === 'stock';
    const title = isStock ? 'Stock Report' : 'Transaction History';
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y, h:mm a') ?? '';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('NLCOM - IMS', 40, 36);
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(title, 40, 54);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${dateStr}`, 40, 68);

    if (isStock) {
      autoTable(doc, {
        startY: 80,
        head: [['Item Code', 'Description', 'Category', 'UoM', 'Current Stock', 'Total IN', 'Total OUT', 'Reorder Level', 'Status']],
        body: this.stockItems.map((r) => [
          r.item_code,
          r.item_description,
          r.category_name ?? '—',
          r.measurement_unit ?? '—',
          r.current_stock,
          r.total_in,
          r.total_out,
          r.reorder_level,
          r.current_stock <= r.reorder_level ? 'Low Stock' : 'OK',
        ]),
        styles: { fontSize: 7, cellPadding: 4 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          // Status column is the last one (index 8).
          if (data.section === 'body' && data.column.index === 8) {
            const val = String(data.cell.raw ?? '');
            data.cell.styles.textColor = val === 'Low Stock' ? [234, 88, 12] : [22, 163, 74];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    } else {
      autoTable(doc, {
        startY: 80,
        head: [['Type', 'Reference', 'Item Code', 'Description', 'Batch', 'Qty', 'Unit', 'Destination / Reason', 'Performed By', 'Date']],
        body: this.transactions.map((r) => [
          r.transaction_type,
          r.reference_number,
          r.item_code,
          r.item_description,
          r.batch_number ?? '—',
          r.quantity,
          r.measurement_unit ?? '—',
          r.destination ?? r.reason ?? '—',
          r.performed_by_name,
          this.datePipe.transform(r.transaction_date, 'MMM d, y, h:mm a') ?? r.transaction_date,
        ]),
        styles: { fontSize: 7, cellPadding: 4 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const val = data.cell.raw as string;
            data.cell.styles.textColor = val === 'IN' ? [22, 163, 74] : [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    doc.save(isStock ? 'stock_report.pdf' : 'transaction_history.pdf');
  }

  private stockToRows(rows: StockReportRecord[]): any[][] {
    return [
      ['Item Code', 'Description', 'Category', 'UoM', 'Current Stock', 'Total IN', 'Total OUT', 'Reorder Level', 'Status'],
      ...rows.map((r) => [
        r.item_code,
        r.item_description,
        r.category_name ?? '—',
        r.measurement_unit ?? '—',
        r.current_stock,
        r.total_in,
        r.total_out,
        r.reorder_level,
        r.current_stock <= r.reorder_level ? 'Low Stock' : 'OK',
      ]),
    ];
  }

  private txToRows(rows: TransactionRecord[]): any[][] {
    return [
      ['Type', 'Reference', 'Item Code', 'Description', 'Batch', 'Qty', 'Unit', 'Destination/Reason', 'Performed By', 'Date'],
      ...rows.map((r) => [
        r.transaction_type,
        r.reference_number,
        r.item_code,
        r.item_description,
        r.batch_number ?? '—',
        r.quantity,
        r.measurement_unit ?? '—',
        r.destination ?? r.reason ?? '—',
        r.performed_by_name,
        this.datePipe.transform(r.transaction_date, 'MMM d, y, h:mm a') ?? r.transaction_date,
      ]),
    ];
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }

  isLowStock(item: StockReportRecord): boolean {
    return item.current_stock <= item.reorder_level;
  }
}
