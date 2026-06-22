import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';

import { getApiBaseUrl } from '../../../services/api-base';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { AuditExportService } from '../../../services/audit-export.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok';

export interface ExpiryBatch {
  batch_id: number;
  batch_number: string | null;
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  quantity: number;
  expiry_date: string;
  location_id: number | null;
  location_name: string | null;
  location_code: string | null;
  days_until_expiry: number;
  expiry_status: ExpiryStatus;
}

interface PaginatedResponse {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  data: ExpiryBatch[];
}

interface ExpiryApiResponse {
  success: boolean;
  message: string;
  summary: { expired: number; critical: number; warning: number; ok: number };
  data: PaginatedResponse;
}

@Component({
  selector: 'app-expiry-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  providers: [DatePipe],
  templateUrl: './expiry-monitor.component.html',
  styleUrls: ['./expiry-monitor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpiryMonitorComponent implements OnInit, OnDestroy {
  batches: ExpiryBatch[] = [];
  summary = { expired: 0, critical: 0, warning: 0, ok: 0 };

  // Filters
  statusFilter: ExpiryStatus | 'all' = 'all';
  searchTerm = '';
  pageSize = 25;

  // Pagination
  page = 1;
  lastPage = 1;
  total = 0;

  loading = false;

  private loadSub?: Subscription;
  private searchDebounce?: ReturnType<typeof setTimeout>;
  private readonly BASE = `${getApiBaseUrl()}/inventory/expiry-monitor`;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private datePipe: DatePipe,
    private auditExport: AuditExportService,
  ) {}

  ngOnInit(): void {
    this.load(1);
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  load(page = 1): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.cdr.markForCheck();

    let params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(this.pageSize));

    if (this.statusFilter !== 'all') params = params.set('status', this.statusFilter);
    if (this.searchTerm.trim()) params = params.set('search', this.searchTerm.trim());

    this.loadSub = this.http
      .get<ExpiryApiResponse>(this.BASE, { headers: this.authHeaders(), params })
      .subscribe({
        next: (res) => {
          this.batches = res.data.data;
          this.summary = res.summary;
          this.page = res.data.current_page;
          this.lastPage = res.data.last_page;
          this.total = res.data.total;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.toast.error(err?.error?.message || 'Failed to load expiry data.');
          this.cdr.markForCheck();
        },
      });
  }

  onSearchInput(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(1), 300);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.load(1);
  }

  applyFilter(status: ExpiryStatus | 'all'): void {
    this.statusFilter = status;
    this.load(1);
  }

  // ── View helpers ──────────────────────────────────────────────────────────

  statusLabel(status: ExpiryStatus): string {
    const map: Record<ExpiryStatus, string> = {
      expired: 'Expired',
      critical: 'Critical (≤7 days)',
      warning: 'Warning (8–30 days)',
      ok: 'OK (>30 days)',
    };
    return map[status] ?? status;
  }

  statusClass(status: ExpiryStatus): string {
    return `badge-${status}`;
  }

  daysLabel(days: number): string {
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
    if (days === 0) return 'Expires today';
    return `${days} day${days !== 1 ? 's' : ''} left`;
  }

  pageRange(cur: number, last: number): number[] {
    const s = Math.max(1, cur - 2);
    const e = Math.min(last, cur + 2);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportExcel(): void {
    if (!this.batches.length) return;
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';

    const rows: any[][] = [
      ['Item Code', 'Description', 'Batch', 'Location', 'Qty', 'Unit', 'Expiry Date', 'Days', 'Status'],
      ...this.batches.map((b) => [
        b.item_code,
        b.item_description,
        b.batch_number ?? '—',
        b.location_name ?? '—',
        b.quantity,
        b.measurement_unit ?? '—',
        b.expiry_date,
        b.days_until_expiry,
        this.statusLabel(b.expiry_status),
      ]),
    ];

    const wsData = [
      ['NLCOM - IMS'],
      ['Expiry Monitor Report'],
      [`Generated: ${dateStr}`],
      [],
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colCount = rows[0].length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws['!cols'] = rows[0].map((_, ci) => ({
      wch: Math.min(rows.reduce((w, row) => Math.max(w, String(row[ci] ?? '').length), 10) + 2, 50),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expiry Monitor');
    XLSX.writeFile(wb, 'expiry_monitor.xlsx');
    this.auditExport.log('schedule_monitoring', 'excel', this.batches.length);
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '' });
  }
}
