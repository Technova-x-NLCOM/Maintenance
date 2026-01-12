import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../../services/maintenance.service';
import { 
  getFriendlyTableName as getTableName,
  getFriendlyColumnName as getColName
} from '../table-config';

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-list.component.html',
  styleUrls: ['./table-list.component.scss']
})
export class TableListComponent implements OnInit {
  @Input() parent: any;
  selectedTable: string | null = null;
  schema: { columns: string[]; primary_key: string | string[]; soft_deletes: boolean; relations?: Record<string, { ref_table: string; ref_key: string; label_column: string }>; lookups?: Record<string, Record<string | number, string>> } | null = null;
  pkKey: string | null = null;
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

  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.selectedTable = this.parent.selectedTable;
    if (this.selectedTable) {
      this.loadSchema();
      this.fetchRows();
    }
  }

  loadSchema(): void {
    if (!this.selectedTable) return;
    this.api.getSchema(this.selectedTable).subscribe({
      next: (s) => {
        this.schema = s;
        this.pkKey = typeof s.primary_key === 'string' ? s.primary_key : null;
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
    this.api.listRows(this.selectedTable, { showDeleted: this.showDeleted, page: this.currentPage, perPage: this.perPage }).subscribe({
      next: ({ data, page, perPage, total }) => {
        this.rows = data;
        this.currentPage = page;
        this.perPage = perPage;
        this.total = total;
        this.totalPages = Math.ceil(total / perPage);
        this.loading = false;
        console.log('Loaded rows:', data);
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
    if (!this.selectedTable || !this.pkKey) return;
    if (confirm('Are you sure?')) {
      this.api.deleteRow(this.selectedTable, row[this.pkKey]).subscribe({
        next: () => this.fetchRows(),
        error: (err) => console.error('Error deleting row:', err)
      });
    }
  }

  restoreRow(row: any): void {
    if (!this.selectedTable || !this.pkKey) return;
    this.api.restoreRow(this.selectedTable, row[this.pkKey]).subscribe({
      next: () => this.fetchRows(),
      error: (err) => console.error('Error restoring row:', err)
    });
  }

  goBack(): void {
    this.parent.goToHome();
  }

  goToForm(row: any | null): void {
    this.parent.goToForm(row);
  }

  formatCell(column: string, row: any): any {
    if (!this.schema) return row[column];
    const lookups = this.schema.lookups || {};
    const map = lookups[column];
    if (map) {
      const key = row[column];
      if (key !== undefined && key !== null && map[key] !== undefined) {
        return map[key];
      }
    }
    return row[column];
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.fetchRows();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
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

  // Friendly name helpers
  getFriendlyTableName(): string {
    return this.selectedTable ? getTableName(this.selectedTable) : '';
  }

  getFriendlyColumnName(column: string): string {
    return this.selectedTable ? getColName(this.selectedTable, column) : column;
  }
}
