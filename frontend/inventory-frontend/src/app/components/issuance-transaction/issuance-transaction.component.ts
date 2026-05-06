import { ChangeDetectorRef, Component, HostListener, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  InventoryItemService,
  IssuanceItem,
  PaginatedIssuanceItemsResponse,
  IssuanceTransactionResponse,
  AdjustmentTransactionResponse
} from '../../services/inventory-item.service';

interface IssuanceCartLine {
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  current_stock: number;
  quantity: number;
}

@Component({
  selector: 'app-issuance-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issuance-transaction.component.html',
  styleUrls: ['./issuance-transaction.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class IssuanceTransactionComponent implements OnInit {
  items: IssuanceItem[] = [];
  categories: Array<{ category_id: number; category_name: string }> = [];

  currentPage = 1;
  lastPage = 1;
  perPage = 10;
  searchQuery = '';
  selectedCategoryId: number | null = null;
  selectedCategoryLabel = 'All Categories';
  categoryDropdownOpen = false;
  categorySearchQuery = '';
  activeCategoryIndex = -1;
  filteredCategories: Array<{ category_id: number; category_name: string }> = [];

  selectedItem: IssuanceItem | null = null;
  transactionMode: 'issuance' | 'adjust-decrease' = 'issuance';
  issueQuantity = 1;
  adjustConfirmExpiration = false;
  adjustReason = 'Stock Adjustment (Decrease)';
  adjustNotes = '';

  destination = '';
  reason = 'Stock Issuance';
  notes = '';

  cartLines: IssuanceCartLine[] = [];

  loading = false;
  saving = false;
  successMessage = '';
  errorMessage = '';
  showCartDrawer = false;
  attemptedSubmit = false;

  isInCart(itemId: number): boolean {
    return this.cartLines.some(l => l.item_id === itemId);
  }

  openCartModal(item: IssuanceItem): void {
    this.selectItem(item);
    this.transactionMode = 'issuance';
    this.adjustConfirmExpiration = false;
    this.adjustReason = 'Stock Adjustment (Decrease)';
    this.adjustNotes = '';
    // Open drawer if not already open; don't close it if already open
    if (!this.showCartDrawer) {
      this.showCartDrawer = true;
    }
    this.attemptedSubmit = false;
  }

  closeCartModal(): void {
    if (this.saving) return;
    this.showCartDrawer = false;
    this.attemptedSubmit = false;
  }

  openIssuanceModal(): void {
    this.showCartDrawer = true;
  }

  toggleIssuanceModal(): void {
    if (this.saving && this.showCartDrawer) {
      return;
    }

    this.showCartDrawer = !this.showCartDrawer;
    if (!this.showCartDrawer) {
      this.attemptedSubmit = false;
    }
  }

  constructor(
    private itemService: InventoryItemService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadItems(1);
    this.loadCategoryOptions();
  }

  loadCategoryOptions(): void {
    this.itemService.getOptions().subscribe({
      next: (options) => {
        this.categories = options.data.categories.slice().sort((a, b) =>
          a.category_name.localeCompare(b.category_name)
        );
        this.applyCategorySearchFilter();
        this.cdr.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.filteredCategories = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadItems(page: number = 1): void {
    this.loading = true;
    this.itemService
      .getIssuanceItems({
        page,
        per_page: this.perPage,
        search: this.searchQuery || undefined,
        category_id: this.selectedCategoryId || undefined
      })
      .subscribe({
        next: (response: PaginatedIssuanceItemsResponse) => {
          this.items = response.data.data;
          this.currentPage = response.data.current_page;
          this.lastPage = response.data.last_page;

          if (this.selectedItem) {
            const refreshed = this.items.find((item) => item.item_id === this.selectedItem?.item_id);
            this.selectedItem = refreshed || null;
          }

          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.loading = false;
          this.errorMessage = err?.error?.message || 'Failed to load issuable items.';
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

  selectItem(item: IssuanceItem): void {
    this.selectedItem = item;
    this.issueQuantity = 1;
    this.errorMessage = '';
  }

  addSelectedToCart(): void {
    if (!this.selectedItem) {
      this.errorMessage = 'Select an item first.';
      return;
    }

    const quantity = Math.max(1, Math.floor(this.issueQuantity || 1));
    if (quantity > this.selectedItem.current_stock) {
      this.errorMessage = 'Requested quantity exceeds available stock.';
      return;
    }

    const existing = this.cartLines.find((line) => line.item_id === this.selectedItem?.item_id);
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > existing.current_stock) {
        this.errorMessage = 'Combined quantity exceeds available stock for this item.';
        return;
      }
      existing.quantity = newQty;
    } else {
      this.cartLines.push({
        item_id: this.selectedItem.item_id,
        item_code: this.selectedItem.item_code,
        item_description: this.selectedItem.item_description,
        measurement_unit: this.selectedItem.measurement_unit,
        current_stock: this.selectedItem.current_stock,
        quantity
      });
    }

    this.errorMessage = '';
    this.showToast(`${this.selectedItem.item_description} added to list.`);
  }

  showToast(message: string): void {
    this.successMessage = message;
    this.cdr.detectChanges();
    setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
  }

  updateLineQuantity(line: IssuanceCartLine, newQty: number): void {
    const normalized = Math.max(1, Math.floor(newQty || 1));
    line.quantity = Math.min(normalized, line.current_stock);
  }

  removeLine(line: IssuanceCartLine): void {
    this.cartLines = this.cartLines.filter((x) => x.item_id !== line.item_id);
  }

  getTotalRequestedQuantity(): number {
    return this.cartLines.reduce((sum, line) => sum + line.quantity, 0);
  }

  canConfirmIssuance(): boolean {
    if (this.cartLines.length === 0 || this.saving) {
      return false;
    }
    
    if (!this.destination.trim() || this.destination.length > 150) {
      return false;
    }
    
    if (this.reason && this.reason.length > 250) {
      return false;
    }
    
    if (this.notes && this.notes.length > 500) {
      return false;
    }
    
    return true;
  }

  canSubmitDecreaseAdjustment(): boolean {
    if (!this.selectedItem || this.saving) {
      return false;
    }

    const quantity = Math.max(1, Math.floor(this.issueQuantity || 1));
    if (quantity > this.selectedItem.current_stock) {
      return false;
    }

    if (!this.adjustReason.trim() || this.adjustReason.length > 250) {
      return false;
    }
    
    if (this.adjustNotes && this.adjustNotes.length > 500) {
      return false;
    }

    return true;
  }

  canSubmitPrimaryAction(): boolean {
    return this.transactionMode === 'issuance'
      ? this.canConfirmIssuance()
      : this.canSubmitDecreaseAdjustment();
  }

  confirmAndSubmit(): void {
    if (this.transactionMode === 'adjust-decrease') {
      this.submitDecreaseAdjustment();
      return;
    }

    if (!this.canConfirmIssuance()) {
      this.attemptedSubmit = true;
      this.errorMessage = 'Add items and destination before confirming issuance.';
      return;
    }

    this.attemptedSubmit = false;
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.itemService
      .createIssuanceTransaction({
        destination: this.destination.trim(),
        reason: this.reason.trim() || 'Stock Issuance',
        notes: this.notes.trim() || '',
        items: this.cartLines.map((line) => ({ item_id: line.item_id, quantity: line.quantity }))
      })
      .subscribe({
        next: (response: IssuanceTransactionResponse) => {
          this.saving = false;
          this.cartLines = [];
          this.selectedItem = null;
          this.issueQuantity = 1;
          this.destination = '';
          this.reason = 'Stock Issuance';
          this.notes = '';
          this.showCartDrawer = false;
          this.loadItems(this.currentPage);

          this.successMessage = `Issuance completed. Reference: ${response.data.reference_number}.`;
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMessage = '';
            this.cdr.detectChanges();
          }, 3500);
        },
        error: (err: any) => {
          this.saving = false;
          this.errorMessage = err?.error?.message || 'Failed to complete issuance.';
        }
      });
  }

  private submitDecreaseAdjustment(): void {
    if (!this.selectedItem || !this.canSubmitDecreaseAdjustment()) {
      this.errorMessage = 'Select an item, quantity, and reason for adjustment.';
      return;
    }

    const quantity = Math.max(1, Math.floor(this.issueQuantity || 1));

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.itemService
      .createAdjustmentTransaction({
        item_id: this.selectedItem.item_id,
        adjustment_mode: 'decrease',
        quantity,
        reason: this.adjustReason.trim(),
        notes: this.adjustNotes.trim() || undefined,
        confirm_expiration: this.adjustConfirmExpiration,
      })
      .subscribe({
        next: (response: AdjustmentTransactionResponse) => {
          this.saving = false;
          this.adjustConfirmExpiration = false;
          this.adjustReason = 'Stock Adjustment (Decrease)';
          this.adjustNotes = '';
          this.issueQuantity = 1;
          this.selectedItem = null;
          this.loadItems(this.currentPage);

          this.successMessage = `Adjustment completed. Reference: ${response.data.reference_number}.`;
          this.cdr.detectChanges();
          setTimeout(() => {
            this.successMessage = '';
            this.cdr.detectChanges();
          }, 3500);
        },
        error: (err: any) => {
          this.saving = false;
          this.errorMessage = err?.error?.message || 'Failed to complete stock adjustment.';
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

  // Category Combobox Methods
  toggleCategoryDropdown(): void {
    this.categoryDropdownOpen = !this.categoryDropdownOpen;
    if (this.categoryDropdownOpen) {
      this.categorySearchQuery = '';
      this.applyCategorySearchFilter();
      this.activeCategoryIndex = this.getActiveCategoryIndexFromSelection();
      this.cdr.detectChanges();
    }
  }

  onCategorySearchChange(): void {
    this.applyCategorySearchFilter();
  }

  selectCategory(category: { category_id: number; category_name: string } | null): void {
    this.selectedCategoryId = category?.category_id ?? null;
    this.selectedCategoryLabel = category?.category_name ?? 'All Categories';
    this.categoryDropdownOpen = false;
    this.categorySearchQuery = '';
    this.activeCategoryIndex = -1;
    this.onCategoryChange();
  }

  clearCategoryFilter(event?: Event): void {
    event?.stopPropagation();
    if (this.selectedCategoryId === null) {
      return;
    }
    this.selectCategory(null);
  }

  onCategoryComboboxKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!this.categoryDropdownOpen) {
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        this.toggleCategoryDropdown();
      }
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      this.categoryDropdownOpen = false;
      this.activeCategoryIndex = -1;
      return;
    }

    if (!this.filteredCategories.length) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      this.activeCategoryIndex = Math.min(
        this.activeCategoryIndex + 1,
        this.filteredCategories.length - 1,
      );
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      this.activeCategoryIndex = Math.max(this.activeCategoryIndex - 1, 0);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      if (this.activeCategoryIndex >= 0) {
        this.selectCategory(this.filteredCategories[this.activeCategoryIndex]);
      }
    }
  }

  onCategoryOptionHover(index: number): void {
    this.activeCategoryIndex = index;
  }

  private applyCategorySearchFilter(): void {
    const query = this.categorySearchQuery.trim().toLowerCase();
    this.filteredCategories = this.categories.filter((category) => {
      if (!query) {
        return true;
      }
      return category.category_name.toLowerCase().includes(query);
    });

    if (!this.filteredCategories.length) {
      this.activeCategoryIndex = -1;
      return;
    }

    this.activeCategoryIndex = this.getActiveCategoryIndexFromSelection();
  }

  private getActiveCategoryIndexFromSelection(): number {
    if (!this.filteredCategories.length) {
      return -1;
    }

    const selectedIndex = this.filteredCategories.findIndex(
      (category) => category.category_id === this.selectedCategoryId,
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.categoryDropdownOpen) {
      return;
    }

    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    if (!target.closest('.category-filter-combobox')) {
      this.categoryDropdownOpen = false;
      this.activeCategoryIndex = -1;
    }
  }
}
