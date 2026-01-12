import { Component, OnInit, Input } from '@angular/core';
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
  schema: { columns: string[]; primary_key: string | string[]; soft_deletes: boolean } | null = null;
  pkKey: string | null = null;
  rows: any[] = [];
  showDeleted = false;
  loading = false;

  constructor(private api: MaintenanceService) {}

  ngOnInit(): void {
    this.selectedTable = this.parent.selectedTable;
    if (this.selectedTable) {
      this.loadSchema();
      this.fetchRows();
    }
  }

  loadSchema(): void {
    if (!this.selectedTable) return;
    this.api.getSchema(this.selectedTable).subscribe(s => {
      this.schema = s;
      this.pkKey = typeof s.primary_key === 'string' ? s.primary_key : null;
    });
  }

  fetchRows(): void {
    if (!this.selectedTable) return;
    this.loading = true;
    this.api.listRows(this.selectedTable, { showDeleted: this.showDeleted }).subscribe(({ data }) => {
      this.rows = data;
      this.loading = false;
    });
  }

  deleteRow(row: any): void {
    if (!this.selectedTable || !this.pkKey) return;
    if (confirm('Are you sure?')) {
      this.api.deleteRow(this.selectedTable, row[this.pkKey]).subscribe(() => this.fetchRows());
    }
  }

  restoreRow(row: any): void {
    if (!this.selectedTable || !this.pkKey) return;
    this.api.restoreRow(this.selectedTable, row[this.pkKey]).subscribe(() => this.fetchRows());
  }

  goBack(): void {
    this.parent.goToHome();
  }

  goToForm(row: any | null): void {
    this.parent.goToForm(row);
  }
}
