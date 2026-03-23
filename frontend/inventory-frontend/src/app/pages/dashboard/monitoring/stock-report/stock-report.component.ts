import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StockReportRecord, Paginated } from '../monitoring.models';

@Component({
  selector: 'app-stock-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './stock-report.component.html',
  styleUrl: './stock-report.component.scss'
})
export class StockReportComponent implements OnInit {
  items: StockReportRecord[] = [];
  page = 1; lastPage = 1; total = 0;
  search = ''; lowStock = false;
  loading = false; error = '';

  private readonly BASE = 'http://127.0.0.1:8000/api/inventory/transactions';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private datePipe: DatePipe) {}

  ngOnInit(): void { this.load(1); }

  load(page = 1): void {
    this.loading = true; this.error = '';
    let p = new HttpParams().set('page', String(page)).set('per_page', '25');
    if (this.search.trim()) p = p.set('search', this.search.trim());
    if (this.lowStock) p = p.set('low_stock', '1');
    this.http.get<Paginated<StockReportRecord>>(`${this.BASE}/stock-report`, { headers: this.authHeaders(), params: p }).subscribe({
      next: (res) => { this.items = res.data.data; this.page = res.data.current_page; this.lastPage = res.data.last_page; this.total = res.data.total; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.error = 'Failed to load stock report.'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  apply(): void { this.load(1); }
  clear(): void { this.search = ''; this.lowStock = false; this.load(1); }
  isLow(item: StockReportRecord): boolean { return item.current_stock <= item.reorder_level; }
  pageRange(cur: number, last: number): number[] {
    const s = Math.max(1, cur - 2), e = Math.min(last, cur + 2);
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }

  exportExcel(): void {
    if (!this.items.length) return;
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';
    const dataRows: any[][] = [
      ['Item Code', 'Description', 'Category', 'UoM', 'Current Stock', 'Total IN', 'Total OUT', 'Reorder Level', 'Status'],
      ...this.items.map(r => [r.item_code, r.item_description, r.category_name ?? '—', r.measurement_unit ?? '—', r.current_stock, r.total_in, r.total_out, r.reorder_level, this.isLow(r) ? 'Low Stock' : 'OK'])
    ];
    const wsData = [['NLCOM - IMS'], ['Stock Report'], [`Generated: ${dateStr}`], [], ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colCount = dataRows[0].length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    ];
    ws['!cols'] = Array.from({ length: colCount }, (_, ci) => ({
      wch: Math.min(dataRows.reduce((w, row) => Math.max(w, String(row[ci] ?? '').length), 10) + 2, 60)
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
    XLSX.writeFile(wb, 'stock_report.xlsx');
  }

  exportPdf(): void {
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y, h:mm a') ?? '';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16); doc.setTextColor(99, 102, 241); doc.text('NLCOM - IMS', 40, 36);
    doc.setFontSize(11); doc.setTextColor(51, 65, 85); doc.text('Stock Report', 40, 54);
    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text(`Generated: ${dateStr}`, 40, 68);
    autoTable(doc, {
      startY: 80,
      head: [['Item Code', 'Description', 'Category', 'UoM', 'Current Stock', 'Total IN', 'Total OUT', 'Reorder Level', 'Status']],
      body: this.items.map(r => [r.item_code, r.item_description, r.category_name ?? '—', r.measurement_unit ?? '—', r.current_stock, r.total_in, r.total_out, r.reorder_level, this.isLow(r) ? 'Low Stock' : 'OK']),
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          data.cell.styles.textColor = (data.cell.raw as string) === 'Low Stock' ? [234, 88, 12] : [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });
    doc.save('stock_report.pdf');
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }
}
