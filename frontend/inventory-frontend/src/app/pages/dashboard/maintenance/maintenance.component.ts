import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService, MaintenanceTableInfo } from '../../../services/maintenance.service';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './maintenance.component.html',
  styleUrls: ['./maintenance.component.scss']
})
export class MaintenanceComponent implements OnInit {
  tables: MaintenanceTableInfo[] = [];
  selectedTable: string | null = null;
  schema: { columns: string[]; types?: Record<string, string>; primary_key: string | string[]; soft_deletes: boolean } | null = null;
  pkKey: string | null = null;
  rows: any[] = [];
  page = 1;
  perPage = 25;
  showDeleted = false;
  loading = false;

  // Form state
  editingRow: any | null = null;
  newRow: any = {};

  constructor(private api: MaintenanceService) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.api.listTables().subscribe(t => (this.tables = t));
  }

  selectTable(name: string): void {
    this.selectedTable = name;
    this.page = 1;
    this.schema = null;
    this.pkKey = null;
    this.rows = [];
    this.api.getSchema(name).subscribe(s => {
      this.schema = s;
      this.pkKey = typeof s.primary_key === 'string' ? s.primary_key : null;
      this.newRow = {};
      this.fetchRows();
    });
  }

  fetchRows(): void {
    if (!this.selectedTable) return;
    this.loading = true;
    this.api
      .listRows(this.selectedTable, { page: this.page, perPage: this.perPage, showDeleted: this.showDeleted })
      .subscribe(({ data }) => {
        this.rows = data;
        this.loading = false;
      });
  }

  startEdit(row: any): void {
    this.editingRow = { ...row };
  }

  cancelEdit(): void {
    this.editingRow = null;
  }

  saveEdit(): void {
    if (!this.selectedTable || !this.editingRow || !this.schema) return;
    if (!this.pkKey) return;
    const pk = this.pkKey;
    const id = this.editingRow[pk];
    const payload = this.buildPayload(this.editingRow);
    this.api.updateRow(this.selectedTable, id, payload).subscribe(() => {
      this.editingRow = null;
      this.fetchRows();
    });
  }

  createRow(): void {
    if (!this.selectedTable || !this.schema) return;
    const payload = this.buildPayload(this.newRow);
    this.api.createRow(this.selectedTable, payload).subscribe(() => {
      this.newRow = {};
      this.fetchRows();
    });
  }

  deleteRow(row: any): void {
    if (!this.selectedTable || !this.schema) return;
    if (!this.pkKey) return;
    const pk = this.pkKey;
    const id = row[pk];
    this.api.deleteRow(this.selectedTable, id).subscribe(() => this.fetchRows());
  }

  restoreRow(row: any): void {
    if (!this.selectedTable || !this.schema) return;
    if (!this.pkKey) return;
    const pk = this.pkKey;
    const id = row[pk];
    this.api.restoreRow(this.selectedTable, id).subscribe(() => this.fetchRows());
  }

  private buildPayload(source: any): any {
    if (!this.schema) return {};
    const payload: any = {};
    for (const c of this.schema.columns) {
      if (c === this.pkKey) continue;
      if (c === 'deleted_at') continue;
      payload[c] = source[c] ?? null;
    }
    return payload;
  }
}
