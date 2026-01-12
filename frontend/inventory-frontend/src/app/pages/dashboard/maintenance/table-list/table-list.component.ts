import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../../services/maintenance.service';

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
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading schema:', err)
    });
  }

  fetchRows(): void {
    if (!this.selectedTable) return;
    this.loading = true;
    this.cdr.markForCheck();
    this.api.listRows(this.selectedTable, { showDeleted: this.showDeleted }).subscribe({
      next: ({ data }) => {
        this.rows = data;
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
}
