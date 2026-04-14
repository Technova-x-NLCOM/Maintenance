import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

export interface AuditLogEntry {
  log_id: number;
  table_name: string;
  record_id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_values?: any;
  new_values?: any;
  performed_by: number;
  performed_by_name?: string;
  ip_address: string;
  created_at: string;
}

interface DetailField {
  key: string;
  label: string;
  afterValue: string;
}

const HIDDEN_DETAIL_FIELDS = new Set([
  'batch_id',
  'batch_value',
  'manufactured_date',
  'qr_payload',
  'qr_label',
  'supplier_info',
]);

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

  private readonly API_URL = 'http://127.0.0.1:8000/api/maintenance/audit_log/rows';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    });
  }

  loadLogs(): void {
    this.loading = true;
    this.error = '';

    const params = new URLSearchParams();
    params.set('page', this.currentPage.toString());
    params.set('perPage', this.perPage.toString());
    if (this.search) {
      params.set('search', this.search);
    }

    this.http
      .get<{ data: AuditLogEntry[]; page: number; perPage: number; total: number }>(
        `${this.API_URL}?${params.toString()}`,
        { headers: this.getAuthHeaders() },
      )
      .subscribe({
        next: (response) => {
          this.logs = response.data;
          this.currentPage = response.page;
          this.perPage = response.perPage;
          this.total = response.total;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
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

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'INSERT':
        return 'badge-insert';
      case 'UPDATE':
        return 'badge-update';
      case 'DELETE':
        return 'badge-delete';
      default:
        return 'badge-default';
    }
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'INSERT':
        return 'Created';
      case 'UPDATE':
        return 'Updated';
      case 'DELETE':
        return 'Deleted';
      default:
        return action;
    }
  }

  formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString();
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
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  formatFieldValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'Not set';
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

  getDetailFields(log: AuditLogEntry): DetailField[] {
    const oldValues = this.parseStoredValues(log.old_values);
    const newValues = this.parseStoredValues(log.new_values);

    const keys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]))
      .filter((key) => !HIDDEN_DETAIL_FIELDS.has(key))
      .sort();

    return keys.map((key) => ({
      key,
      label: this.formatFieldLabel(key),
      afterValue: this.formatFieldValue(newValues[key]),
    }));
  }

  getChangeSummary(log: AuditLogEntry): string {
    const oldValues = this.parseStoredValues(log.old_values);
    const newValues = this.parseStoredValues(log.new_values);
    const oldCount = Object.keys(oldValues).filter((key) => !HIDDEN_DETAIL_FIELDS.has(key)).length;
    const newCount = Object.keys(newValues).filter((key) => !HIDDEN_DETAIL_FIELDS.has(key)).length;

    if (log.action === 'INSERT') {
      return `Created with ${newCount} visible field${newCount === 1 ? '' : 's'}`;
    }

    if (log.action === 'DELETE') {
      return `Removed ${oldCount} visible field${oldCount === 1 ? '' : 's'} of data`;
    }

    const fieldCount = this.getDetailFields(log).length;
    return fieldCount > 0
      ? `Updated ${fieldCount} visible field${fieldCount === 1 ? '' : 's'}`
      : 'No visible field changes';
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

  getExpandedLog(): AuditLogEntry | undefined {
    return this.logs.find((log) => log.log_id === this.expandedLogId);
  }
}
