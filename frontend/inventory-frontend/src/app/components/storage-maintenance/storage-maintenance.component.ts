import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../../shared/toast/toast.component';
import { getApiBaseUrl } from '../../services/api-base';

type MaintenanceStatus = 'pending' | 'active' | 'restoring' | 'completed' | 'cancelled';

interface LocationOption {
  location_id: number;
  location_code: string;
  location_name: string;
  display_name: string;
}

interface PreviewItem {
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  stock: number;
}

interface TrackedBatch {
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  original_quantity: number;
  current_quantity: number;
  consumed: number;
  batch_status: string;
}

interface MaintenanceRecord {
  maintenance_id: number;
  title: string;
  reason: string | null;
  status: MaintenanceStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  moved_out_quantity: number;
  moved_back_quantity: number;
  notes: string | null;
  location_id: number;
  location_name: string;
  location_code: string;
  temp_location_id: number;
  temp_location_name: string;
  temp_location_code: string;
  performed_by_name: string;
  created_at: string;
  preview_items?: PreviewItem[];
  tracked_batches?: TrackedBatch[];
}

@Component({
  selector: 'app-storage-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  providers: [DatePipe],
  templateUrl: './storage-maintenance.component.html',
  styleUrls: ['./storage-maintenance.component.scss'],
})
export class StorageMaintenanceComponent implements OnInit {
  records: MaintenanceRecord[] = [];
  locations: LocationOption[] = [];

  page = 1;
  lastPage = 1;
  total = 0;
  perPage = 15;
  search = '';
  filterStatus = '';
  filterLocationId: number | null = null;
  loading = false;

  // Create modal
  showCreateModal = false;
  form = { location_id: null as number | null, temp_location_id: null as number | null,
           title: '', reason: '', scheduled_start: '', scheduled_end: '', notes: '' };
  saving = false;
  attemptedSave = false;

  // Detail modal
  showDetailModal = false;
  detailRecord: MaintenanceRecord | null = null;
  detailLoading = false;
  actionSaving = false;
  confirmAction: 'start' | 'restore' | 'cancel' | null = null;

  private readonly BASE = `${getApiBaseUrl()}/inventory/storage-maintenance`;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private datePipe: DatePipe,
  ) {}

  ngOnInit(): void {
    this.load(1);
    this.loadLocations();
  }

  // ── List ────────────────────────────────────────────────────────────────
  load(page = 1): void {
    this.loading = true;
    let p = new HttpParams().set('page', String(page)).set('per_page', String(this.perPage));
    if (this.search.trim())    p = p.set('search', this.search.trim());
    if (this.filterStatus)     p = p.set('status', this.filterStatus);
    if (this.filterLocationId) p = p.set('location_id', String(this.filterLocationId));

    this.http.get<any>(this.BASE, { headers: this.auth(), params: p }).subscribe({
      next: (res) => {
        this.records  = res.data.data;
        this.page     = res.data.current_page;
        this.lastPage = res.data.last_page;
        this.total    = res.data.total;
        this.loading  = false;
        this.cdr.detectChanges();
      },
      error: () => { this.toast.error('Failed to load records.'); this.loading = false; this.cdr.detectChanges(); },
    });
  }

  apply(): void { this.load(1); }
  clear(): void { this.search = ''; this.filterStatus = ''; this.filterLocationId = null; this.load(1); }
  previousPage(): void { if (this.page > 1) this.load(this.page - 1); }
  nextPage(): void     { if (this.page < this.lastPage) this.load(this.page + 1); }

  loadLocations(): void {
    this.http.get<any>(`${getApiBaseUrl()}/inventory/locations/options`, { headers: this.auth() }).subscribe({
      next: (res) => { this.locations = res.data ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  // ── Create modal ────────────────────────────────────────────────────────
  openCreate(): void {
    this.form = { location_id: null, temp_location_id: null, title: '', reason: '', scheduled_start: '', scheduled_end: '', notes: '' };
    this.attemptedSave = false;
    this.showCreateModal = true;
  }

  closeCreate(): void { if (this.saving) return; this.showCreateModal = false; }

  get tempLocationOptions(): LocationOption[] {
    return this.locations.filter(l => l.location_id !== this.form.location_id);
  }

  canSave(): boolean {
    return !!this.form.location_id && !!this.form.temp_location_id
        && this.form.location_id !== this.form.temp_location_id
        && this.form.title.trim().length > 0;
  }

  submitCreate(): void {
    this.attemptedSave = true;
    if (!this.canSave()) return;
    this.saving = true;
    const payload = {
      location_id:      this.form.location_id,
      temp_location_id: this.form.temp_location_id,
      title:            this.form.title.trim(),
      reason:           this.form.reason.trim() || undefined,
      scheduled_start:  this.form.scheduled_start || undefined,
      scheduled_end:    this.form.scheduled_end   || undefined,
      notes:            this.form.notes.trim()    || undefined,
    };
    this.http.post<any>(this.BASE, payload, { headers: this.auth() }).subscribe({
      next: (res) => {
        this.saving = false;
        this.toast.success('Maintenance scheduled.');
        this.showCreateModal = false;
        this.load(1);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to create maintenance.');
        this.cdr.detectChanges();
      },
    });
  }

  // ── Detail modal ────────────────────────────────────────────────────────
  openDetail(record: MaintenanceRecord): void {
    this.detailRecord  = record;
    this.showDetailModal = true;
    this.confirmAction = null;
    this.detailLoading = true;

    this.http.get<any>(`${this.BASE}/${record.maintenance_id}`, { headers: this.auth() }).subscribe({
      next: (res) => {
        this.detailRecord  = res.data;
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.detailLoading = false; this.cdr.detectChanges(); },
    });
  }

  closeDetail(): void { if (this.actionSaving) return; this.showDetailModal = false; this.confirmAction = null; }

  setConfirm(action: 'start' | 'restore' | 'cancel'): void { this.confirmAction = action; }
  cancelConfirm(): void { this.confirmAction = null; }

  runAction(): void {
    if (!this.detailRecord || !this.confirmAction) return;
    const id     = this.detailRecord.maintenance_id;
    const action = this.confirmAction;
    this.actionSaving = true;
    this.confirmAction = null;

    this.http.post<any>(`${this.BASE}/${id}/${action}`, {}, { headers: this.auth() }).subscribe({
      next: (res) => {
        this.actionSaving = false;
        this.toast.success(res.message);
        this.showDetailModal = false;
        this.load(this.page);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.actionSaving = false;
        this.toast.error(err?.error?.message || `Failed to ${action} maintenance.`);
        this.cdr.detectChanges();
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  statusLabel(s: MaintenanceStatus): string {
    return { pending: 'Pending', active: 'Active', restoring: 'Restoring', completed: 'Completed', cancelled: 'Cancelled' }[s] ?? s;
  }

  consumed(r: MaintenanceRecord): number {
    return Math.max(0, r.moved_out_quantity - r.moved_back_quantity);
  }

  get locationName(): string {
    return this.locations.find(l => l.location_id === this.form.location_id)?.location_name ?? '';
  }

  get tempLocationName(): string {
    return this.locations.find(l => l.location_id === this.form.temp_location_id)?.location_name ?? '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmAction) { this.confirmAction = null; return; }
    if (this.showDetailModal && !this.actionSaving) { this.closeDetail(); return; }
    if (this.showCreateModal && !this.saving) { this.closeCreate(); }
  }

  private auth(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }
}
