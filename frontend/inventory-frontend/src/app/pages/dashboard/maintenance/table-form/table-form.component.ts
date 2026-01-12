import { Component, OnInit, Input } from '@angular/core';
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
  schema: { columns: string[]; primary_key: string | string[]; soft_deletes: boolean } | null = null;
  pkKey: string | null = null;
  formData: any = {};
  isNew = true;
  loading = false;

  constructor(private api: MaintenanceService) {}

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
    this.api.getSchema(this.selectedTable).subscribe(s => {
      this.schema = s;
      this.pkKey = typeof s.primary_key === 'string' ? s.primary_key : null;
      if (this.isNew) {
        this.initializeForm();
      }
    });
  }

  loadFormData(): void {
    if (!this.parent.editingRow) return;
    this.formData = { ...this.parent.editingRow };
  }

  initializeForm(): void {
    if (!this.schema) return;
    this.formData = {};
    this.schema.columns.forEach(c => {
      this.formData[c] = null;
    });
  }

  isReadonly(column: string): boolean {
    return column === this.pkKey || column === 'deleted_at' || column === 'created_at' || column === 'updated_at';
  }

  onSubmit(): void {
    if (!this.selectedTable || !this.schema) return;
    this.loading = true;
    const payload = this.buildPayload();

    if (this.isNew) {
      this.api.createRow(this.selectedTable, payload).subscribe(() => {
        this.loading = false;
        this.parent.goToTableListView();
      });
    } else {
      const id = this.formData[this.pkKey!];
      this.api.updateRow(this.selectedTable, id, payload).subscribe(() => {
        this.loading = false;
        this.parent.goToTableListView();
      });
    }
  }

  private buildPayload(): any {
    if (!this.schema) return {};
    const payload: any = {};
    this.schema.columns.forEach(c => {
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
