import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  settings: SystemSetting[] = [];
  loading = false;
  error: string | null = null;
  editingKey: string | null = null;
  editValue: string = '';
  saving = false;
  saveError: string | null = null;
  saveSuccess: string | null = null;

  private readonly API_URL = 'http://127.0.0.1:8000/api/settings';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '' });
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;
    this.http.get<SystemSetting[]>(this.API_URL, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        this.settings = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load settings.';
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
      .put<SystemSetting>(`${this.API_URL}/${setting.setting_key}`, { setting_value: this.editValue }, { headers: this.authHeaders() })
      .subscribe({
        next: (updated) => {
          const idx = this.settings.findIndex(s => s.setting_key === setting.setting_key);
          if (idx !== -1) this.settings[idx] = updated;
          this.editingKey = null;
          this.editValue = '';
          this.saving = false;
          this.saveSuccess = `"${this.formatKey(setting.setting_key)}" updated successfully.`;
          setTimeout(() => { this.saveSuccess = null; this.cdr.detectChanges(); }, 3000);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.saveError = err?.error?.message || 'Failed to save setting.';
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
  }

  formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
