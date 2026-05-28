import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../services/maintenance.service';

export interface AuditLogEntry {
  log_id: number;
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values?: any;
  new_values?: any;
  performed_by: number;
  performed_by_name?: string;
  performed_by_role?: string | null;
  performed_by_role_display?: string | null;
  ip_address: string;
  created_at: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  page: number;
  perPage: number;
  total: number;
}

interface DetailField {
  key: string;
  label: string;
  value: string;
}

interface UpdateDetailField {
  key: string;
  label: string;
  beforeValue: string;
  afterValue: string;
}

type ActionType = 'ADD' | 'UPDATE' | 'DELETE' | 'OTHER';
type ModuleType = 'Category' | 'Inventory' | 'Users' | 'Other';

const HIDDEN_DETAIL_FIELDS = new Set([
  'batch_id',
  'batch_value',
  'created_at',
  'created_by',
  'deleted_at',
  'ip_address',
  'manufactured_date',
  'performed_by',
  'qr_payload',
  'qr_label',
  'record_id',
  'table_name',
  'updated_at',
]);

const FRIENDLY_FIELD_LABELS: Record<string, string> = {
  base_unit_count: 'Base unit count',
  distribution_type: 'Distribution type',
  is_active: 'Active',
  item_code: 'Item code',
  item_description: 'Item name',
  item_id: 'Item',
  location_id: 'Location',
  notes: 'Notes',
  reason: 'Reason',
  template_id: 'Template',
  template_name: 'Template name',
  user_id: 'User',
};

const VALUE_MAPPERS: Record<string, (value: unknown) => string> = {
  distribution_type: (value) => {
    if (value === 'relief_goods') return 'Relief goods';
    if (value === 'feeding_program') return 'Feeding program';
    return String(value ?? '');
  },
  is_active: (value) => (value === 1 || value === '1' || value === true ? 'Yes' : 'No'),
};

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.scss'],
})
export class AuditLogComponent implements OnInit {
  logs: AuditLogEntry[] = [];
  loading = true;
  error = '';
  currentPage = 1;
  perPage = 25;
  total = 0;
  search = '';
  expandedLogId: number | null = null;
  sortOrder: 'newest' | 'oldest' = 'newest';
  filterActionType = 'ALL';
  filterModule = 'ALL';


  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }


  loadLogs(): void {
    this.loading = true;
    this.error = '';


    this.api
      .listRows('audit_log', {
        page: this.currentPage,
        perPage: this.perPage,
        search: this.search || undefined,
        extraParams: {
          excludeTables: 'inventory_transactions',
          sortOrder: this.sortOrder,
        },
      })
      .subscribe({
        next: (response: AuditLogResponse) => {
          this.logs = response.data;
          this.currentPage = response.page;
          this.perPage = response.perPage;
          this.total = response.total;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = err?.error?.message || 'Failed to load audit logs. Please check your permissions.';
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  clearSearch(): void {
    this.search = '';
    this.currentPage = 1;
    this.loadLogs();
  }

  nextPage(): void {
    if (this.currentPage * this.perPage < this.total) {
      this.currentPage++;
      this.loadLogs();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadLogs();
    }
  }

  toggleExpanded(logId: number): void {
    this.expandedLogId = this.expandedLogId === logId ? null : logId;
    this.cdr.detectChanges();
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'INSERT':
        return 'Created';
      case 'UPDATE':
        return 'Edited';
      case 'DELETE':
        return 'Removed';
      default:
        return action;
    }
  }

  getNormalizedActionType(log: AuditLogEntry): ActionType {
    const action = (log.action || '').toUpperCase();
    if (action === 'INSERT') {
      return 'ADD';
    }

    if (action === 'UPDATE') {
      return 'UPDATE';
    }

    if (action === 'DELETE') {
      return 'DELETE';
    }

    const text = `${this.getActivitySentence(log)} ${action}`.toLowerCase();
    if (/\b(create|created|add|added|insert|inserted)\b/.test(text)) {
      return 'ADD';
    }
    if (/\b(update|updated|edit|edited|modify|modified)\b/.test(text)) {
      return 'UPDATE';
    }
    if (/\b(delete|deleted|remove|removed)\b/.test(text)) {
      return 'DELETE';
    }

    return 'OTHER';
  }

  getActionBadgeClass(log: AuditLogEntry): string {
    const type = this.getNormalizedActionType(log);
    if (type === 'ADD') {
      return 'badge-add';
    }
    if (type === 'UPDATE') {
      return 'badge-update';
    }
    if (type === 'DELETE') {
      return 'badge-delete';
    }
    return 'badge-default';
  }

  getFriendlyTableName(tableName: string): string {
    const lookup: Record<string, string> = {
      audit_log: 'Audit Log Entry',
      users: 'User Account',
      user_roles: 'User Role Assignment',
      roles: 'Role',
      permissions: 'Permission',
      role_permissions: 'Role Permission Rule',
      categories: 'Category',
      items: 'Item',
      
      inventory_batches: 'Inventory Batch',
      inventory_transactions: 'Inventory Transaction',
      inventory_snapshots: 'Inventory Snapshot',
      expiry_alerts: 'Expiry Alert',
      system_settings: 'System Setting',
    };

    if (lookup[tableName]) {
      return lookup[tableName];
    }

    return this.formatFieldLabel(tableName).replace(/\bLog\b/g, 'Log Entry');
  }

  getActorName(log: AuditLogEntry): string {
    return (log.performed_by_name || '').trim() || 'A user';
  }

  getActorRoleLabel(log: AuditLogEntry): string {
    const display = (log.performed_by_role_display || '').trim();
    if (display) return display;
    const role = (log.performed_by_role || '').trim();
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'inventory_manager') return 'Inventory Manager';
    if (role) return this.formatFieldLabel(role);
    return 'User';
  }

  getActorRoleClass(log: AuditLogEntry): string {
    const role = (log.performed_by_role || '').trim();
    if (role === 'super_admin') return 'role-super-admin';
    if (role === 'inventory_manager') return 'role-inventory-manager';
    return 'role-default';
  }

  getActionPhrase(action: string): string {
    switch (action) {
      case 'INSERT':
        return 'created a new';
      case 'UPDATE':
        return 'edited';
      case 'DELETE':
        return 'removed';
      default:
        return 'changed';
    }
  }

  getActivitySentence(log: AuditLogEntry): string {
    return `${this.getActorName(log)} ${this.getActionPhrase(log.action)} ${this.getFriendlyTableName(log.table_name)}.`;
  }

  getModuleType(log: AuditLogEntry): ModuleType {
    const table = (log.table_name || '').toLowerCase();

    if (table.includes('category')) {
      return 'Category';
    }

    if (table.includes('inventory') || table === 'items' || table === 'expiry_alerts') {
      return 'Inventory';
    }

    if (table.includes('user') || table.includes('role') || table.includes('permission')) {
      return 'Users';
    }

    return 'Other';
  }

  getModuleIcon(log: AuditLogEntry): 'folder' | 'box' | 'users' | 'dot' {
    const moduleType = this.getModuleType(log);
    if (moduleType === 'Category') {
      return 'folder';
    }
    if (moduleType === 'Inventory') {
      return 'box';
    }
    if (moduleType === 'Users') {
      return 'users';
    }
    return 'dot';
  }

  formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  parseStoredValues(value: any): Record<string, any> {
    if (!value) {
      return {};
    }

    if (typeof value === 'object') {
      return value;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }

    return {};
  }

  formatFieldLabel(key: string): string {
    if (FRIENDLY_FIELD_LABELS[key]) {
      return FRIENDLY_FIELD_LABELS[key];
    }
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  formatFieldValue(value: any, key?: string): string {
    if (value === null || value === undefined || value === '') {
      return 'Not set';
    }

    if (key && VALUE_MAPPERS[key]) {
      return VALUE_MAPPERS[key](value);
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    const text = String(value).trim();
    if (text === '1') return 'Yes';
    if (text === '0') return 'No';
    return text;
  }

  private isMeaningfulFormattedValue(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized !== '' && normalized !== 'not set' && normalized !== 'null' && normalized !== 'undefined';
  }

  private getVisibleKeys(oldValues: Record<string, any>, newValues: Record<string, any>): string[] {
    return Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]))
      .filter((key) => !HIDDEN_DETAIL_FIELDS.has(key))
      .sort();
  }

  getCreationFields(log: AuditLogEntry): DetailField[] {
    const newValues = this.parseStoredValues(log.new_values);
    const keys = Object.keys(newValues)
      .filter((key) => !HIDDEN_DETAIL_FIELDS.has(key))
      .sort();

    return keys
      .map((key) => {
        const value = this.formatFieldValue(newValues[key], key);
        return {
          key,
          label: this.formatFieldLabel(key),
          value,
        };
      })
      .filter((field) => this.isMeaningfulFormattedValue(field.value));
  }

  getDeletionFields(log: AuditLogEntry): DetailField[] {
    const oldValues = this.parseStoredValues(log.old_values);
    const keys = Object.keys(oldValues)
      .filter((key) => !HIDDEN_DETAIL_FIELDS.has(key))
      .sort();

    return keys
      .map((key) => {
        const value = this.formatFieldValue(oldValues[key], key);
        return {
          key,
          label: this.formatFieldLabel(key),
          value,
        };
      })
      .filter((field) => this.isMeaningfulFormattedValue(field.value));
  }

  getUpdateFields(log: AuditLogEntry): UpdateDetailField[] {
    const oldValues = this.parseStoredValues(log.old_values);
    const newValues = this.parseStoredValues(log.new_values);
    const keys = this.getVisibleKeys(oldValues, newValues);

    return keys
      .map((key) => {
        const beforeValue = this.formatFieldValue(oldValues[key], key);
        const afterValue = this.formatFieldValue(newValues[key], key);

        return {
          key,
          label: this.formatFieldLabel(key),
          beforeValue,
          afterValue,
        };
      })
      .filter((field) => {
        const meaningfulBefore = this.isMeaningfulFormattedValue(field.beforeValue);
        const meaningfulAfter = this.isMeaningfulFormattedValue(field.afterValue);

        if (!meaningfulBefore && !meaningfulAfter) {
          return false;
        }

        return field.beforeValue !== field.afterValue;
      });
  }

  getDetailFields(log: AuditLogEntry): DetailField[] {
    if (log.action === 'INSERT') {
      return this.getCreationFields(log);
    }

    if (log.action === 'DELETE') {
      return this.getDeletionFields(log);
    }

    return this.getUpdateFields(log).map((field) => ({
      key: field.key,
      label: field.label,
      value: field.afterValue,
    }));
  }

  getDetailHeading(log: AuditLogEntry): string {
    if (log.action === 'INSERT') {
      return 'What Was Created';
    }

    if (log.action === 'DELETE') {
      return 'What Was Removed';
    }

    return 'What Was Edited';
  }

  getChangeSummary(log: AuditLogEntry): string {
    const itemName = this.getFriendlyTableName(log.table_name);

    if (log.action === 'INSERT') {
      const fieldCount = this.getCreationFields(log).length;
      return `Created ${itemName} with ${fieldCount} detail${fieldCount === 1 ? '' : 's'}.`;
    }

    if (log.action === 'DELETE') {
      const fieldCount = this.getDeletionFields(log).length;
      return `Removed ${itemName}. ${fieldCount} detail${fieldCount === 1 ? '' : 's'} were captured.`;
    }

    const fieldCount = this.getUpdateFields(log).length;
    return fieldCount > 0
      ? `Edited ${itemName} and changed ${fieldCount} detail${fieldCount === 1 ? '' : 's'}.`
      : `Edited ${itemName} with no visible detail changes.`;
  }

  hasDetails(log: AuditLogEntry): boolean {
    return this.getDetailFields(log).length > 0;
  }

  private getSortTimestamp(dateStr: string): number {
    const time = new Date(dateStr).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  private matchesActionFilter(log: AuditLogEntry): boolean {
    if (this.filterActionType === 'ALL') {
      return true;
    }

    return this.getNormalizedActionType(log) === this.filterActionType;
  }

  private matchesModuleFilter(log: AuditLogEntry): boolean {
    if (this.filterModule === 'ALL') {
      return true;
    }

    return this.getModuleType(log) === this.filterModule;
  }

  clearAdvancedFilters(): void {
    this.sortOrder = 'newest';
    this.filterActionType = 'ALL';
    this.filterModule = 'ALL';
  }

  get filteredLogs(): AuditLogEntry[] {
    return this.logs.filter((log) => {
      return this.matchesActionFilter(log) && this.matchesModuleFilter(log);
    });
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.perPage);
  }

  get startRecord(): number {
    return (this.currentPage - 1) * this.perPage + 1;
  }

  get endRecord(): number {
    return Math.min(this.currentPage * this.perPage, this.total);
  }

  get hasAnyLogs(): boolean {
    return this.filteredLogs.length > 0;
  }

  getExpandedLog(): AuditLogEntry | undefined {
    return this.logs.find((log) => log.log_id === this.expandedLogId);
  }
}
