import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../../services/maintenance.service';
import { 
  getFriendlyTableName as getTableName,
  getFriendlyColumnName as getColName,
  getColumnDescription as getColDesc,
  getColumnPlaceholder as getColPlaceholder
} from '../table-config';

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './table-form.component.html',
  styleUrls: ['./table-form.component.scss']
})
export class TableFormComponent implements OnInit {
  @Input() parent: any;
  /** When true, form is shown inside a modal (Close instead of Back, no full-page layout). */
  @Input() modalMode = false;
  selectedTable: string | null = null;
  schema: any | null = null;
  pkKey: string | null = null;
  pkKeys: string[] = []; // For composite primary keys
  formData: any = {};
  isNew = true;
  loading = false;
  lookups: { [key: string]: { [id: string]: string } } = {};
  columnDetails: { [key: string]: { nullable: boolean; type: string } } = {};
  enumValues: { [key: string]: string[] } = {};
  successMessage = '';
  errorMessage = '';

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
        this.enumValues = s.enum_values || {};
        // Handle both single and composite primary keys
        if (typeof s.primary_key === 'string') {
          this.pkKey = s.primary_key;
          this.pkKeys = [s.primary_key];
        } else if (Array.isArray(s.primary_key)) {
          this.pkKey = null;
          this.pkKeys = s.primary_key;
        }
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

  // Friendly name helpers
  getFriendlyTableName(): string {
    return this.selectedTable ? getTableName(this.selectedTable) : '';
  }

  getFriendlyColumnName(column: string): string {
    return this.selectedTable ? getColName(this.selectedTable, column) : column;
  }

  getColumnDescription(column: string): string {
    return this.selectedTable ? getColDesc(this.selectedTable, column) : '';
  }

  getColumnPlaceholder(column: string): string {
    return this.selectedTable ? getColPlaceholder(this.selectedTable, column) : `Enter ${column}`;
  }

  // Field type helpers
  isReadonly(column: string): boolean {
    // For composite primary keys, only make them readonly when editing (not when creating new)
    if (this.pkKeys.includes(column) && !this.isNew) {
      return true;
    }
    // Single primary key is always readonly
    if (column === this.pkKey) {
      return true;
    }
    // In user role assignments, we don't let admins manually toggle "primary"
    // from this generic maintenance form; the backend keeps primary consistent.
    if (this.selectedTable === 'user_roles' && column === 'is_primary') {
      return true;
    }
    return column === 'deleted_at' || column === 'created_at' || column === 'updated_at';
  }

  isPrimaryKeyField(column: string): boolean {
    return this.pkKeys.includes(column) || column === this.pkKey;
  }

  /** Hide system ID (single primary key) from form so user doesn't see a disabled ID field. */
  isHiddenFromForm(column: string): boolean {
    // Hide auto-managed timestamps and the primary toggle in user role assignment forms.
    if (this.selectedTable === 'user_roles' && (column === 'created_at' || column === 'updated_at' || column === 'is_primary')) {
      return true;
    }
    return this.pkKey !== null && column === this.pkKey;
  }

  isForeignKey(column: string): boolean {
    return this.lookups && column in this.lookups;
  }

  isRequired(column: string): boolean {
    if (this.isReadonly(column)) return false;
    const details = this.columnDetails[column];
    return details ? !details.nullable : false;
  }

  isBooleanField(column: string): boolean {
    const details = this.columnDetails[column];
    if (!details) return false;
    const type = details.type?.toLowerCase() || '';
    // Don't treat as boolean if it's an enum field
    if (this.isEnumField(column)) return false;
    return type.includes('tinyint') || type.includes('boolean') || 
           column === 'is_active' || column === 'is_primary' ||
           column.startsWith('can_') || column.startsWith('is_');
  }

  isEnumField(column: string): boolean {
    return this.enumValues && column in this.enumValues && this.enumValues[column].length > 0;
  }

  getEnumOptions(column: string): string[] {
    return this.enumValues[column] || [];
  }

  formatEnumLabel(value: string): string {
    // Convert enum value to user-friendly label (e.g., 'pending' -> 'Pending')
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
  }

  isDateField(column: string): boolean {
    const details = this.columnDetails[column];
    if (!details) return false;
    const type = details.type?.toLowerCase() || '';
    return type.includes('date') || type.includes('timestamp') ||
           column.endsWith('_date') || column.endsWith('_at');
  }

  isNumberField(column: string): boolean {
    const details = this.columnDetails[column];
    if (!details) return false;
    const type = details.type?.toLowerCase() || '';
    return type.includes('int') || type.includes('decimal') || 
           type.includes('float') || type.includes('double') ||
           column.includes('quantity') || column.includes('value') ||
           column.includes('level') || column.includes('price');
  }

  isTextArea(column: string): boolean {
    const details = this.columnDetails[column];
    if (!details) return false;
    const type = details.type?.toLowerCase() || '';
    return type.includes('text') || type.includes('longtext') ||
           column === 'description' || column === 'remarks' || 
           column === 'notes' || column === 'particular' ||
           column === 'old_values' || column === 'new_values';
  }

  isFullWidth(column: string): boolean {
    return this.isTextArea(column) || column === 'description' || 
           column === 'remarks' || column === 'notes';
  }

  formatReadonlyValue(column: string, value: any): string {
    if (value === null || value === undefined) return '—';
    if (this.isDateField(column) && value) {
      try {
        const date = new Date(value);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return String(value);
      }
    }
    return String(value);
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
    
    // Clear previous messages
    this.successMessage = '';
    this.errorMessage = '';
    
    // Validate required fields
    const missingFields: string[] = [];
    this.schema.columns.forEach((col: string) => {
      if (this.isRequired(col) && !this.isReadonly(col)) {
        const value = this.formData[col];
        if (value === null || value === undefined || value === '') {
          missingFields.push(this.getFriendlyColumnName(col));
        }
      }
    });
    
    if (missingFields.length > 0) {
      this.errorMessage = `Please fill in the required fields: ${missingFields.join(', ')}`;
      return;
    }
    
    this.loading = true;
    this.cdr.markForCheck();
    const payload = this.buildPayload();

    if (this.isNew) {
      this.api.createRow(this.selectedTable, payload).subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Record created successfully!';
          setTimeout(() => {
            this.parent.goToTableListView();
          }, 1000);
        },
        error: (err) => {
          console.error('Error creating row:', err);
          this.errorMessage = 'Error creating record: ' + (err.error?.message || err.error?.error || 'Unknown error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      // Handle both single and composite primary keys
      let id: string | number;
      if (this.pkKey) {
        id = this.formData[this.pkKey];
      } else if (this.pkKeys.length > 0) {
        // For composite keys, use the first key value (backend handles composite keys via query string)
        id = this.formData[this.pkKeys[0]];
      } else {
        console.error('No primary key defined');
        this.loading = false;
        return;
      }
      
      this.api.updateRow(this.selectedTable, id, payload).subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Record updated successfully!';
          setTimeout(() => {
            this.parent.goToTableListView();
          }, 1000);
        },
        error: (err) => {
          console.error('Error updating row:', err);
          this.errorMessage = 'Error updating record: ' + (err.error?.message || err.error?.error || 'Unknown error');
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
      // Include composite primary key fields when creating new records
      if (this.isNew && this.pkKeys.includes(c) && !this.pkKey) {
        payload[c] = this.formData[c] ?? null;
      } else if (!this.isReadonly(c)) {
        payload[c] = this.formData[c] ?? null;
      }
    });
    return payload;
  }

  goBack(): void {
    this.parent.goToTableListView();
  }
}
