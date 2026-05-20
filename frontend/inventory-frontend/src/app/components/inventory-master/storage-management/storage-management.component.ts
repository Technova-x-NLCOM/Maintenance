import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../services/maintenance.service';
import { InventoryItemService } from '../../../services/inventory-item.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { StorageInventoryItem } from '../../monitoring/monitoring.models';

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
  selector: 'app-storage-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './storage-management.component.html',
  styleUrls: ['./storage-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageManagementComponent implements OnInit {
  // ===== SHARED STATE =====
  loading = false;
  error = '';

  // ===== LOCATIONS (CRUD) STATE =====
  locationRows: LocationRow[] = [];
  locationSearchTerm = '';
  showLocationForm = false;
  editingLocationId: number | null = null;
  locationForm: {
    location_code: string;
    location_name: string;
    location_type: string;
    description: string;
    is_active: boolean;
  } = { location_code: '', location_name: '', location_type: '', description: '', is_active: true };
  savingLocation = false;

  // ===== DRAWER STATE =====
  isDrawerOpen = false;
  selectedLocation: LocationRow | null = null;
  drawerInventoryItems: StorageInventoryItem[] = [];
  showLowStockOnly: boolean = false;
  isLoadingInventory: boolean = false;

  // ===== PAGINATION STATE =====
  currentPage = 1;
  itemsPerPage = 10;
  pageSizeOptions = [5, 10, 25, 50, 100];

  constructor(
    private maintenanceService: MaintenanceService,
    private inventoryItemService: InventoryItemService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadLocationsMasterData();
  }

  // ===== ESCAPE KEY LISTENER =====
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.isDrawerOpen) {
      this.closeDrawer();
    }
  }

  // ===== DATA LOADING =====

  loadLocationsMasterData(): void {
    this.loading = true;
    this.maintenanceService.listRows('locations', { perPage: 500 }).subscribe({
      next: (res) => {
        this.locationRows = res.data || [];
        this.loading = false;
        this.resetPagination();
        if (this.showLocationForm && !this.editingLocationId && !this.locationForm.location_code) {
          this.locationForm.location_code = this.getSuggestedLocationCode();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load locations.';
        this.cdr.markForCheck();
      },
    });
  }

  // ===== KPI CALCULATIONS =====

  get registeredLocations(): number {
    return this.locationRows.length;
  }

  get activeStoragePoints(): number {
    return this.locationRows.filter((loc) => loc.is_active).length;
  }

  get totalItemsTracked(): number {
    // Placeholder - will be calculated from expanded inventory data later
    return 0;
  }

  get lowStockAlerts(): number {
    // Placeholder - will be calculated from expanded inventory data later
    return 0;
  }

  // ===== LOCATIONS TABLE =====

  get displayedLocationRows(): LocationRow[] {
    const term = (this.locationSearchTerm || '').trim().toLowerCase();
    if (!term) return this.locationRows;
    return this.locationRows.filter(
      (r) =>
        (r.location_name || '').toLowerCase().includes(term) ||
        (r.location_code || '').toLowerCase().includes(term),
    );
  }

  // ===== PAGINATION =====

  get totalLocations(): number {
    return this.displayedLocationRows.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalLocations / this.itemsPerPage) || 1;
  }

  get startIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage;
  }

  get endIndex(): number {
    return Math.min(this.startIndex + this.itemsPerPage, this.totalLocations);
  }

  get paginatedLocationRows(): LocationRow[] {
    return this.displayedLocationRows.slice(this.startIndex, this.endIndex);
  }

  firstPage(): void {
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.markForCheck();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.cdr.markForCheck();
    }
  }

  lastPage(): void {
    this.currentPage = this.totalPages;
    this.cdr.markForCheck();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.cdr.markForCheck();
  }

  private resetPagination(): void {
    this.currentPage = 1;
  }

  private getSuggestedLocationCode(): string {
    const codes = this.locationRows
      .map((row) => row.location_code || '')
      .map((code) => {
        const match = code.toUpperCase().match(/LOCATION-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => Number.isFinite(num));
    const next = (codes.length ? Math.max(...codes) : 0) + 1;
    return 'LOCATION-' + String(next).padStart(3, '0');
  }

  startNewLocation(): void {
    this.editingLocationId = null;
    this.showLocationForm = true;
    this.locationForm = {
      location_code: this.getSuggestedLocationCode(),
      location_name: '',
      location_type: '',
      description: '',
      is_active: true,
    };
    this.cdr.markForCheck();
  }

  editLocation(row: LocationRow): void {
    this.editingLocationId = row.location_id;
    this.showLocationForm = true;
    this.locationForm = {
      location_code: row.location_code,
      location_name: row.location_name,
      location_type: row.location_type || '',
      description: row.description || '',
      is_active: !!row.is_active,
    };
    this.cdr.markForCheck();
  }

  closeLocationForm(): void {
    this.showLocationForm = false;
    this.editingLocationId = null;
    this.cdr.markForCheck();
  }

  saveLocation(): void {
    if (!this.locationForm.location_name.trim()) {
      this.toastService.error('Name is required.');
      return;
    }
    this.savingLocation = true;
    const payload: any = {
      location_name: this.locationForm.location_name.trim(),
      location_type: this.locationForm.location_type.trim() || null,
      description: this.locationForm.description.trim() || null,
      is_active: this.locationForm.is_active ? 1 : 0,
    };

    if (this.editingLocationId) {
      payload.location_code = this.locationForm.location_code.trim();
    }

    const call = this.editingLocationId
      ? this.maintenanceService.updateRow('locations', this.editingLocationId, payload)
      : this.maintenanceService.createRow('locations', payload);

    call.subscribe({
      next: (res: any) => {
        this.savingLocation = false;
        if (!this.editingLocationId) {
          this.toastService.success(
            res?.location_code ? `Location created: ${res.location_code}` : 'Location created.',
          );
        } else {
          this.toastService.success('Location updated.');
        }
        this.closeLocationForm();
        this.loadLocationsMasterData();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.savingLocation = false;
        this.toastService.error(err?.error?.message || 'Failed to save location.');
        this.cdr.markForCheck();
      },
    });
  }

  async deleteLocation(row: LocationRow): Promise<void> {
    const ok = confirm(`Delete location "${row.location_name}"?`);
    if (!ok) return;
    this.loading = true;
    this.maintenanceService.deleteRow('locations', row.location_id).subscribe({
      next: () => {
        this.toastService.success('Location deleted.');
        this.loadLocationsMasterData();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.toastService.error(err?.error?.message || 'Failed to delete.');
        this.cdr.markForCheck();
      },
    });
  }

  // ===== DRAWER MANAGEMENT =====

  openDrawer(location: LocationRow): void {
    this.selectedLocation = location;
    this.isDrawerOpen = true;
    this.showLowStockOnly = false;
    this.isLoadingInventory = true;
    this.drawerInventoryItems = [];
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
    
    this.cdr.markForCheck();

    // Load inventory for the selected location
    this.inventoryItemService
      .getStorageInventory({ location_id: location.location_id })
      .subscribe({
        next: (response) => {
          const locationData = response.data.locations[0];
          this.drawerInventoryItems = locationData?.items || [];
          this.isLoadingInventory = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoadingInventory = false;
          this.toastService.error('Failed to load inventory for this location.');
          this.cdr.markForCheck();
        },
      });
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
    this.selectedLocation = null;
    this.drawerInventoryItems = [];
    this.showLowStockOnly = false;
    
    // Restore body scrolling
    document.body.style.overflow = '';
    
    this.cdr.markForCheck();
  }

  get filteredInventoryItems(): StorageInventoryItem[] {
    if (!this.showLowStockOnly) {
      return this.drawerInventoryItems;
    }
    return this.drawerInventoryItems.filter((item) => item.is_low_stock);
  }

  trackByLocationRow(index: number, row: LocationRow): number {
    return row.location_id;
  }

  trackByInventoryItem(index: number, item: StorageInventoryItem): number {
    return item.item_id;
  }
}
