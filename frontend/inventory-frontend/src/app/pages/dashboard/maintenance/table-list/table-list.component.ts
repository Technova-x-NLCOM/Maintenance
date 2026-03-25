import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MaintenanceService } from '../../../../services/maintenance.service';
import { 
  getFriendlyTableName as getTableName,
  getFriendlyColumnName as getColName,
  getTableDescription as getTableDesc
} from '../table-config';

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-list.component.html',
  styleUrls: ['./table-list.component.scss']
})
export class TableListComponent implements OnInit, OnDestroy {
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
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;
  private fetchSub?: Subscription;
  private page1Unfiltered: {
    rows: any[];
    total: number;
    totalPages: number;
    showDeleted: boolean;
    table: string;
  } | null = null;

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

  ngOnDestroy(): void {
    this.fetchSub?.unsubscribe();
    if (this.searchTimeout !== undefined) {
      clearTimeout(this.searchTimeout);
    }
  }

  fetchRows(): void {
    if (!this.selectedTable) return;
    this.fetchSub?.unsubscribe();
    this.loading = true;
    this.cdr.markForCheck();
    this.fetchSub = this.api.listRows(this.selectedTable, { 
      showDeleted: this.showDeleted, 
      page: this.currentPage, 
      perPage: this.perPage,
      search: this.searchQuery || undefined
    }).subscribe({
      next: ({ data, page, perPage, total }) => {
        this.rows = data;
        this.currentPage = page;
        this.perPage = perPage;
        this.total = total;
        this.totalPages = Math.ceil(total / perPage);
        if (page === 1 && !this.searchQuery.trim()) {
          this.page1Unfiltered = {
            rows: data.slice(),
            total,
            totalPages: Math.ceil(total / perPage),
            showDeleted: this.showDeleted,
            table: this.selectedTable as string,
          };
        }
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
    this.parent.goToHome();
  }

  goToForm(row: any | null): void {
    this.parent.goToForm(row);
  }

  formatCell(column: string, row: any): any {
    if (!this.schema) return row[column];
    const value = row[column];
    
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

  // Search methods
  onSearchChange(): void {
    if (this.searchTimeout !== undefined) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = undefined;
    }
    const q = this.searchQuery.trim();
    if (!q) {
      this.fetchSub?.unsubscribe();
      this.loading = false;
      this.currentPage = 1;
      this.restoreUnfilteredPage1OrFetch();
      return;
    }
    this.searchTimeout = setTimeout(() => {
      this.searchTimeout = undefined;
      this.currentPage = 1;
      this.fetchRows();
    }, 300);
  }

  clearSearch(): void {
    if (this.searchTimeout !== undefined) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = undefined;
    }
    this.fetchSub?.unsubscribe();
    this.searchQuery = '';
    this.currentPage = 1;
    this.loading = false;
    this.restoreUnfilteredPage1OrFetch();
  }

  private restoreUnfilteredPage1OrFetch(): void {
    if (
      this.page1Unfiltered &&
      this.selectedTable &&
      this.page1Unfiltered.table === this.selectedTable &&
      this.page1Unfiltered.showDeleted === this.showDeleted
    ) {
      this.rows = this.page1Unfiltered.rows.slice();
      this.currentPage = 1;
      this.total = this.page1Unfiltered.total;
      this.totalPages = this.page1Unfiltered.totalPages;
      this.cdr.markForCheck();
      return;
    }
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
}
