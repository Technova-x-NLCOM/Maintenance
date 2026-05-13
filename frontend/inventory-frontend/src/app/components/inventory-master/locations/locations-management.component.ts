import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../services/maintenance.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

interface LocationRow {
  location_id: number;
  location_code: string;
  location_name: string;
  location_type?: string | null;
  description?: string | null;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-locations-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './locations-management.component.html',
  styleUrls: ['./locations-management.component.scss'],
})
export class LocationsManagementComponent implements OnInit {
  rows: LocationRow[] = [];
  loading = false;
  saving = false;
  error = '';

  showForm = false;
  editingId: number | null = null;
  searchTerm = '';
  form: {
    location_code: string;
    location_name: string;
    location_type: string;
    description: string;
    is_active: boolean;
  } = { location_code: '', location_name: '', location_type: '', description: '', is_active: true };

  constructor(
    private maintenance: MaintenanceService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadRows();
  }

  loadRows(): void {
    this.loading = true;
    this.maintenance.listRows('locations', { perPage: 500 }).subscribe({
      next: (res) => {
        this.rows = res.data || [];
        this.loading = false;
        if (this.showForm && !this.editingId && !this.form.location_code) {
          this.form.location_code = this.getSuggestedLocationCode();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load locations.';
        this.cdr.detectChanges();
      }
    });
  }

  get displayedRows(): LocationRow[] {
    const term = (this.searchTerm || '').trim().toLowerCase();
    if (!term) return this.rows;
    return this.rows.filter(r => (r.location_name || '').toLowerCase().includes(term) || (r.location_code || '').toLowerCase().includes(term));
  }

  get totalLocations(): number {
    return this.rows.length;
  }

  get activeLocations(): number {
    return this.rows.filter(row => !!row.is_active).length;
  }

  get inactiveLocations(): number {
    return Math.max(0, this.rows.length - this.activeLocations);
  }

  private getSuggestedLocationCode(): string {
    const codes = this.rows
      .map(row => row.location_code || '')
      .map(code => {
        const match = code.toUpperCase().match(/LOCATION-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => Number.isFinite(num));
    const next = (codes.length ? Math.max(...codes) : 0) + 1;
    return 'LOCATION-' + String(next).padStart(3, '0');
  }

  startNew(): void {
    this.editingId = null;
    this.showForm = true;
    this.form = { location_code: this.getSuggestedLocationCode(), location_name: '', location_type: '', description: '', is_active: true };
  }

  edit(row: LocationRow): void {
    this.editingId = row.location_id;
    this.showForm = true;
    this.form = {
      location_code: row.location_code,
      location_name: row.location_name,
      location_type: row.location_type || '',
      description: row.description || '',
      is_active: !!row.is_active,
    };
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
  }

  save(): void {
    if (!this.form.location_name.trim()) {
      this.toast.error('Name is required.');
      return;
    }
    this.saving = true;
    const payload: any = {
      location_name: this.form.location_name.trim(),
      location_type: this.form.location_type.trim() || null,
      description: this.form.description.trim() || null,
      is_active: this.form.is_active ? 1 : 0,
    };

    if (this.editingId) {
      payload.location_code = this.form.location_code.trim();
    }

    const call = this.editingId ? this.maintenance.updateRow('locations', this.editingId, payload) : this.maintenance.createRow('locations', payload);

    call.subscribe({
      next: (res: any) => {
        this.saving = false;
        if (!this.editingId) {
          this.toast.success(res?.location_code ? `Location created: ${res.location_code}` : 'Location created.');
        } else {
          this.toast.success('Location updated.');
        }
        this.closeForm();
        this.loadRows();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to save location.');
        this.cdr.detectChanges();
      }
    });
  }

  async remove(row: LocationRow): Promise<void> {
    const ok = confirm(`Delete location "${row.location_name}"?`);
    if (!ok) return;
    this.loading = true;
    this.maintenance.deleteRow('locations', row.location_id).subscribe({
      next: () => {
        this.toast.success('Location deleted.');
        this.loadRows();
      },
      error: (err) => {
        this.loading = false;
        this.toast.error(err?.error?.message || 'Failed to delete.');
        this.cdr.detectChanges();
      }
    });
  }
}
