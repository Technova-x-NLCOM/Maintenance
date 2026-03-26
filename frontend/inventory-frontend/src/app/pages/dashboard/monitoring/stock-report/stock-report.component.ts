import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StockReportRecord, Paginated } from '../monitoring.models';
import { InventoryCategoryService } from '../../../../services/inventory-category.service';

@Component({
  selector: 'app-stock-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './stock-report.component.html',
  styleUrls: ['./stock-report.component.scss'],
})
export class StockReportComponent implements OnInit {
  items: StockReportRecord[] = [];
  page = 1;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50];
  lastPage = 1;
  totalCount = 0;
  search = '';
  stockFilter: 'all' | 'out_of_stock' | 'low_stock' = 'all';
  categoryIdFilter: number | '' = '';
  categories: Array<{ category_id: number; category_name: string }> = [];
  selectedCategoryLabel = 'All Categories';
  categoryFilterOpen = false;
  categoryFilterQuery = '';
  activeCategoryOptionIndex = -1;
  filteredCategoryOptions: Array<{ category_id: number; category_name: string }> = [];
  loading = false;
  error = '';

  private loadSub?: Subscription;
  private searchDebounceId?: ReturnType<typeof setTimeout>;
  private readonly SEARCH_DEBOUNCE_MS = 300;

  private readonly BASE = 'http://127.0.0.1:8000/api/inventory/transactions';

  constructor(
    private http: HttpClient,
    private categoryService: InventoryCategoryService,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe,
  ) {}

  ngOnInit(): void {
    this.loadCategoryOptions();
    this.load(1);
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.cancelSearchDebounce();
  }

  load(page = 1, pageSize: number = this.pageSize): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.error = '';

    let p = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(pageSize));

    const normalizedSearch = this.search.trim();
    if (normalizedSearch) {
      p = p.set('search', normalizedSearch);
    }

    if (this.categoryIdFilter !== '') {
      p = p.set('category_id', String(this.categoryIdFilter));
    }

    if (this.stockFilter === 'low_stock') {
      p = p.set('low_stock', '1');
    } else if (this.stockFilter === 'out_of_stock') {
      p = p.set('stock_status', 'out_of_stock');
    }

    this.loadSub = this.http
      .get<Paginated<StockReportRecord>>(`${this.BASE}/stock-report`, {
        headers: this.authHeaders(),
        params: p,
      })
      .subscribe({
        next: (res) => {
          this.items = res.data.data;
          this.page = res.data.current_page;
          this.pageSize = res.data.per_page;
          this.lastPage = res.data.last_page;
          this.totalCount = res.data.total;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Failed to load stock report.';
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onSearchChange(): void {
    this.cancelSearchDebounce();
    this.searchDebounceId = setTimeout(() => {
      this.searchDebounceId = undefined;
      this.load(1, this.pageSize);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearSearch(): void {
    this.search = '';
    this.cancelSearchDebounce();
    this.load(1, this.pageSize);
  }

  onCategoryFilterChange(): void {
    this.load(1, this.pageSize);
  }

  toggleCategoryFilterDropdown(): void {
    this.categoryFilterOpen = !this.categoryFilterOpen;
    if (this.categoryFilterOpen) {
      this.categoryFilterQuery = '';
      this.applyCategoryFilterSearch();
      this.activeCategoryOptionIndex = this.getActiveCategoryIndexFromSelection();
      this.cdr.detectChanges();
    }
  }

  onCategoryFilterQueryChange(): void {
    this.applyCategoryFilterSearch();
  }

  selectCategoryFilter(category: { category_id: number; category_name: string } | null): void {
    this.categoryIdFilter = category?.category_id ?? '';
    this.selectedCategoryLabel = category?.category_name ?? 'All Categories';
    this.categoryFilterOpen = false;
    this.categoryFilterQuery = '';
    this.activeCategoryOptionIndex = -1;
    this.onCategoryFilterChange();
  }

  clearCategoryFilter(event?: Event): void {
    event?.stopPropagation();
    if (this.categoryIdFilter === '') {
      return;
    }
    this.selectCategoryFilter(null);
  }

  onCategoryComboboxKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!this.categoryFilterOpen) {
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        this.toggleCategoryFilterDropdown();
      }
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      this.categoryFilterOpen = false;
      this.activeCategoryOptionIndex = -1;
      return;
    }

    if (!this.filteredCategoryOptions.length) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      this.activeCategoryOptionIndex = Math.min(
        this.activeCategoryOptionIndex + 1,
        this.filteredCategoryOptions.length - 1,
      );
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      this.activeCategoryOptionIndex = Math.max(this.activeCategoryOptionIndex - 1, 0);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      if (this.activeCategoryOptionIndex >= 0) {
        this.selectCategoryFilter(this.filteredCategoryOptions[this.activeCategoryOptionIndex]);
      }
    }
  }

  onCategoryOptionHover(index: number): void {
    this.activeCategoryOptionIndex = index;
  }

  onStockFilterChange(): void {
    this.load(1, this.pageSize);
  }

  onPageSizeChange(): void {
    this.load(1, this.pageSize);
  }

  goFirst(): void {
    if (this.page <= 1 || this.loading) {
      return;
    }
    this.load(1, this.pageSize);
  }

  goPrevious(): void {
    if (this.page <= 1 || this.loading) {
      return;
    }
    this.load(this.page - 1, this.pageSize);
  }

  goNext(): void {
    if (this.page >= this.lastPage || this.loading) {
      return;
    }
    this.load(this.page + 1, this.pageSize);
  }

  goLast(): void {
    if (this.page >= this.lastPage || this.loading) {
      return;
    }
    this.load(this.lastPage, this.pageSize);
  }

  private loadCategoryOptions(): void {
    this.categoryService.getOptions().subscribe({
      next: (res: {
        data: {
          categories: Array<{ category_id: number; category_name: string }>;
        };
      }) => {
        this.categories = (res.data.categories || []).slice().sort((a: { category_name: string }, b: { category_name: string }) =>
          a.category_name.localeCompare(b.category_name)
        );
        this.applyCategoryFilterSearch();

        if (this.categoryIdFilter !== '') {
          const selected = this.categories.find((category) => category.category_id === this.categoryIdFilter);
          if (selected) {
            this.selectedCategoryLabel = selected.category_name;
          } else {
            this.categoryIdFilter = '';
            this.selectedCategoryLabel = 'All Categories';
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.filteredCategoryOptions = [];
        this.categoryIdFilter = '';
        this.selectedCategoryLabel = 'All Categories';
        this.cdr.detectChanges();
      }
    });
  }

  private applyCategoryFilterSearch(): void {
    const query = this.categoryFilterQuery.trim().toLowerCase();
    this.filteredCategoryOptions = this.categories.filter((category) => {
      if (!query) {
        return true;
      }
      return category.category_name.toLowerCase().includes(query);
    });

    if (!this.filteredCategoryOptions.length) {
      this.activeCategoryOptionIndex = -1;
      return;
    }

    this.activeCategoryOptionIndex = this.getActiveCategoryIndexFromSelection();
  }

  private getActiveCategoryIndexFromSelection(): number {
    if (!this.filteredCategoryOptions.length) {
      return -1;
    }

    const selectedIndex = this.filteredCategoryOptions.findIndex(
      (category) => category.category_id === this.categoryIdFilter,
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.categoryFilterOpen) {
      return;
    }

    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    if (!target.closest('.category-filter-combobox')) {
      this.categoryFilterOpen = false;
      this.activeCategoryOptionIndex = -1;
    }
  }

  private cancelSearchDebounce(): void {
    if (this.searchDebounceId !== undefined) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = undefined;
    }
  }

  isLow(item: StockReportRecord): boolean {
    return item.current_stock <= item.reorder_level;
  }

  exportExcel(): void {
    if (!this.items.length) return;
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y') ?? '';
    const dataRows: any[][] = [
      ['Item Code', 'Description', 'Category', 'UoM', 'Current Stock', 'Total IN', 'Total OUT', 'Reorder Level', 'Status'],
      ...this.items.map((r) => [
        r.item_code,
        r.item_description,
        r.category_name ?? '—',
        r.measurement_unit ?? '—',
        r.current_stock,
        r.total_in,
        r.total_out,
        r.reorder_level,
        this.isLow(r) ? 'Low Stock' : 'OK',
      ]),
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
      wch: Math.min(
        dataRows.reduce((w, row) => Math.max(w, String(row[ci] ?? '').length), 10) + 2,
        60,
      ),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
    XLSX.writeFile(wb, 'stock_report.xlsx');
  }

  exportPdf(): void {
    const dateStr = this.datePipe.transform(new Date(), 'MMMM d, y, h:mm a') ?? '';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('NLCOM - IMS', 40, 36);
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Stock Report', 40, 54);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${dateStr}`, 40, 68);
    autoTable(doc, {
      startY: 80,
      head: [['Item Code', 'Description', 'Category', 'UoM', 'Current Stock', 'Total IN', 'Total OUT', 'Reorder Level', 'Status']],
      body: this.items.map((r) => [
        r.item_code,
        r.item_description,
        r.category_name ?? '—',
        r.measurement_unit ?? '—',
        r.current_stock,
        r.total_in,
        r.total_out,
        r.reorder_level,
        this.isLow(r) ? 'Low Stock' : 'OK',
      ]),
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 8) {
          data.cell.styles.textColor =
            (data.cell.raw as string) === 'Low Stock' ? [234, 88, 12] : [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    doc.save('stock_report.pdf');
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }
}
