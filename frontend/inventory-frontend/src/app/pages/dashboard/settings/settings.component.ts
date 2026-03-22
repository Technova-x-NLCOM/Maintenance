import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MaintenanceService } from '../../../services/maintenance.service';
import { ToastService } from '../../../services/toast.service';
import { TopbarActionService } from '../../../services/topbar-action.service';

interface SystemSetting {
  setting_id: number;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_by: number | null;
  updated_at: string;
}

interface SettingField {
  key: string;
  label: string;
  hint: string;
  type: 'number' | 'boolean';
  value: string | number | boolean;
  setting_id?: number;
  dirty?: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  settings: SystemSetting[] = [];
  fields: SettingField[] = [
    {
      key: 'expiry_alert_days',
      label: 'Expiry Alert Days',
      hint: 'Alert when item will expire within this many days',
      type: 'number',
      value: 30
    },
    {
      key: 'low_stock_threshold',
      label: 'Low Stock Threshold (%)',
      hint: 'Show warning when qty falls below this % of reorder level',
      type: 'number',
      value: 20
    },
    {
      key: 'require_approval_out_transactions',
      label: 'Require Approval for OUT Transactions',
      hint: 'OUT transactions must be approved by an Admin before processing',
      type: 'boolean',
      value: true
    },
    {
      key: 'require_approval_transfer_transactions',
      label: 'Require Approval for TRANSFER Transactions',
      hint: 'Transfer transactions must be approved by an Admin',
      type: 'boolean',
      value: false
    },
    {
      key: 'auto_create_monthly_snapshots',
      label: 'Auto-create Monthly Snapshots',
      hint: 'Automatically save inventory snapshot on the 1st of each month',
      type: 'boolean',
      value: true
    }
  ];

  loading = false;
  error: string | null = null;
  saving = false;

  constructor(
    private maintenanceService: MaintenanceService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private topbarAction: TopbarActionService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.topbarAction.setPrintHandler(() => window.print());
  }

  ngOnDestroy(): void {
    this.topbarAction.setPrintHandler(null);
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    this.maintenanceService.listRows('system_settings', { page: 1, perPage: 200 }).pipe(
      catchError((err) => {
        this.error = err?.error?.message || 'Failed to load settings.';
        return of({ data: [] });
      })
    ).subscribe({
      next: (response: any) => {
        this.settings = Array.isArray(response?.data) ? response.data : [];
        this.mapFieldsFromSettings();
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveSettings(): void {
    if (this.saving) {
      return;
    }

    const changed = this.fields.filter(field => field.dirty);
    if (!changed.length) {
      this.toastService.info('No changes to save.');
      return;
    }

    this.saving = true;

    const requests = changed.map(field => {
      const value = field.type === 'boolean' ? (field.value ? '1' : '0') : String(field.value ?? '');

      if (field.setting_id) {
        return this.maintenanceService.updateRow('system_settings', field.setting_id, {
          setting_value: value
        });
      }

      return this.maintenanceService.createRow('system_settings', {
        setting_key: field.key,
        setting_value: value,
        description: field.hint
      });
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.saving = false;
        this.toastService.success('Settings saved successfully.');
        this.fields.forEach(field => {
          field.dirty = false;
        });
        this.loadSettings();
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message || 'Failed to save settings.');
      }
    });
  }

  onNumberChange(field: SettingField, value: string): void {
    field.value = Number(value || 0);
    field.dirty = true;
  }

  onToggleChange(field: SettingField): void {
    field.value = !Boolean(field.value);
    field.dirty = true;
  }

  get alertsFields(): SettingField[] {
    return this.fields.filter(field => field.key.includes('expiry') || field.key.includes('stock'));
  }

  get approvalFields(): SettingField[] {
    return this.fields.filter(field => field.key.includes('approval'));
  }

  get snapshotFields(): SettingField[] {
    return this.fields.filter(field => field.key.includes('snapshot'));
  }

  private mapFieldsFromSettings(): void {
    const byKey = new Map<string, SystemSetting>();
    this.settings.forEach(setting => {
      byKey.set(String(setting.setting_key || '').toLowerCase(), setting);
    });

    this.fields = this.fields.map(field => {
      const setting = byKey.get(field.key);
      if (!setting) {
        return { ...field, setting_id: undefined, dirty: false };
      }

      const raw = String(setting.setting_value ?? '');
      const value = field.type === 'boolean'
        ? raw.toLowerCase() === '1' || raw.toLowerCase() === 'true'
        : Number(raw || 0);

      return {
        ...field,
        setting_id: setting.setting_id,
        value,
        dirty: false
      };
    });
  }
}
