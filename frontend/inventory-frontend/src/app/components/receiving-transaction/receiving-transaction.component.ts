import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import {
  InventoryItemService,
  ReceivingItem,
  PaginatedReceivingItemsResponse,
  ReceivingTransactionResponse,
  AdjustmentTransactionResponse,
} from '../../services/inventory-item.service';

interface ReceivingCartLine {
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  quantity: number;
  purchase_date: string;
  expiry_date: string | null;
  manufactured_date: string | null;
  supplier_info: string | null;
  batch_value: number | null;
  reason: string | null;
  notes: string | null;
}

@Component({
  selector: 'app-receiving-transaction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './receiving-transaction.component.html',
  styleUrls: ['./receiving-transaction.component.scss'],
})
export class ReceivingTransactionComponent implements OnInit, OnDestroy {
  // Items catalog and pagination
  receivingItems: ReceivingItem[] = [];
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
  loading = false;

  // Form state
  selectedItem: ReceivingItem | null = null;
  transactionMode: 'receive' | 'adjust-increase' = 'receive';
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
  showReceivingModal = false;
  showListModal = false;
  confirmBatchNumber = '';
  showBatchQrModal = false;
  batchQrTitle = '';
  batchQrLabel = '';
  batchQrPayload = '';
  batchQrImageDataUrl: string | null = null;
  showScanModal = false;
  scanErrorMessage = '';
  receivingLines: ReceivingCartLine[] = [];
  attemptedAddToList = false;
  attemptedSubmitList = false;
  private scanner = new BrowserMultiFormatReader();
  private scannerControls?: IScannerControls;

  openReceivingModal(item: ReceivingItem): void {
    this.selectItem(item);
    this.transactionMode = 'receive';
    this.reason = 'Stock Received';
    this.attemptedAddToList = false;
    this.showReceivingModal = true;
  }

  closeReceivingModal(): void {
    if (this.saving) {
      return;
    }
    this.attemptedAddToList = false;
    this.showReceivingModal = false;
  }

  openListModal(): void {
    this.showListModal = true;
  }

  closeListModal(): void {
    this.showListModal = false;
  }

  toggleListDrawer(): void {
    if (this.saving) return;
    this.showListModal = !this.showListModal;
  }

  closeBatchQrModal(): void {
    this.showBatchQrModal = false;
    this.batchQrTitle = '';
    this.batchQrLabel = '';
    this.batchQrPayload = '';
    this.batchQrImageDataUrl = null;
  }

  openQrScanner(): void {
    this.showScanModal = true;
    this.scanErrorMessage = '';

    setTimeout(() => {
      this.startScanner();
    }, 0);
  }

  closeQrScanner(): void {
    this.stopScanner();
    this.showScanModal = false;
    this.scanErrorMessage = '';
  }

  bounceModal(selector: string): void {
    const el = document.querySelector<HTMLElement>(`.${selector}`);
    if (!el) return;
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.05)' },
        { transform: 'scale(0.97)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' },
      ],
      { duration: 400, easing: 'ease' },
    );
  }

  constructor(
    private itemService: InventoryItemService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.purchaseDate = today.toISOString().split('T')[0];
    this.loadReceivingItems(1);
    this.loadCategoryOptions();
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  private async startScanner(): Promise<void> {
    const video = document.getElementById('receivingQrVideo') as HTMLVideoElement | null;
    if (!video) {
      this.scanErrorMessage = 'Scanner preview is not ready.';
      return;
    }

    try {
      // Request camera permission explicitly
      this.scanErrorMessage = 'Requesting camera access...';
      this.cdr.detectChanges();

      const cameraPermission = await this.requestCameraPermission();
      if (!cameraPermission) {
        this.scanErrorMessage =
          'Camera permission denied. Enable camera access in your browser settings to use QR scanner.';
        this.cdr.detectChanges();
        return;
      }

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const deviceId = devices[0]?.deviceId;

      if (!deviceId) {
        this.scanErrorMessage = 'No camera detected on this device.';
        return;
      }

      this.scanErrorMessage = ''; // Clear loading message once camera access is granted
      this.scannerControls = await this.scanner.decodeFromVideoDevice(
        deviceId,
        video,
        (result: any, error: any) => {
          if (result) {
            this.handleScannedQr(result.getText());
            this.closeQrScanner();
            this.cdr.detectChanges();
            return;
          }

          if (error && !(error instanceof NotFoundException)) {
            this.scanErrorMessage = 'Unable to read QR. Please hold it steady and try again.';
            this.cdr.detectChanges();
          }
        },
      );
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        this.scanErrorMessage =
          'Camera permission denied. Enable camera access in your browser settings.';
      } else if ((error as Error).name === 'NotFoundError') {
        this.scanErrorMessage = 'No camera device found on this device.';
      } else {
        this.scanErrorMessage = 'Unable to access camera. Check permissions and try again.';
      }
      this.cdr.detectChanges();
    }
  }

  private async requestCameraPermission(): Promise<boolean> {
    try {
      // Use the Permissions API to request camera access
      const permissionResult = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });

      if (permissionResult.state === 'denied') {
        return false;
      }

      if (permissionResult.state === 'granted') {
        return true;
      }

      // If 'prompt', user will be asked when trying to access the camera
      // Attempt accessing the camera directly, which will trigger the browser permission prompt
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      // Immediately stop the stream as we only needed to verify permission
      mediaStream.getTracks().forEach((track) => track.stop());

      return true;
    } catch {
      // If Permissions API fails or getUserMedia fails, permission was denied
      return false;
    }
  }

  private stopScanner(): void {
    this.scannerControls?.stop();
    this.scannerControls = undefined;
  }

  private handleScannedQr(rawText: string): void {
    const parsed = this.tryParseQrPayload(rawText);
    const itemCode = parsed?.['item_code'] || this.extractCodeFromLabel(rawText, 'ITEM:');
    const batchCode = parsed?.['batch_number'] || this.extractCodeFromLabel(rawText, 'BATCH:');

    if (itemCode) {
      this.searchQuery = itemCode;
      this.loadReceivingItems(1);
      this.successMessage = `Scanned item QR: ${itemCode}`;
      this.showSuccessMessage = true;
      return;
    }

    if (batchCode) {
      this.confirmBatchNumber = batchCode;
      this.showListModal = true;
      this.successMessage = `Scanned batch QR: ${batchCode}`;
      this.showSuccessMessage = true;
      return;
    }

    this.errorMessage = 'QR scanned, but no recognized item or batch code was found.';
    this.showErrorMessage = true;
  }

  private tryParseQrPayload(rawText: string): Record<string, string> | null {
    try {
      const parsed = JSON.parse(rawText) as Record<string, string>;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractCodeFromLabel(value: string, prefix: string): string | null {
    if (!value.startsWith(prefix)) {
      return null;
    }

    const code = value.slice(prefix.length).trim();
    return code ? code : null;
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
      },
    });
  }

  loadReceivingItems(page: number = 1): void {
    this.loading = true;
    this.itemService
      .getReceivingItems({
        page,
        per_page: this.perPage,
        search: this.searchQuery || undefined,
        category_id: this.selectedCategoryId || undefined,
      })
      .subscribe({
        next: (response: PaginatedReceivingItemsResponse) => {
          if (response.success) {
            this.receivingItems = response.data.data;
            this.currentPage = response.data.current_page;
            this.lastPage = response.data.last_page;

            if (this.selectedItem) {
              const refreshedSelected = this.receivingItems.find(
                (item) => item.item_id === this.selectedItem?.item_id,
              );
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
        },
      });
  }

  private loadReceivingItemsFallback(page: number): void {
    this.itemService
      .list({
        page,
        per_page: this.perPage,
        search: this.searchQuery || undefined,
        category_id: this.selectedCategoryId || undefined,
        is_active: true,
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
            is_active: item.is_active,
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
        },
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
    if (!this.expiryDateOverride) {
      // If unchecking override, clear manual date and re-compute
      this.expiryDate = null;
      this.computeExpiry();
    } else {
      // If checking override, pre-fill with computed value
      this.expiryDate = this.computedExpiryDate;
    }
  }

  canAddToList(): boolean {
    if (!this.selectedItem || !this.quantity || this.quantity <= 0) {
      return false;
    }

    if (this.transactionMode === 'adjust-increase') {
      if (!this.reason.trim()) {
        return false;
      }

      if (this.reason.length > 250) {
        return false;
      }

      if (this.notes && this.notes.length > 500) {
        return false;
      }

      if (this.selectedItem.shelf_life_days && !this.getEffectiveExpiryDate()) {
        return false;
      }

      if (this.manufacturedDate && this.getEffectiveExpiryDate()) {
        if (new Date(this.manufacturedDate) > new Date(this.getEffectiveExpiryDate() as string)) {
          return false;
        }
      }

      return true;
    }

    if (!this.batchNumber.trim()) {
      return false;
    }
    if (this.batchNumber.length > 50) {
      return false;
    }
    if (!this.purchaseDate) {
      return false;
    }
    if (this.supplierInfo && this.supplierInfo.length > 150) {
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

  goToItemRegistration(): void {
    this.router.navigate(['/dashboard/inventory/items']);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadReceivingItems(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.lastPage) {
      this.loadReceivingItems(this.currentPage + 1);
    }
  }

  addToReceivingList(): void {
    this.attemptedAddToList = true;
    if (!this.canAddToList() || !this.selectedItem) {
      return;
    }

    this.showErrorMessage = false;

    const expiry = this.getEffectiveExpiryDate();
    const line: ReceivingCartLine = {
      item_id: this.selectedItem.item_id,
      item_code: this.selectedItem.item_code,
      item_description: this.selectedItem.item_description,
      measurement_unit: this.selectedItem.measurement_unit,
      quantity: this.quantity,
      purchase_date: this.purchaseDate,
      expiry_date: expiry,
      manufactured_date: this.manufacturedDate || null,
      supplier_info: this.supplierInfo?.trim() || null,
      batch_value: this.batchValue || null,
      reason: this.reason?.trim() || 'Stock Received',
      notes: this.notes?.trim() || null,
    };

    const existingIndex = this.receivingLines.findIndex((entry) => entry.item_id === line.item_id);

    if (existingIndex >= 0) {
      this.receivingLines[existingIndex].quantity += line.quantity;
      this.receivingLines[existingIndex].purchase_date = line.purchase_date;
      this.receivingLines[existingIndex].expiry_date = line.expiry_date;
      this.receivingLines[existingIndex].manufactured_date = line.manufactured_date;
      this.receivingLines[existingIndex].supplier_info = line.supplier_info;
      this.receivingLines[existingIndex].batch_value = line.batch_value;
      this.receivingLines[existingIndex].reason = line.reason;
      this.receivingLines[existingIndex].notes = line.notes;
    } else {
      this.receivingLines.push(line);
    }

    this.showSuccessMessage = true;
    this.successMessage = `${line.item_description} added to receiving list.`;
    this.showReceivingModal = false;
    this.showListModal = true;
    this.attemptedAddToList = false;
    this.resetForm();
    this.cdr.detectChanges();
  }

  removeLine(index: number): void {
    this.receivingLines.splice(index, 1);
  }

  getTotalLineQuantity(): number {
    return this.receivingLines.reduce((sum, line) => sum + line.quantity, 0);
  }

  canSubmitList(): boolean {
    if (this.receivingLines.length === 0 || this.saving) {
      return false;
    }
    
    if (!this.confirmBatchNumber.trim() || this.confirmBatchNumber.length > 50) {
      return false;
    }
    
    return true;
  }

  submitReceivingList(): void {
    this.attemptedSubmitList = true;
    if (!this.canSubmitList()) {
      return;
    }

    if (this.transactionMode === 'adjust-increase') {
      this.submitIncreaseAdjustment();
      return;
    }

    this.saving = true;
    this.showSuccessMessage = false;
    this.showErrorMessage = false;

    const payload = {
      batch_number: this.confirmBatchNumber.trim(),
      items: this.receivingLines.map((line) => ({
        item_id: line.item_id,
        quantity: line.quantity,
        purchase_date: line.purchase_date,
        expiry_date: line.expiry_date,
        manufactured_date: line.manufactured_date,
        supplier_info: line.supplier_info,
        batch_value: line.batch_value,
        reason: line.reason,
        notes: line.notes,
      })),
    };

    this.itemService.createReceivingTransaction(payload).subscribe({
      next: (response: ReceivingTransactionResponse) => {
        if (response.success) {
          this.showSuccessMessage = true;
          const lineCount = (response as any)?.data?.line_count ?? this.receivingLines.length;
          const reference = (response as any)?.data?.reference_number;
          const batchNumber =
            (response as any)?.data?.batch_number ?? this.confirmBatchNumber.trim();
          const qrPayload = (response as any)?.data?.qr_payload;
          this.successMessage = reference
            ? `Receiving list submitted successfully. Ref: ${reference}. Lines: ${lineCount}.`
            : `Receiving list submitted successfully. Lines: ${lineCount}.`;

          if (qrPayload) {
            this.batchQrTitle = `Batch QR: ${batchNumber}`;
            this.batchQrLabel = (response as any)?.data?.qr_label || `BATCH:${batchNumber}`;
            this.batchQrPayload = qrPayload;
            this.showBatchQrModal = true;
            this.batchQrImageDataUrl = null;
            QRCode.toDataURL(qrPayload, { width: 300, margin: 2 })
              .then((url: string) => {
                this.batchQrImageDataUrl = url;
                this.cdr.detectChanges();
              })
              .catch(() => {
                this.batchQrImageDataUrl = null;
                this.cdr.detectChanges();
              });
          }

          this.receivingLines = [];
          this.confirmBatchNumber = '';
          this.attemptedSubmitList = false;
          this.resetForm();
          this.showReceivingModal = false;
          this.showListModal = false;
          this.loadReceivingItems();
        }
        this.saving = false;
      },
      error: (error: any) => {
        console.error('Error creating receiving transaction:', error);
        this.showError(
          error.error?.message || 'Failed to record receiving transaction. Please try again.',
        );
        this.saving = false;
      },
    });
  }

  private submitIncreaseAdjustment(): void {
    if (!this.selectedItem) {
      return;
    }

    this.saving = true;
    this.showSuccessMessage = false;
    this.showErrorMessage = false;

    this.itemService
      .createAdjustmentTransaction({
        item_id: this.selectedItem.item_id,
        adjustment_mode: 'increase',
        quantity: this.quantity,
        reason: this.reason.trim(),
        notes: this.notes || undefined,
        purchase_date: this.purchaseDate || undefined,
        expiry_date: this.getEffectiveExpiryDate() || undefined,
        manufactured_date: this.manufacturedDate || undefined,
      })
      .subscribe({
        next: (response: AdjustmentTransactionResponse) => {
          this.showSuccessMessage = true;
          this.successMessage = `Stock adjusted (+) successfully. Reference: ${response.data.reference_number}.`;
          this.resetForm();
          this.showReceivingModal = false;
          this.loadReceivingItems();
          this.saving = false;
        },
        error: (error: any) => {
          this.showError(
            error.error?.message || 'Failed to record stock adjustment (+). Please try again.',
          );
          this.saving = false;
        },
      });
  }

  resetForm(): void {
    this.selectedItem = null;
    this.transactionMode = 'receive';
    this.quantity = 1;
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
    this.attemptedAddToList = false;
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
