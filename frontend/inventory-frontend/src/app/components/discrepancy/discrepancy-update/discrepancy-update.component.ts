import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { getApiBaseUrl } from '../../../services/api-base';

export interface DiscrepancyItem {
  item_id: number;
  item_code: string;
  item_description: string;
  category_name: string | null;
  measurement_unit: string | null;
  image_url: string | null;
  location_id: number | null;
  location_name: string | null;
  location_code: string | null;
  recorded_stock: number;
}

/** One card per unique item — aggregates all locations */
export interface DiscrepancyItemCard {
  item_id: number;
  item_code: string;
  item_description: string;
  category_name: string | null;
  measurement_unit: string | null;
  image_url: string | null;
  total_stock: number;
  locations: Array<{
    location_id: number | null;
    location_name: string;
    location_code: string | null;
    recorded_stock: number;
  }>;
}

@Component({
  selector: 'app-discrepancy-update',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './discrepancy-update.component.html',
  styleUrls: ['./discrepancy-update.component.scss'],
})
export class DiscrepancyUpdateComponent implements OnInit {
  // Catalog
  items: DiscrepancyItemCard[] = [];
  categories: Array<{ category_id: number; category_name: string }> = [];
  locations: Array<{ location_id: number; location_name: string; location_code: string }> = [];

  currentPage = 1;
  lastPage = 1;
  perPage = 12;
  total = 0;
  searchQuery = '';
  selectedCategoryId: number | null = null;
  selectedLocationFilterId: number | null = null;
  loading = false;

  // Modal
  showModal = false;
  selectedItem: DiscrepancyItemCard | null = null;
  selectedLocationId: number | null = null;
  physicalCount = 0;
  reason = '';
  notes = '';
  saving = false;
  attemptedSubmit = false;

  private readonly BASE = `${getApiBaseUrl()}/inventory/discrepancy`;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadItems(1);
    this.loadCategoryOptions();
    this.loadLocationOptions();
  }

  // ── Catalog ────────────────────────────────────────────────────────
  loadItems(page = 1): void {
    this.loading = true;
    let p = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(this.perPage));
    if (this.searchQuery.trim())        p = p.set('search', this.searchQuery.trim());
    if (this.selectedCategoryId)        p = p.set('category_id', String(this.selectedCategoryId));
    if (this.selectedLocationFilterId)  p = p.set('location_id', String(this.selectedLocationFilterId));

    this.http.get<any>(`${this.BASE}/items`, { headers: this.authHeaders(), params: p }).subscribe({
      next: (res) => {
        this.items    = this.groupByItem(res.data.data as DiscrepancyItem[]);
        this.currentPage = res.data.current_page;
        this.lastPage    = res.data.last_page;
        this.total       = res.data.total;
        this.loading     = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toast.error('Failed to load items.');
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private groupByItem(rows: DiscrepancyItem[]): DiscrepancyItemCard[] {
    const map = new Map<number, DiscrepancyItemCard>();
    for (const row of rows) {
      if (!map.has(row.item_id)) {
        map.set(row.item_id, {
          item_id: row.item_id,
          item_code: row.item_code,
          item_description: row.item_description,
          category_name: row.category_name,
          measurement_unit: row.measurement_unit,
          image_url: row.image_url,
          total_stock: 0,
          locations: [],
        });
      }
      const card = map.get(row.item_id)!;
      card.total_stock += row.recorded_stock;
      card.locations.push({
        location_id:   row.location_id,
        location_name: row.location_name ?? 'Unassigned',
        location_code: row.location_code,
        recorded_stock: row.recorded_stock,
      });
    }
    return Array.from(map.values());
  }

  loadCategoryOptions(): void {
    this.http.get<any>(`${getApiBaseUrl()}/inventory/items/options`, { headers: this.authHeaders() }).subscribe({
      next: (res) => { this.categories = res.data.categories ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadLocationOptions(): void {
    this.http.get<any>(`${getApiBaseUrl()}/inventory/locations/options`, { headers: this.authHeaders() }).subscribe({
      next: (res) => { this.locations = res.data ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  onSearch(): void { this.loadItems(1); }
  clearSearch(): void { this.searchQuery = ''; this.loadItems(1); }
  onFilterChange(): void { this.loadItems(1); }

  previousPage(): void { if (this.currentPage > 1) this.loadItems(this.currentPage - 1); }
  nextPage(): void     { if (this.currentPage < this.lastPage) this.loadItems(this.currentPage + 1); }

  goToItemRegistration(): void { this.router.navigate(['/dashboard/inventory/items']); }

  // ── Modal ──────────────────────────────────────────────────────────
  openModal(item: DiscrepancyItemCard): void {
    this.selectedItem = item;
    // default to first location
    const first = item.locations[0];
    this.selectedLocationId = first?.location_id ?? null;
    this.physicalCount = first?.recorded_stock ?? 0;
    this.reason = '';
    this.notes  = '';
    this.attemptedSubmit = false;
    this.showModal = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.showModal = false;
    this.attemptedSubmit = false;
  }

  onLocationChange(): void {
    const loc = this.selectedItem?.locations.find(l => l.location_id === this.selectedLocationId);
    if (loc) this.physicalCount = loc.recorded_stock;
  }

  get selectedLocation() {
    return this.selectedItem?.locations.find(l => l.location_id === this.selectedLocationId) ?? null;
  }

  get variance(): number {
    return this.physicalCount - (this.selectedLocation?.recorded_stock ?? 0);
  }

  canSubmit(): boolean {
    if (!this.selectedItem || this.saving) return false;
    if (this.physicalCount < 0 || !Number.isFinite(this.physicalCount)) return false;
    if (this.variance === 0) return false;
    return this.reason.trim().length > 0;
  }

  submit(): void {
    this.attemptedSubmit = true;
    if (!this.selectedItem || !this.canSubmit()) {
      this.toast.error('Please fill in all required fields and ensure a variance exists.');
      return;
    }

    this.saving = true;
    const payload = {
      item_id:        this.selectedItem.item_id,
      location_id:    this.selectedLocationId,
      physical_count: Math.floor(this.physicalCount),
      reason:         this.reason.trim(),
      notes:          this.notes.trim() || undefined,
    };

    this.http.post<any>(`${this.BASE}/create`, payload, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.saving = false;
        const v = res.data.variance;
        this.toast.success(
          `Discrepancy recorded. Ref: ${res.data.reference_number}. Variance: ${v > 0 ? '+' : ''}${v}.`
        );
        this.showModal = false;
        this.loadItems(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to record discrepancy.');
        this.cdr.detectChanges();
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.showModal && !this.saving) this.closeModal(); }

  bounceModal(): void {
    const el = document.querySelector<HTMLElement>('.modal-box');
    if (!el) return;
    el.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(0.97)' }, { transform: 'scale(1.01)' }, { transform: 'scale(1)' }],
      { duration: 380, easing: 'ease' }
    );
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('access_token')}` });
  }
}
