import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryItemService } from '../../../services/inventory-item.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { StorageInventoryLocation, StorageInventoryResponse } from '../monitoring.models';

@Component({
  selector: 'app-storage-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './storage-inventory.component.html',
  styleUrls: ['./storage-inventory.component.scss'],
})
export class StorageInventoryComponent implements OnInit {
  locations: StorageInventoryLocation[] = [];
  loading = false;
  error = '';
  searchTerm = '';
  showLowStockOnly = false;
  expandedLocations = new Set<string>();
  openDropdownKey: string | null = null;

  constructor(
    private inventoryService: InventoryItemService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';

    this.inventoryService.getStorageInventory().subscribe({
      next: (response: StorageInventoryResponse) => {
        this.locations = response.data.locations || [];
        // default to collapsed on load — user can expand manually
        this.expandedLocations = new Set<string>();
        this.openDropdownKey = null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load storage inventory.';
        this.toast.error(this.error);
        this.cdr.detectChanges();
      },
    });
  }

  refresh(): void {
    this.loadData();
  }

  get filteredLocations(): StorageInventoryLocation[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.locations.filter((location) => {
      const locationMatches =
        !query ||
        [location.location_code, location.location_name, location.location_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const itemMatches =
        !query ||
        location.items.some((item) =>
          [item.item_code, item.item_description, item.category_name, item.item_type_name]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query)),
        );

      const lowStockMatches = !this.showLowStockOnly || location.low_stock_count > 0;
      return lowStockMatches && (locationMatches || itemMatches);
    });
  }

  get totalLocations(): number {
    return this.locations.length;
  }

  get totalItems(): number {
    return this.locations.reduce((total, location) => total + location.item_count, 0);
  }

  get totalStock(): number {
    return this.locations.reduce((total, location) => total + location.total_stock, 0);
  }

  get lowStockLocations(): number {
    return this.locations.filter((location) => location.low_stock_count > 0).length;
  }

  toggleLocation(location: StorageInventoryLocation): void {
    const key = this.locationKey(location);
    if (this.expandedLocations.has(key)) {
      this.expandedLocations.delete(key);
    } else {
      this.expandedLocations.add(key);
    }
  }

  isExpanded(location: StorageInventoryLocation): boolean {
    return this.expandedLocations.has(this.locationKey(location));
  }

  expandAll(): void {
    this.expandedLocations = new Set(this.locations.map((location) => this.locationKey(location)));
  }

  collapseAll(): void {
    this.expandedLocations.clear();
  }

  public locationKey(location: StorageInventoryLocation): string {
    return location.location_id !== null && location.location_id !== undefined
      ? String(location.location_id)
      : `unassigned-${location.location_name}`;
  }

  onPillClick(location: StorageInventoryLocation, event: MouseEvent): void {
    event.stopPropagation();
    if ((location.item_count ?? location.items?.length ?? 0) < 10) {
      this.toggleLocation(location);
      this.openDropdownKey = null;
    } else {
      const key = this.locationKey(location);
      this.openDropdownKey = this.openDropdownKey === key ? null : key;
    }
  }

  isDropdownOpen(location: StorageInventoryLocation): boolean {
    return this.openDropdownKey === this.locationKey(location);
  }

  trackByLocation(index: number, location: StorageInventoryLocation): string {
    return this.locationKey(location);
  }

  trackByItem(index: number, item: { item_id: number }): number {
    return item.item_id;
  }
}
