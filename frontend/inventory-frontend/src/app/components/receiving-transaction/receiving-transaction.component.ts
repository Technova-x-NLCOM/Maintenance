import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InventoryItemService, ReceivingItem, PaginatedReceivingItemsResponse, ReceivingTransactionResponse } from '../../services/inventory-item.service';
import { PaginationComponent } from '../pagination/pagination.component';

@Component({
  selector: 'app-receiving-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './receiving-transaction.component.html',
  styleUrls: ['./receiving-transaction.component.scss']
})
export class ReceivingTransactionComponent implements OnInit {
  // Items catalog and pagination
  receivingItems: ReceivingItem[] = [];
  categories: Array<{ category_id: number; category_name: string }> = [];
  
  currentPage = 1;
  lastPage = 1;
  perPage = 12;
  searchQuery = '';
  selectedCategoryId: number | null = null;
  loading = false;

  // Form state
  selectedItem: ReceivingItem | null = null;
  quantity = 1;
  batchNumber = '';
  purchaseDate = '';
  expiryDate: string | null = null;
  manufacturedDate: string | null = null;
  supplierInfo = '';
  batchValue: number | null = null;
  reason = 'Stock Received';
  notes = '';

  // Computed expiry
  computedExpiryDate: string | null = null;
  expiryDateOverride = false;
  computedExpiryMessage = '';

  // UI state
  saving = false;
  showSuccessMessage = false;
  showErrorMessage = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private itemService: InventoryItemService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.purchaseDate = today.toISOString().split('T')[0];
    this.loadReceivingItems(1);
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

  loadReceivingItems(page: number = 1): void {
    this.loading = true;
    this.itemService.getReceivingItems({
      page,
      per_page: this.perPage,
      search: this.searchQuery || undefined,
      category_id: this.selectedCategoryId || undefined
    }).subscribe({
      next: (response: PaginatedReceivingItemsResponse) => {
        if (response.success) {
          this.receivingItems = response.data.data;
          this.currentPage = response.data.current_page;
          this.lastPage = response.data.last_page;

          if (this.selectedItem) {
            const refreshedSelected = this.receivingItems.find((item) => item.item_id === this.selectedItem?.item_id);
            this.selectedItem = refreshedSelected || this.selectedItem;
          }

          // Fallback: if receiving endpoint returns no rows, load from regular items API.
          if (this.receivingItems.length === 0) {
            this.loadReceivingItemsFallback(page);
            return;
          }
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error loading items:', error);
        this.loadReceivingItemsFallback(page);
      }
    });
  }

  private loadReceivingItemsFallback(page: number): void {
    this.itemService
      .list({
        page,
        per_page: this.perPage,
        search: this.searchQuery || undefined,
        category_id: this.selectedCategoryId || undefined,
        is_active: true
      })
      .subscribe({
        next: (response) => {
          this.receivingItems = response.data.data.map((item) => ({
            item_id: item.item_id,
            item_code: item.item_code,
            item_description: item.item_description,
            item_type_name: item.item_type_name,
            category_name: item.category_name,
            measurement_unit: item.measurement_unit,
            shelf_life_days: item.shelf_life_days,
            image_url: item.image_url,
            current_stock: 0,
            is_active: item.is_active
          }));
          this.currentPage = response.data.current_page;
          this.lastPage = response.data.last_page;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.showError('Failed to load items for receiving. Please try again.');
          this.cdr.detectChanges();
        }
      });
  }

  onSearch(): void {
    this.loadReceivingItems(1);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.loadReceivingItems(1);
  }

  onCategoryChange(): void {
    this.loadReceivingItems(1);
  }

  selectItem(item: ReceivingItem): void {
    this.selectedItem = item;
    this.computeExpiry();
    if (item.shelf_life_days) {
      this.computedExpiryMessage = `Auto-calculated from shelf-life (${item.shelf_life_days} days)`;
    } else {
      this.computedExpiryMessage = 'No shelf-life configured. Add expiry manually if available.';
    }
  }

  computeExpiry(): void {
    if (!this.selectedItem || !this.purchaseDate) {
      this.computedExpiryDate = null;
      return;
    }

    // If user has manually overridden expiry date, don't auto-compute
    if (this.expiryDateOverride && this.expiryDate) {
      return;
    }

    // If item doesn't have shelf life, can't auto-compute
    if (!this.selectedItem.shelf_life_days) {
      this.computedExpiryDate = null;
      return;
    }

    // Calculate expected expiry from purchase date + shelf life days
    try {
      const purchaseDate = new Date(this.purchaseDate);
      const expiryDate = new Date(purchaseDate);
      expiryDate.setDate(expiryDate.getDate() + this.selectedItem.shelf_life_days);
      this.computedExpiryDate = expiryDate.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error computing expiry date:', error);
      this.computedExpiryDate = null;
    }
  }

  onPurchaseDateChange(): void {
    this.computeExpiry();
  }

  getEffectiveExpiryDate(): string | null {
    // If user override is active and has a value, use that
    if (this.expiryDateOverride && this.expiryDate) {
      return this.expiryDate;
    }
    // Otherwise use computed date
    return this.computedExpiryDate;
  }

  toggleExpiryDateOverride(): void {
    this.expiryDateOverride = !this.expiryDateOverride;
    if (!this.expiryDateOverride) {
      // If unchecking override, clear manual date and re-compute
      this.expiryDate = null;
      this.computeExpiry();
    } else {
      // If checking override, pre-fill with computed value
      this.expiryDate = this.computedExpiryDate;
    }
  }

  canSubmit(): boolean {
    if (!this.selectedItem || !this.quantity || this.quantity <= 0) {
      return false;
    }
    if (!this.batchNumber.trim()) {
      return false;
    }
    if (!this.purchaseDate) {
      return false;
    }
    return true;
  }

  goToItemRegistration(): void {
    this.router.navigate(['/dashboard/inventory/items']);
  }

  onPageChange(page: number): void {
    this.loadReceivingItems(page);
  }

  submitForm(): void {
    if (!this.canSubmit() || !this.selectedItem) {
      return;
    }

    this.saving = true;
    this.showSuccessMessage = false;
    this.showErrorMessage = false;

    const payload = {
      item_id: this.selectedItem.item_id,
      quantity: this.quantity,
      batch_number: this.batchNumber,
      purchase_date: this.purchaseDate,
      expiry_date: this.getEffectiveExpiryDate(),
      manufactured_date: this.manufacturedDate || undefined,
      supplier_info: this.supplierInfo || undefined,
      batch_value: this.batchValue || undefined,
      reason: this.reason || undefined,
      notes: this.notes || undefined
    };

    this.itemService.createReceivingTransaction(payload).subscribe({
      next: (response: ReceivingTransactionResponse) => {
        if (response.success) {
          this.showSuccessMessage = true;
          this.successMessage = `Stock received successfully! Batch #${response.data.batch_number} created with ${response.data.quantity} units.`;
          if (response.data.expiry_date_auto_calculated) {
            this.successMessage += ` Expiry date auto-calculated: ${response.data.expiry_date}`;
          }
          this.resetForm();
          this.loadReceivingItems();
        }
        this.saving = false;
      },
      error: (error: any) => {
        console.error('Error creating receiving transaction:', error);
        this.showError(
          error.error?.message || 'Failed to record receiving transaction. Please try again.'
        );
        this.saving = false;
      }
    });
  }

  resetForm(): void {
    this.selectedItem = null;
    this.quantity = 1;
    this.batchNumber = '';
    this.purchaseDate = new Date().toISOString().split('T')[0];
    this.expiryDate = null;
    this.manufacturedDate = null;
    this.supplierInfo = '';
    this.batchValue = null;
    this.reason = 'Stock Received';
    this.notes = '';
    this.expiryDateOverride = false;
    this.computedExpiryDate = null;
    this.computedExpiryMessage = '';
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorMessage = true;
    setTimeout(() => {
      this.showErrorMessage = false;
    }, 5000);
  }

  dismissMessages(): void {
    this.showSuccessMessage = false;
    this.showErrorMessage = false;
  }
}
