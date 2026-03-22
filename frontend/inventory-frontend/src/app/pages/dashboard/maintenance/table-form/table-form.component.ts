import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MaintenanceService } from '../../../../services/maintenance.service';
import { ToastService } from '../../../../services/toast.service';
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
  settingsMap: Record<string, string> = {};

  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.selectedTable = this.parent.selectedTable;
    this.isNew = !this.parent.editingRow;
    if (this.selectedTable) {
      this.loadSchema();
      if (!this.isNew) {
        this.loadFormData();
      }
      if (this.isTransactionTable()) {
        this.loadTransactionPolicies();
      }
    }
  }

  isTransactionTable(): boolean {
    return this.selectedTable === 'inventory_transactions';
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
    return column === 'deleted_at' || column === 'created_at' || column === 'updated_at';
  }

  isPrimaryKeyField(column: string): boolean {
    return this.pkKeys.includes(column) || column === this.pkKey;
  }

  /** Hide system ID (single primary key) from form so user doesn't see a disabled ID field. */
  isHiddenFromForm(column: string): boolean {
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
    
    const payload = this.buildPayload();

    if (this.isTransactionTable()) {
      this.validateTransactionRules(payload).subscribe((validationError) => {
        if (validationError) {
          this.errorMessage = validationError;
          this.loading = false;
          this.cdr.markForCheck();
          return;
        }
        this.submitPayload(payload);
      });
      return;
    }

    this.submitPayload(payload);
  }

  private submitPayload(payload: any): void {
    if (!this.selectedTable) {
      return;
    }
    const table = this.selectedTable;

    this.loading = true;
    this.cdr.markForCheck();

    if (this.isNew) {
      this.api.createRow(table, payload).subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Record created successfully!';
          this.toastService.success(this.successMessage);
          setTimeout(() => {
            this.parent.goToTableListView();
          }, 1000);
        },
        error: (err) => {
          console.error('Error creating row:', err);
          this.errorMessage = 'Error creating record: ' + (err.error?.message || err.error?.error || 'Unknown error');
          this.toastService.error(this.errorMessage);
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
      
      this.api.updateRow(table, id, payload).subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Record updated successfully!';
          this.toastService.success(this.successMessage);
          setTimeout(() => {
            this.parent.goToTableListView();
          }, 1000);
        },
        error: (err) => {
          console.error('Error updating row:', err);
          this.errorMessage = 'Error updating record: ' + (err.error?.message || err.error?.error || 'Unknown error');
          this.toastService.error(this.errorMessage);
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

  private loadTransactionPolicies(): void {
    this.api.listRows('system_settings', { page: 1, perPage: 200 }).pipe(
      catchError(() => of({ data: [] }))
    ).subscribe((response: any) => {
      const settingsRows = Array.isArray(response?.data) ? response.data : [];
      const map: Record<string, string> = {};
      settingsRows.forEach((row: any) => {
        const key = String(row.setting_key || '').toLowerCase();
        if (key) {
          map[key] = String(row.setting_value ?? '').toLowerCase();
        }
      });
      this.settingsMap = map;
    });
  }

  private validateTransactionRules(payload: any) {
    const quantity = Number(payload.quantity || 0);
    const txType = String(payload.transaction_type || '').toLowerCase();

    if (!txType) {
      return of('Transaction type is required.');
    }

    if (txType === 'adjustment') {
      if (quantity === 0) {
        return of('Adjustment quantity cannot be zero. Use a signed value.');
      }
    } else if (quantity <= 0) {
      return of('Quantity must be greater than zero.');
    }

    const approvalRequired = this.getBooleanSetting(['approval_required_out_transfer', 'require_approval_out_transfer', 'approval_required']);
    if (approvalRequired && (txType === 'out' || txType === 'transfer') && !payload.approved_by) {
      return of('Approval is required for OUT/TRANSFER transactions.');
    }

    const allowNegativeStock = this.getBooleanSetting(['allow_negative_stock', 'negative_stock_allowed']);
    if (allowNegativeStock || txType === 'in' || txType === 'adjustment') {
      return of('');
    }

    const itemId = payload.item_id;
    const batchId = payload.batch_id;
    return this.checkStockAvailability(itemId, batchId, quantity, txType);
  }

  private checkStockAvailability(itemId: any, batchId: any, quantity: number, txType: string) {
    if (!itemId) {
      return of('Item is required for this transaction.');
    }

    return this.api.listRows('inventory_batches', { page: 1, perPage: 1000 }).pipe(
      map((response: any) => {
        const batchRows = Array.isArray(response?.data) ? response.data : [];
        const available = batchId
          ? batchRows
              .filter((row: any) => String(row.batch_id) === String(batchId))
              .reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0)
          : batchRows
              .filter((row: any) => String(row.item_id) === String(itemId))
              .reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);

        if ((txType === 'out' || txType === 'transfer') && quantity > available) {
          return `Insufficient stock. Available: ${available}, requested: ${quantity}.`;
        }

        return '';
      }),
      catchError(() => of('Unable to verify stock availability right now. Please try again.'))
    );
  }

  private getBooleanSetting(keys: string[]): boolean {
    for (const key of keys) {
      const value = this.settingsMap[key];
      if (value !== undefined) {
        return ['1', 'true', 'yes', 'enabled', 'on'].includes(value);
      }
    }
    return false;
  }

  goBack(): void {
    this.parent.goToTableListView();
  }
}
