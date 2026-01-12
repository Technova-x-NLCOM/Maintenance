import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../../services/maintenance.service';

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-form.component.html',
  styleUrls: ['./table-form.component.scss']
})
export class TableFormComponent implements OnInit {
  @Input() parent: any;
  selectedTable: string | null = null;
  schema: any | null = null;
  pkKey: string | null = null;
  formData: any = {};
  isNew = true;
  loading = false;
  lookups: { [key: string]: { [id: string]: string } } = {};
  columnDetails: { [key: string]: { nullable: boolean; type: string } } = {};

  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.selectedTable = this.parent.selectedTable;
    this.isNew = !this.parent.editingRow;
    if (this.selectedTable) {
      this.loadSchema();
      if (!this.isNew) {
        this.loadFormData();
      }
    }
  }

  loadSchema(): void {
    if (!this.selectedTable) return;
    this.api.getSchema(this.selectedTable).subscribe({
      next: (s) => {
        this.schema = s;
        this.lookups = s.lookups || {};
        this.columnDetails = s.column_details || {};
        this.pkKey = typeof s.primary_key === 'string' ? s.primary_key : null;
        if (this.isNew) {
          this.initializeForm();
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading schema:', err)
    });
  }

  loadFormData(): void {
    if (!this.parent.editingRow) return;
    this.formData = { ...this.parent.editingRow };
  }

  initializeForm(): void {
    if (!this.schema) return;
    this.formData = {};
    this.schema.columns.forEach((c: string) => {
      this.formData[c] = null;
    });
  }

  isReadonly(column: string): boolean {
    return column === this.pkKey || column === 'deleted_at' || column === 'created_at' || column === 'updated_at';
  }

  isForeignKey(column: string): boolean {
    return this.lookups && column in this.lookups;
  }

  isRequired(column: string): boolean {
    if (this.isReadonly(column)) return false;
    const details = this.columnDetails[column];
    return details ? !details.nullable : false;
  }

  getForeignKeyOptions(column: string): { id: string; label: string }[] {
    const lookup = this.lookups[column];
    if (!lookup) return [];
    return Object.entries(lookup).map(([id, label]) => ({
      id,
      label: String(label)
    }));
  }

  onSubmit(): void {
    if (!this.selectedTable || !this.schema) return;
    this.loading = true;
    this.cdr.markForCheck();
    const payload = this.buildPayload();

    if (this.isNew) {
      this.api.createRow(this.selectedTable, payload).subscribe({
        next: () => {
          this.loading = false;
          this.parent.goToTableListView();
        },
        error: (err) => {
          console.error('Error creating row:', err);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      const id = this.formData[this.pkKey!];
      this.api.updateRow(this.selectedTable, id, payload).subscribe({
        next: () => {
          this.loading = false;
          this.parent.goToTableListView();
        },
        error: (err) => {
          console.error('Error updating row:', err);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  private buildPayload(): any {
    if (!this.schema) return {};
    const payload: any = {};
    this.schema.columns.forEach((c: string) => {
      if (!this.isReadonly(c)) {
        payload[c] = this.formData[c] ?? null;
      }
    });
    return payload;
  }

  goBack(): void {
    this.parent.goToTableListView();
  }
}
