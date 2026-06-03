import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { getApiBaseUrl } from '../../../services/api-base';
import { AuditExportService } from '../../../services/audit-export.service';

export interface DiscrepancyRecord {
  transaction_id: number;
  transaction_type: 'DISCREPANCY';
  quantity: number;
  reference_number: string;
  transaction_date: string;
  reason: string | null;
  notes: string | null;
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  batch_number: string | null;
  batch_location_name: string | null;
  from_location_name: string | null;
  performed_by_name: string;
  created_at: string;
}

@Component({
  selector: 'app-discrepancy-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  providers: [DatePipe],
  templateUrl: './discrepancy-monitoring.component.html',
  styleUrls: ['./discrepancy-monitoring.component.scss'],
})
export class DiscrepancyMonitoringComponent implements OnInit, OnDestroy {
  records: DiscrepancyRecord[] = [];
  page = 1;
  lastPage = 1;
  total = 0;
  search = '';
  discrepancyType: '' | 'surplus' | 'shortage' = '';
  dateFrom = '';
  dateTo = '';
  loading = false;

  private readonly DEBOUNCE_MS = 300;
  private loadSub?: Subscription;
  private searchDebounceId?: ReturnType<typeof setTimeout>;
  private page1Baseline: { items: DiscrepancyRecord[]; lastPage: number; total: number } | null = null;

  private readonly BASE = `${getApiBaseUrl()}/inventory/discrepancy`;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe,
    private toast: ToastService,
    private auditExport: AuditExportService,
  ) {}

  ngOnInit(): void {
    this.load(1);
  }

  ngOnDestroy(): void {
    this.cancelDebounce();
    this.loadSub?.unsubscribe();
  }

  load(page = 1): void {
    this.cancelDebounce();
    this.loadSub?.unsubscribe();
    this.loading = true;

    let p = new HttpParams().set('page', String(page)).set('per_page', '15');
    if (this.search.trim()) p = p.set('search', this.search.trim());
    if (this.discrepancyType) p = p.set('discrepancy_type', this.discrepancyType);
    if (this.dateFrom) p = p.set('date_from', this.dateFrom);
    if (this.dateTo) p = p.set('date_to', this.dateTo);

    this.loadSub = this.http
      .get<any>(this.BASE, { headers: this.authHeaders(), params: p })
      .subscribe({
        next: (res) => {
          this.records = res.data.data;
          this.page = res.data.current_page;
          this.lastPage = res.data.last_page;
          this.total = res.data.total;
          if (page === 1 && !this.search.trim()) {
            this.page1Baseline = { items: res.data.data.slice(), lastPage: res.data.last_page, total: res.data.total };
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error('Failed to load discrepancy records.');
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onSearchInput(): void {
    this.cancelDebounce();
    if (!this.search.trim()) {
      this.loadSub?.unsubscribe();
      this.loading = false;
      if (this.page1Baseline) {
        this.records = this.page1Baseline.items.slice();
        this.page = 1;
        this.lastPage = this.page1Baseline.lastPage;
        this.total = this.page1Baseline.total;
        this.cdr.detectChanges();
      }
      return;
    }
    this.searchDebounceId = setTimeout(() => { this.searchDebounceId = undefined; this.load(1); }, this.DEBOUNCE_MS);
  }

  clearSearch(): void {
    this.search = '';
    this.onSearchInput();
  }

  apply(): void { this.cancelDebounce(); this.load(1); }

  clear(): void {
    this.cancelDebounce();
    this.loadSub?.unsubscribe();
    this.search = '';
    this.discrepancyType = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.load(1);
  }

  private cancelDebounce(): void {
    if (this.searchDebounceId !== undefined) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = undefined;
    }
  }

  discrepancyTypeLabel(qty: number): string {
    return qty > 0 ? 'Surplus' : 'Shortage';
  }

  exportExcel(): void {
    if (!this.records.length) return;
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';
    const dataRows: any[][] = [
      ['Reference', 'Item Code', 'Description', 'Location', 'Variance', 'Type', 'UoM', 'Reason', 'Performed By', 'Date'],
      ...this.records.map(r => [
        r.reference_number,
        r.item_code,
        r.item_description,
        r.batch_location_name ?? r.from_location_name ?? '—',
        r.quantity > 0 ? `+${r.quantity}` : String(r.quantity),
        this.discrepancyTypeLabel(r.quantity),
        r.measurement_unit ?? '—',
        r.reason ?? '—',
        r.performed_by_name,
        this.datePipe.transform(r.transaction_date, 'MMM d, y, h:mm a') ?? r.transaction_date,
      ]),
    ];
    const wsData = [['NLCOM - IMS'], ['Discrepancy Monitoring'], [`Generated: ${dateStr}`], [], ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colCount = dataRows[0].length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws['!cols'] = Array.from({ length: colCount }, (_, ci) => ({
      wch: Math.min(dataRows.reduce((w, row) => Math.max(w, String(row[ci] ?? '').length), 10) + 2, 60),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Discrepancy');
    XLSX.writeFile(wb, 'discrepancy_monitoring.xlsx');
    this.auditExport.log('discrepancy_monitoring', 'excel', this.records.length);
  }

  exportPdf(): void {
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y, h:mm a') ?? '';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('NLCOM - IMS', 40, 36);
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Discrepancy Monitoring', 40, 54);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${dateStr}`, 40, 68);
    autoTable(doc, {
      startY: 80,
      head: [['Reference', 'Item Code', 'Description', 'Location', 'Variance', 'Type', 'UoM', 'Reason', 'Performed By', 'Date']],
      body: this.records.map(r => [
        r.reference_number,
        r.item_code,
        r.item_description,
        r.batch_location_name ?? r.from_location_name ?? '—',
        r.quantity > 0 ? `+${r.quantity}` : String(r.quantity),
        this.discrepancyTypeLabel(r.quantity),
        r.measurement_unit ?? '—',
        r.reason ?? '—',
        r.performed_by_name,
        this.datePipe.transform(r.transaction_date, 'MMM d, y, h:mm a') ?? r.transaction_date,
      ]),
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const type = data.cell.raw as string;
          data.cell.styles.textColor = type === 'Surplus' ? [22, 163, 74] : [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    doc.save('discrepancy_monitoring.pdf');
    this.auditExport.log('discrepancy_monitoring', 'pdf', this.records.length);
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }
}
