import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../../services/auth.service';
import { RbacService, Role } from '../../../rbac/services/rbac.service';
import { BackupComponent } from '../backup/backup.component';

interface SystemSetting {
  setting_id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_by: number | null;
  updated_at: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, BackupComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  user: User | null = null;
  currentRole: Role | null = null;
  loadingRole = false;

  settings: SystemSetting[] = [];
  loading = false;
  error: string | null = null;
  editingKey: string | null = null;
  editValue: string = '';
  saving = false;
  saveError: string | null = null;
  saveSuccess: string | null = null;

  private readonly API_URL = 'http://127.0.0.1:8000/api/settings';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private rbacService: RbacService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((current) => {
      this.user = current;
      if (current) {
        this.loadCurrentRole();
      } else {
        this.currentRole = null;
        this.cdr.detectChanges();
      }
    });
    this.loadSettings();
  }

  hasPermission(permissionName: string): boolean {
    if (this.loadingRole) return false;
    if (this.user?.role === 'super_admin') return true;
    return this.rbacService.roleHasPermission(this.currentRole, permissionName);
  }

  private loadCurrentRole(): void {
    this.loadingRole = true;
    this.rbacService.getCurrentRole().subscribe({
      next: (role) => {
        this.currentRole = role;
        this.loadingRole = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.currentRole = null;
        this.loadingRole = false;
        this.cdr.detectChanges();
      }
    });
  }

  private authHeaders(includeJsonBody = false): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      Accept: 'application/json'
    });
    if (includeJsonBody) {
      headers = headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;
    this.http.get<unknown>(this.API_URL, { headers: this.authHeaders(false) }).subscribe({
      next: (data) => {
        this.settings = this.normalizeSettings(data);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.error = this.extractHttpError(err, 'Failed to load settings.');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startEdit(setting: SystemSetting): void {
    this.editingKey = setting.setting_key;
    this.editValue = setting.setting_value;
    this.saveError = null;
    this.saveSuccess = null;
  }

  cancelEdit(): void {
    this.editingKey = null;
    this.editValue = '';
    this.saveError = null;
  }

  save(setting: SystemSetting): void {
    if (this.saving) return;
    this.saving = true;
    this.saveError = null;
    this.saveSuccess = null;
    this.http
      .put<SystemSetting>(`${this.API_URL}/${setting.setting_key}`, { setting_value: this.editValue }, { headers: this.authHeaders(true) })
      .subscribe({
        next: (updated) => {
          const row = this.normalizeSettingRow(updated);
          const idx = this.settings.findIndex(s => s.setting_key === setting.setting_key);
          if (idx !== -1) this.settings[idx] = row;
          this.editingKey = null;
          this.editValue = '';
          this.saving = false;
          this.saveSuccess = `"${this.formatKey(setting.setting_key)}" updated successfully.`;
          setTimeout(() => { this.saveSuccess = null; this.cdr.detectChanges(); }, 3000);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.saveError = this.extractHttpError(err, 'Failed to save setting.');
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
  }

  formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private normalizeSettings(data: unknown): SystemSetting[] {
    if (Array.isArray(data)) {
      return data.map((row) => this.normalizeSettingRow(row));
    }

    const asRecord = data as { data?: unknown } | null;
    if (asRecord && Array.isArray(asRecord.data)) {
      return asRecord.data.map((row) => this.normalizeSettingRow(row));
    }

    return [];
  }

  private normalizeSettingRow(row: unknown): SystemSetting {
    const r = row as Record<string, unknown>;
    return {
      setting_id: Number(r['setting_id'] ?? 0),
      setting_key: String(r['setting_key'] ?? ''),
      setting_value: r['setting_value'] != null ? String(r['setting_value']) : '',
      description: r['description'] != null ? String(r['description']) : null,
      updated_by: r['updated_by'] != null ? Number(r['updated_by']) : null,
      updated_at: String(r['updated_at'] ?? '')
    };
  }

  private extractHttpError(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; errors?: Record<string, string[]> } | string | null;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object') {
      if (body.message) {
        return body.message;
      }
      const first = body.errors ? Object.values(body.errors)[0]?.[0] : null;
      if (first) {
        return first;
      }
    }
    return err.message || fallback;
  }
}
