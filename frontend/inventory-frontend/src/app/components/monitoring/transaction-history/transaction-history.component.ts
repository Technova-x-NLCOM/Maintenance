import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransactionRecord, Paginated } from '../monitoring.models';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  providers: [DatePipe],
  templateUrl: './transaction-history.component.html',
  styleUrl: './transaction-history.component.scss',
})
export class TransactionHistoryComponent implements OnInit, OnDestroy {
  transactions: TransactionRecord[] = [];
  page = 1;
  lastPage = 1;
  total = 0;
  search = '';
  type: '' | 'IN' | 'OUT' | 'ADJUSTMENT' = '';
  dateFrom = '';
  dateTo = '';
  loading = false;
  error = '';

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadSub?: Subscription;
  private searchDebounceId?: ReturnType<typeof setTimeout>;
  private page1Baseline: {
    items: TransactionRecord[];
    lastPage: number;
    total: number;
    type: '' | 'IN' | 'OUT' | 'ADJUSTMENT';
    dateFrom: string;
    dateTo: string;
  } | null = null;

  private readonly BASE = 'http://127.0.0.1:8000/api/inventory/transactions';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load(1);
  }

  ngOnDestroy(): void {
    this.cancelSearchDebounce();
    this.loadSub?.unsubscribe();
  }

  load(page = 1): void {
    this.cancelSearchDebounce();
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = '';
    let p = new HttpParams().set('page', String(page)).set('per_page', '10');
    if (this.search.trim()) p = p.set('search', this.search.trim());
    if (this.type) p = p.set('type', this.type);
    if (this.dateFrom) p = p.set('date_from', this.dateFrom);
    if (this.dateTo) p = p.set('date_to', this.dateTo);
    this.loadSub = this.http
      .get<Paginated<TransactionRecord>>(this.BASE, { headers: this.authHeaders(), params: p })
      .subscribe({
        next: (res) => {
          this.transactions = res.data.data;
          this.page = res.data.current_page;
          this.lastPage = res.data.last_page;
          this.total = res.data.total;
          if (res.data.current_page === 1 && !this.search.trim()) {
            this.page1Baseline = {
              items: res.data.data.slice(),
              lastPage: res.data.last_page,
              total: res.data.total,
              type: this.type,
              dateFrom: this.dateFrom,
              dateTo: this.dateTo,
            };
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error('Failed to load transactions.');
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onSearchInput(): void {
    this.cancelSearchDebounce();
    if (!this.search.trim()) {
      this.loadSub?.unsubscribe();
      this.loading = false;
      this.error = '';
      this.restoreSearchCleared();
      return;
    }
    this.searchDebounceId = setTimeout(() => {
      this.searchDebounceId = undefined;
      this.load(1);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearSearchBoxOnly(): void {
    this.search = '';
    this.cancelSearchDebounce();
    this.loadSub?.unsubscribe();
    this.loading = false;
    this.error = '';
    this.restoreSearchCleared();
  }

  private cancelSearchDebounce(): void {
    if (this.searchDebounceId !== undefined) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = undefined;
    }
  }

  private restoreSearchCleared(): void {
    if (
      this.page1Baseline &&
      this.page1Baseline.type === this.type &&
      this.page1Baseline.dateFrom === this.dateFrom &&
      this.page1Baseline.dateTo === this.dateTo
    ) {
      this.transactions = this.page1Baseline.items.slice();
      this.page = 1;
      this.lastPage = this.page1Baseline.lastPage;
      this.total = this.page1Baseline.total;
      this.cdr.detectChanges();
      return;
    }
    this.load(1);
  }

  apply(): void {
    this.cancelSearchDebounce();
    this.load(1);
  }

  clear(): void {
    this.cancelSearchDebounce();
    this.loadSub?.unsubscribe();
    this.search = '';
    this.type = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.load(1);
  }
  pageRange(cur: number, last: number): number[] {
    const s = Math.max(1, cur - 2),
      e = Math.min(last, cur + 2);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }

  exportExcel(): void {
    if (!this.transactions.length) return;
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';
    const dataRows: any[][] = [
      [
        'Type',
        'Reference',
        'Item Code',
        'Description',
        'Batch',
        'Location',
        'Qty',
        'Unit',
        'Destination / Reason',
        'Performed By',
        'Date',
      ],
      ...this.transactions.map((r) => [
        r.transaction_type,
        r.reference_number,
        r.item_code,
        r.item_description,
        r.batch_number ?? '—',
        r.batch_location_name ?? r.from_location_name ?? r.to_location_name ?? '—',
        r.quantity,
        r.measurement_unit ?? '—',
        r.destination ?? r.reason ?? '—',
        r.performed_by_name,
        this.datePipe.transform(r.transaction_date, 'MMM d, y, h:mm a') ?? r.transaction_date,
      ]),
    ];
    const wsData = [
      ['NLCOM - IMS'],
      ['Transaction History'],
      [`Generated: ${dateStr}`],
      [],
      ...dataRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colCount = dataRows[0].length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws['!cols'] = Array.from({ length: colCount }, (_, ci) => ({
      wch: Math.min(
        dataRows.reduce((w, row) => Math.max(w, String(row[ci] ?? '').length), 10) + 2,
        60,
      ),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transaction History');
    XLSX.writeFile(wb, 'transaction_history.xlsx');
  }

  exportPdf(): void {
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y, h:mm a') ?? '';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('NLCOM - IMS', 40, 36);
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Transaction History', 40, 54);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${dateStr}`, 40, 68);
    autoTable(doc, {
      startY: 80,
      head: [
        [
          'Type',
          'Reference',
          'Item Code',
          'Description',
          'Batch',
          'Location',
          'Qty',
          'Unit',
          'Destination / Reason',
          'Performed By',
          'Date',
        ],
      ],
      body: this.transactions.map((r) => [
        r.transaction_type,
        r.reference_number,
        r.item_code,
        r.item_description,
        r.batch_number ?? '—',
        r.batch_location_name ?? r.from_location_name ?? r.to_location_name ?? '—',
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
          const txType = data.cell.raw as string;
          if (txType === 'IN') {
            data.cell.styles.textColor = [22, 163, 74];
          } else if (txType === 'ADJUSTMENT') {
            data.cell.styles.textColor = [30, 64, 175];
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    doc.save('transaction_history.pdf');
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }
}
