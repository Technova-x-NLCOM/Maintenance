import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AdjustmentItem,
  AdjustmentTransactionResponse,
  InventoryItemService,
  PaginatedAdjustmentItemsResponse
} from '../../services/inventory-item.service';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../../shared/toast/toast.component';

@Component({
  selector: 'app-stock-adjustment',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './stock-adjustment.component.html',
  styleUrls: ['./stock-adjustment.component.scss']
})
export class StockAdjustmentComponent implements OnInit {
  items: AdjustmentItem[] = [];
  categories: Array<{ category_id: number; category_name: string }> = [];

  currentPage = 1;
  lastPage = 1;
  perPage = 12;
  searchQuery = '';
  selectedCategoryId: number | null = null;

  selectedItem: AdjustmentItem | null = null;
  adjustmentMode: 'increase' | 'decrease' = 'decrease';
  quantity = 1;
  reason = '';
  notes = '';
  purchaseDate = '';
  expiryDate = '';
  expiryDateOverride = false;
  computedExpiryDate: string | null = null;
  manufacturedDate = '';
  confirmExpiration = false;

  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  showAdjustmentModal = false;

  constructor(
    private itemService: InventoryItemService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadItems(1);
    this.loadCategoryOptions();
  }

  loadCategoryOptions(): void {
    this.itemService.getOptions().subscribe({
      next: (options) => {
        this.categories = options.data.categories;
        this.cdr.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadItems(page: number = 1): void {
    this.loading = true;
    this.itemService
      .getAdjustmentItems({
        page,
        per_page: this.perPage,
        search: this.searchQuery || undefined,
        category_id: this.selectedCategoryId || undefined
      })
      .subscribe({
        next: (response: PaginatedAdjustmentItemsResponse) => {
          this.items = response.data.data;
          this.currentPage = response.data.current_page;
          this.lastPage = response.data.last_page;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.loading = false;
          this.errorMessage = err?.error?.message || 'Failed to load adjustable items.';
          this.cdr.detectChanges();
        }
      });
  }

  onSearch(): void {
    this.loadItems(1);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.loadItems(1);
  }

  onCategoryChange(): void {
    this.loadItems(1);
  }

  openAdjustmentModal(item: AdjustmentItem): void {
    this.selectedItem = item;
    this.adjustmentMode = 'decrease';
    this.quantity = 1;
    this.reason = '';
    this.notes = '';
    this.purchaseDate = new Date().toISOString().split('T')[0];
    this.expiryDate = '';
    this.expiryDateOverride = false;
    this.computedExpiryDate = null;
    this.manufacturedDate = '';
    this.confirmExpiration = false;
    this.errorMessage = '';
    this.showAdjustmentModal = true;
  }

  closeAdjustmentModal(): void {
    this.showAdjustmentModal = false;
  }

  canSubmit(): boolean {
    if (!this.selectedItem) {
      return false;
    }

    const qty = Math.floor(Number(this.quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      return false;
    }

    if (this.adjustmentMode === 'decrease' && qty > this.selectedItem.current_stock) {
      return false;
    }

    if (this.adjustmentMode === 'decrease' && this.confirmExpiration && qty > this.selectedItem.expired_stock) {
      return false;
    }

    if (this.adjustmentMode === 'increase' && this.expiryDate && this.manufacturedDate) {
      if (new Date(this.manufacturedDate) > new Date(this.expiryDate)) {
        return false;
      }
    }

    if (this.adjustmentMode === 'increase' && this.selectedItem.shelf_life_days && !this.getEffectiveExpiryDate()) {
      return false;
    }

    return this.reason.trim().length > 0;
  }

  onAdjustmentModeChange(): void {
    if (this.adjustmentMode === 'increase') {
      this.confirmExpiration = false;
      this.computeExpiryDate();
    }

    if (this.adjustmentMode === 'decrease') {
      this.purchaseDate = new Date().toISOString().split('T')[0];
      this.expiryDate = '';
      this.expiryDateOverride = false;
      this.computedExpiryDate = null;
      this.manufacturedDate = '';
    }
  }

  onDateInputsChange(): void {
    this.computeExpiryDate();
  }

  computeExpiryDate(): void {
    if (this.adjustmentMode !== 'increase' || !this.selectedItem?.shelf_life_days) {
      this.computedExpiryDate = null;
      return;
    }

    if (this.expiryDateOverride && this.expiryDate) {
      this.computedExpiryDate = null;
      return;
    }

    const baseDateRaw = this.manufacturedDate || this.purchaseDate;
    if (!baseDateRaw) {
      this.computedExpiryDate = null;
      return;
    }

    const base = new Date(baseDateRaw);
    if (Number.isNaN(base.getTime())) {
      this.computedExpiryDate = null;
      return;
    }

    const expiry = new Date(base);
    expiry.setDate(expiry.getDate() + this.selectedItem.shelf_life_days);
    this.computedExpiryDate = expiry.toISOString().split('T')[0];
  }

  getEffectiveExpiryDate(): string | null {
    if (this.adjustmentMode !== 'increase') {
      return null;
    }

    if (this.expiryDateOverride) {
      return this.expiryDate || null;
    }

    return this.computedExpiryDate;
  }

  toggleExpiryOverride(): void {
    this.expiryDateOverride = !this.expiryDateOverride;
    if (!this.expiryDateOverride) {
      this.expiryDate = '';
      this.computeExpiryDate();
      return;
    }

    this.expiryDate = this.computedExpiryDate || '';
  }

  getProjectedStock(): number {
    if (!this.selectedItem) {
      return 0;
    }

    const qty = Math.max(0, Math.floor(Number(this.quantity || 0)));
    return this.adjustmentMode === 'increase'
      ? this.selectedItem.current_stock + qty
      : this.selectedItem.current_stock - qty;
  }

  submitAdjustment(): void {
    if (!this.selectedItem) {
      return;
    }

    if (!this.canSubmit()) {
      if (!this.reason.trim()) {
        this.toast.error('Please fill out all required fields (*)');
      } else if (this.adjustmentMode === 'increase' && this.selectedItem.shelf_life_days && !this.getEffectiveExpiryDate()) {
        this.toast.error('Expiry date is required for items with configured shelf life.');
      } else {
        this.toast.error('Please fill out all required fields (*)');
      }
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.itemService.createAdjustmentTransaction({
      item_id: this.selectedItem.item_id,
      adjustment_mode: this.adjustmentMode,
      quantity: Math.floor(Number(this.quantity)),
      reason: this.reason.trim(),
      notes: this.notes.trim() || undefined,
      purchase_date: this.adjustmentMode === 'increase' && this.purchaseDate ? this.purchaseDate : undefined,
      expiry_date: this.adjustmentMode === 'increase' && this.getEffectiveExpiryDate() ? this.getEffectiveExpiryDate() ?? undefined : undefined,
      manufactured_date: this.adjustmentMode === 'increase' && this.manufacturedDate ? this.manufacturedDate : undefined,
      confirm_expiration: this.adjustmentMode === 'decrease' ? this.confirmExpiration : false,
    }).subscribe({
      next: (response: AdjustmentTransactionResponse) => {
        this.saving = false;
        this.toast.success(`Stock Adjustment recorded. Reference: ${response.data.reference_number}. New stock: ${response.data.new_stock}.`);
        this.showAdjustmentModal = false;
        this.loadItems(this.currentPage);
      },
      error: (err: any) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to create stock adjustment.');
      }
    });
  }

  goToItemRegistration(): void {
    this.router.navigate(['/dashboard/inventory/items']);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadItems(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.lastPage) {
      this.loadItems(this.currentPage + 1);
    }
  }
}
