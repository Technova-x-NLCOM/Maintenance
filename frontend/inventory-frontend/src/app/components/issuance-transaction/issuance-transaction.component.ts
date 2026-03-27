import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from '@angular/core';
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
  perPage = 12;
  searchQuery = '';
  selectedCategoryId: number | null = null;

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

  isInCart(itemId: number): boolean {
    return this.cartLines.some(l => l.item_id === itemId);
  }

  openCartModal(item: IssuanceItem): void {
    this.selectItem(item);
    this.transactionMode = 'issuance';
    this.adjustConfirmExpiration = false;
    this.adjustReason = 'Stock Adjustment (Decrease)';
    this.adjustNotes = '';
    this.openIssuanceModal();
  }

  closeCartModal(): void {
    if (this.saving) {
      return;
    }
    this.showCartDrawer = false;
  }

  openIssuanceModal(): void {
    this.showCartDrawer = true;
  }

  toggleIssuanceModal(): void {
    if (this.saving && this.showCartDrawer) {
      return;
    }

    this.showCartDrawer = !this.showCartDrawer;
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
    return this.cartLines.length > 0 && this.destination.trim().length > 0 && !this.saving;
  }

  canSubmitDecreaseAdjustment(): boolean {
    if (!this.selectedItem || this.saving) {
      return false;
    }

    const quantity = Math.max(1, Math.floor(this.issueQuantity || 1));
    if (quantity > this.selectedItem.current_stock) {
      return false;
    }

    return this.adjustReason.trim().length > 0;
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
      this.errorMessage = 'Add items and destination before confirming issuance.';
      return;
    }

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
}
