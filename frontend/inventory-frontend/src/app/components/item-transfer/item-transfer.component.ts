import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../../shared/toast/toast.component';
import { getApiBaseUrl } from '../../services/api-base';

interface LocationStockRow {
  location_id: number;
  location_code: string;
  location_name: string;
  stock: number;
}

interface TransferItem {
  item_id: number;
  item_code: string;
  item_description: string;
  category_name: string | null;
  measurement_unit: string | null;
  image_url: string | null;
  current_stock: number;
  locations: LocationStockRow[];
}

interface DestinationLocation {
  location_id: number;
  location_code: string;
  location_name: string;
  location_type: string | null;
}

@Component({
  selector: 'app-item-transfer',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './item-transfer.component.html',
  styleUrls: ['./item-transfer.component.scss'],
})
export class ItemTransferComponent implements OnInit {
  // Catalog
  items: TransferItem[] = [];
  categories: Array<{ category_id: number; category_name: string }> = [];
  destinations: DestinationLocation[] = [];

  currentPage = 1;
  lastPage = 1;
  perPage = 12;
  total = 0;
  searchQuery = '';
  selectedCategoryId: number | null = null;
  loading = false;

  // Modal
  showModal = false;
  selectedItem: TransferItem | null = null;
  fromLocationId: number | null = null;
  toLocationId: number | null = null;
  quantity = 1;
  reason = '';
  notes = '';
  saving = false;
  attemptedSubmit = false;

  private readonly BASE = `${getApiBaseUrl()}/inventory/transfer`;

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadItems(1);
    this.loadCategoryOptions();
    this.loadDestinations();
  }

  // ── Catalog ────────────────────────────────────────────────────────
  loadItems(page = 1): void {
    this.loading = true;
    let p = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(this.perPage));
    if (this.searchQuery.trim()) p = p.set('search', this.searchQuery.trim());
    if (this.selectedCategoryId) p = p.set('category_id', String(this.selectedCategoryId));

    this.http.get<any>(`${this.BASE}/items`, { headers: this.authHeaders(), params: p }).subscribe({
      next: (res) => {
        this.items       = res.data.data;
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

  loadCategoryOptions(): void {
    this.http.get<any>(`${getApiBaseUrl()}/inventory/items/options`, { headers: this.authHeaders() }).subscribe({
      next: (res) => { this.categories = res.data.categories ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  loadDestinations(): void {
    this.http.get<any>(`${this.BASE}/destinations`, { headers: this.authHeaders() }).subscribe({
      next: (res) => { this.destinations = res.data ?? []; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  onSearch(): void { this.loadItems(1); }
  clearSearch(): void { this.searchQuery = ''; this.loadItems(1); }
  onFilterChange(): void { this.loadItems(1); }
  previousPage(): void { if (this.currentPage > 1) this.loadItems(this.currentPage - 1); }
  nextPage(): void { if (this.currentPage < this.lastPage) this.loadItems(this.currentPage + 1); }
  goToItemRegistration(): void { this.router.navigate(['/dashboard/inventory/items']); }

  // ── Modal ──────────────────────────────────────────────────────────
  openModal(item: TransferItem): void {
    this.selectedItem     = item;
    this.fromLocationId   = item.locations[0]?.location_id ?? null;
    this.toLocationId     = null;
    this.quantity         = 1;
    this.reason           = '';
    this.notes            = '';
    this.attemptedSubmit  = false;
    this.showModal        = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.showModal = false;
    this.attemptedSubmit = false;
  }

  get fromLocation(): LocationStockRow | null {
    return this.selectedItem?.locations.find(l => l.location_id === this.fromLocationId) ?? null;
  }

  get availableStock(): number {
    return this.fromLocation?.stock ?? 0;
  }

  /** Destination list excludes the selected from-location */
  get filteredDestinations(): DestinationLocation[] {
    return this.destinations.filter(d => d.location_id !== this.fromLocationId);
  }

  canSubmit(): boolean {
    if (!this.selectedItem || this.saving) return false;
    if (!this.fromLocationId) return false;
    if (!this.toLocationId)   return false;
    if (this.fromLocationId === this.toLocationId) return false;
    const qty = Math.floor(this.quantity);
    if (!qty || qty < 1) return false;
    if (qty > this.availableStock) return false;
    return true;
  }

  submit(): void {
    this.attemptedSubmit = true;
    if (!this.selectedItem || !this.canSubmit()) {
      this.toast.error('Please fill in all required fields correctly.');
      return;
    }

    this.saving = true;
    const payload = {
      item_id:          this.selectedItem.item_id,
      from_location_id: this.fromLocationId,
      to_location_id:   this.toLocationId,
      quantity:         Math.floor(this.quantity),
      reason:           this.reason.trim() || undefined,
      notes:            this.notes.trim() || undefined,
    };

    this.http.post<any>(`${this.BASE}/create`, payload, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.saving = false;
        this.toast.success(
          `Transfer recorded. Ref: ${res.data.reference_number}. Qty: ${res.data.transferred_quantity}.`
        );
        this.showModal = false;
        this.loadItems(this.currentPage);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to record transfer.');
        this.cdr.detectChanges();
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.showModal && !this.saving) this.closeModal(); }

  getDestinationName(locationId: number | null): string {
    if (!locationId) return '';
    return this.filteredDestinations.find(d => d.location_id === locationId)?.location_name ?? '';
  }

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
