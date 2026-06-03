import { ChangeDetectorRef, Component, HostListener, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  InventoryItemService,
  IssuanceItem,
  PaginatedIssuanceItemsResponse,
  IssuanceTransactionResponse,
  LocationOption,
} from '../../services/inventory-item.service';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../../shared/toast/toast.component';

interface OperationTypeOption {
  operation_type_id: number;
  operation_name: string;
  operation_direction: 'IN' | 'OUT';
  description: string | null;
  is_active: boolean;
  display_name?: string;
}

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
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './issuance-transaction.component.html',
  styleUrls: ['./issuance-transaction.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class IssuanceTransactionComponent implements OnInit {
  items: IssuanceItem[] = [];
  locations: LocationOption[] = [];
  operationTypes: OperationTypeOption[] = [];
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
  transactionMode: 'issuance' = 'issuance';
  selectedOperationTypeId: number | null = null;
  selectedOperationTypeLabel = 'Select operation type';

  // Mobile FAB state for issuance list sidebar
  isIssuanceListSidebarOpen = false;

  // Mobile detection
  private _isMobileView = false;

  isMobileView(): boolean {
    return this._isMobileView;
  }

  private updateMobileView(): void {
    const wasMobile = this._isMobileView;
    this._isMobileView = window.innerWidth <= 425;
    
    // If switching from mobile to desktop or vice versa, close the drawer
    if (wasMobile !== this._isMobileView && this.showListModal) {
      this.showListModal = false;
    }
    
    this.cdr.detectChanges();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateMobileView();
  }
  selectedLocationName: string | null = null;
  selectedLocationLabel = 'Select source storage';
  issueQuantity = 1;

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

  // Drawer methods
  toggleListDrawer(): void {
    if (this.saving) return;
    this.showCartDrawer = !this.showCartDrawer;
  }

  // Alias properties for template compatibility
  get issuanceLines(): IssuanceCartLine[] {
    return this.cartLines;
  }

  get showListModal(): boolean {
    return this.showCartDrawer;
  }

  set showListModal(value: boolean) {
    this.showCartDrawer = value;
  }

  isInCart(itemId: number): boolean {
    return this.cartLines.some(l => l.item_id === itemId);
  }

  openCartModal(item: IssuanceItem): void {
    this.selectItem(item);
    this.transactionMode = 'issuance';
    this.applyDefaultOperationType();
    this.reason = this.selectedOperationTypeLabel || 'Stock Issuance';
    this.loadSourceLocationOptions();
    // Open drawer if not already open; don't close it if already open
    if (!this.showListModal) {
      this.showListModal = true;
    }
    this.attemptedSubmit = false;
  }

  closeCartModal(): void {
    if (this.saving) return;
    this.showListModal = false;
    this.attemptedSubmit = false;
  }

  openIssuanceModal(): void {
    this.showListModal = true;
  }

  toggleIssuanceModal(): void {
    this.toggleListDrawer();
  }

  constructor(
    private itemService: InventoryItemService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.updateMobileView();
    this.loadOperationTypeOptions();
    this.loadItems(1);
    this.loadCategoryOptions();
  }

  loadOperationTypeOptions(): void {
    this.itemService.getOperationTypeOptions('OUT').subscribe({
      next: (response) => {
        this.operationTypes = (response.data || []).filter((option) => option.is_active);
        this.applyDefaultOperationType();
        this.cdr.detectChanges();
      },
      error: () => {
        this.operationTypes = [];
        this.selectedOperationTypeId = null;
        this.selectedOperationTypeLabel = 'Select operation type';
        this.cdr.detectChanges();
      },
    });
  }

  private applyDefaultOperationType(): void {
    if (!this.operationTypes.length) {
      this.selectedOperationTypeId = null;
      this.selectedOperationTypeLabel = 'Select operation type';
      return;
    }

    if (this.selectedOperationTypeId === null || !this.operationTypes.some((option) => option.operation_type_id === this.selectedOperationTypeId)) {
      this.selectedOperationTypeId = this.operationTypes[0].operation_type_id;
    }

    const selected = this.operationTypes.find((option) => option.operation_type_id === this.selectedOperationTypeId);
    this.selectedOperationTypeLabel = selected?.display_name || selected?.operation_name || 'Select operation type';
  }

  onOperationTypeChange(): void {
    const selected = this.operationTypes.find((option) => option.operation_type_id === this.selectedOperationTypeId);
    this.selectedOperationTypeLabel = selected?.display_name || selected?.operation_name || 'Select operation type';
    if (selected?.operation_name && this.transactionMode === 'issuance') {
      this.reason = selected.operation_name;
    }
  }

  private getSourceLocationItemIds(): number[] {
    const cartItemIds = this.cartLines.map((line) => line.item_id);
    if (cartItemIds.length > 0) {
      return cartItemIds;
    }

    return this.selectedItem ? [this.selectedItem.item_id] : [];
  }

  loadSourceLocationOptions(): void {
    const itemIds = this.getSourceLocationItemIds();

    if (itemIds.length === 0) {
      this.locations = [];
      this.selectedLocationName = null;
      this.selectedLocationLabel = 'Select source storage';
      this.cdr.detectChanges();
      return;
    }

    this.itemService.getIssuanceSourceLocations(itemIds).subscribe({
      next: (response) => {
        this.locations = (response.data || []).slice().sort((a, b) =>
          a.location_name.localeCompare(b.location_name),
        );

        if (this.locations.length > 0 && this.selectedLocationName === null) {
          this.selectedLocationName = this.locations[0].location_name;
          this.selectedLocationLabel = this.locations[0].location_name;
        } else if (this.selectedLocationName !== null) {
          const selected = this.locations.find((location) => location.location_name === this.selectedLocationName);
          this.selectedLocationLabel = selected?.location_name || 'Select source storage';
        }

        this.cdr.detectChanges();
      },
      error: () => {
        this.locations = [];
        this.selectedLocationName = null;
        this.selectedLocationLabel = 'Select source storage';
        this.cdr.detectChanges();
      },
    });
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

    this.loadSourceLocationOptions();

    this.errorMessage = '';
    this.showToast(`${this.selectedItem.item_description} added to list.`);
  }

  showToast(message: string): void {
    this.toast.success(message);
  }

  updateLineQuantity(line: IssuanceCartLine, newQty: number): void {
    const normalized = Math.max(1, Math.floor(newQty || 1));
    line.quantity = Math.min(normalized, line.current_stock);
  }

  removeLine(line: IssuanceCartLine): void {
    this.cartLines = this.cartLines.filter((x) => x.item_id !== line.item_id);
    this.loadSourceLocationOptions();
  }

  getTotalRequestedQuantity(): number {
    return this.cartLines.reduce((sum, line) => sum + line.quantity, 0);
  }

  canConfirmIssuance(): boolean {
    if (this.cartLines.length === 0 || this.saving) {
      return false;
    }

    if (this.locations.length > 0 && !this.selectedLocationName) {
      return false;
    }

    if (!this.selectedOperationTypeId) {
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

  canSubmitPrimaryAction(): boolean {
    return this.canConfirmIssuance();
  }

  confirmAndSubmit(): void {
    if (!this.canConfirmIssuance()) {
      this.attemptedSubmit = true;
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    this.attemptedSubmit = false;
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.itemService
      .createIssuanceTransaction({
        operation_type_id: this.selectedOperationTypeId,
        destination: this.destination.trim(),
        location_name: this.selectedLocationName,
        reason: this.reason.trim() || this.selectedOperationTypeLabel || 'Stock Issuance',
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
          this.applyDefaultOperationType();
          this.reason = this.selectedOperationTypeLabel || 'Stock Issuance';
          this.notes = '';
          this.showListModal = false;
          this.loadItems(this.currentPage);

          this.toast.success(`Stock Issuance completed. Reference: ${response.data.reference_number}.`);
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.saving = false;
          this.toast.error(err?.error?.message || 'Failed to complete issuance.');
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

  // Mobile FAB methods for issuance list sidebar
  shouldShowIssuanceListFab(): boolean {
    return window.innerWidth <= 425;
  }

  toggleIssuanceListSidebar(): void {
    this.isIssuanceListSidebarOpen = !this.isIssuanceListSidebarOpen;
    // Actually toggle the drawer state
    this.showListModal = !this.showListModal;
  }

  closeIssuanceListSidebar(): void {
    this.isIssuanceListSidebarOpen = false;
    this.showListModal = false;
  }
}
