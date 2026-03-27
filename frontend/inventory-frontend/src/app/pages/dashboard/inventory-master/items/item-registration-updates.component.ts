import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import * as QRCode from 'qrcode';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import {
  InventoryItem,
  InventoryItemService,
  ItemFormOptions
} from '../../../../services/inventory-item.service';
import { InventoryCategoryService } from '../../../../services/inventory-category.service';

@Component({
  selector: 'app-item-registration-updates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-registration-updates.component.html',
  styleUrls: ['./item-registration-updates.component.scss']
})
export class ItemRegistrationUpdatesComponent implements OnInit, OnDestroy {
  viewMode: 'table' | 'cards' = 'table';
  loading = false;
  saving = false;

  items: InventoryItem[] = [];
  options: ItemFormOptions = { item_types: [], categories: [] };

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  perPage = 20;
  readonly pageSizeOptions = [10, 20, 50];

  search = '';
  selectedFilterCategoryId: number | null = null;
  selectedFilterCategoryName = 'All categories';
  categoryFilterOpen = false;
  categoryFilterQuery = '';
  activeCategoryOptionIndex = -1;
  categoryFilterOptions: Array<{ category_id: number; category_name: string }> = [];
  filteredCategoryFilterOptions: Array<{ category_id: number; category_name: string }> = [];

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadItemsSub?: Subscription;
  private searchDebounceId?: ReturnType<typeof setTimeout>;

  selectedItemId: number | null = null;
  /** When true, the Register/Update form is visible. Hidden by default; shown when user clicks New Item or Edit. */
  showForm = false;

  errorMessage = '';
  successMessage = '';
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;
  showQrModal = false;
  qrModalTitle = '';
  qrLabel = '';
  qrPayload = '';
  qrImageDataUrl: string | null = null;
  showScanModal = false;
  scanErrorMessage = '';
  private itemScanner = new BrowserMultiFormatReader();
  private itemScannerControls?: IScannerControls;

  formData: {
    item_code: string;
    item_description: string;
    item_type_id: number | null;
    category_id: number | null;
    measurement_unit: string;
    particular: string;
    mg_dosage: number | null;
    shelf_life_days: number | null;
    remarks: string;
    unit_value: number | null;
    reorder_level: number;
    is_active: boolean;
  } = {
    item_code: '',
    item_description: '',
    item_type_id: null,
    category_id: null,
    measurement_unit: '',
    particular: '',
    mg_dosage: null,
    shelf_life_days: null,
    remarks: '',
    unit_value: null,
    reorder_level: 0,
    is_active: true
  };

  constructor(
    private itemService: InventoryItemService,
    private categoryService: InventoryCategoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOptionsAndItems();
  }

  /**
   * Because `Type` is effectively redundant with `Category` in this app,
   * we auto-derive `item_type_id` from the selected `category_id`.
   * Backend still requires `item_type_id`.
   */
  onCategoryChange(): void {
    this.syncItemTypeIdFromCategory();
  }

  private syncItemTypeIdFromCategory(): void {
    if (!this.options?.item_types?.length) return;

    // No category selected -> keep item_type_id null so save validation forces category selection.
    if (!this.formData.category_id) {
      // If editing an existing item, keep the backend value to avoid breaking updates.
      if (this.selectedItemId) {
        return;
      }
      this.formData.item_type_id = null;
      return;
    }

    const catId = this.formData.category_id;
    const category = this.options.categories.find(c => c.category_id === catId);
    const name = (category?.category_name || '').toLowerCase();

    let desiredTypeName: string | null = null;
    if (name.includes('medical')) desiredTypeName = 'medicine';
    else if (name.includes('emergency')) desiredTypeName = 'emergency_safety';
    else if (name.includes('food')) desiredTypeName = 'consumable';
    else if (name.includes('clothing')) desiredTypeName = 'nlcom_shirt';
    else if (name.includes('kitchen')) desiredTypeName = 'tool_utensil';
    else if (name.includes('general')) desiredTypeName = 'general_item';

    const fallbackType =
      this.options.item_types.find(t => t.type_name === 'general_item') ??
      this.options.item_types[0];

    const picked =
      (desiredTypeName
        ? this.options.item_types.find(t => t.type_name === desiredTypeName)
        : null) ?? fallbackType;

    this.formData.item_type_id = picked?.item_type_id ?? null;
  }

  loadOptionsAndItems(): void {
    this.loading = true;
    this.errorMessage = '';
    this.loadCategoryFilterOptions();

    this.itemService.getOptions().subscribe({
      next: (optionsRes) => {
        this.options = optionsRes.data;
        // Ensure item_type_id is always set (backend requirement).
        this.syncItemTypeIdFromCategory();
        this.loadItems(1);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load item form options.';
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.cancelSearchDebounce();
    this.loadItemsSub?.unsubscribe();
    this.stopItemScanner();
  }

  loadItems(page: number = 1): void {
    this.cancelSearchDebounce();
    this.loading = true;
    this.errorMessage = '';

    this.loadItemsSub?.unsubscribe();
    this.loadItemsSub = this.itemService
      .list({
        page,
        per_page: this.perPage,
        search: this.search || undefined,
        category_id: this.selectedFilterCategoryId || undefined
      })
      .subscribe({
        next: (response) => {
          this.items = response.data.data;
          this.currentPage = response.data.current_page;
          this.totalPages = response.data.last_page;
          this.totalItems = response.data.total;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.message || 'Failed to load items.';
          this.cdr.detectChanges();
        }
      });
  }

  onItemsSearchInput(): void {
    this.cancelSearchDebounce();
    this.searchDebounceId = setTimeout(() => {
      this.searchDebounceId = undefined;
      this.loadItems(1);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearItemsSearchBox(): void {
    this.search = '';
    this.cancelSearchDebounce();
    this.loadItems(1);
  }

  private cancelSearchDebounce(): void {
    if (this.searchDebounceId !== undefined) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = undefined;
    }
  }

  onSearch(): void {
    this.cancelSearchDebounce();
    this.loadItems(1);
  }

  clearSearch(): void {
    this.clearItemsSearchBox();
  }

  loadCategoryFilterOptions(): void {
    this.categoryService.getOptions().subscribe({
      next: (response) => {
        this.categoryFilterOptions = (response.data.categories || [])
          .map((category) => ({
            category_id: category.category_id,
            category_name: category.category_name
          }))
          .sort((a, b) => a.category_name.localeCompare(b.category_name));

        this.applyCategoryFilterSearch();

        if (this.selectedFilterCategoryId) {
          const selected = this.categoryFilterOptions.find(
            (category) => category.category_id === this.selectedFilterCategoryId
          );
          if (selected) {
            this.selectedFilterCategoryName = selected.category_name;
          } else {
            this.selectedFilterCategoryId = null;
            this.selectedFilterCategoryName = 'All categories';
            this.loadItems(1);
          }
        }

        this.cdr.detectChanges();
      },
      error: () => {
        this.categoryFilterOptions = [];
        this.filteredCategoryFilterOptions = [];
        this.cdr.detectChanges();
      }
    });
  }

  toggleCategoryFilterDropdown(): void {
    this.categoryFilterOpen = !this.categoryFilterOpen;
    if (this.categoryFilterOpen) {
      this.categoryFilterQuery = '';
      this.applyCategoryFilterSearch();
      this.activeCategoryOptionIndex = this.getActiveIndexFromSelection();
      this.cdr.detectChanges();
    }
  }

  onCategoryFilterQueryChange(): void {
    this.applyCategoryFilterSearch();
  }

  selectCategoryFilter(category: { category_id: number; category_name: string } | null): void {
    this.selectedFilterCategoryId = category?.category_id ?? null;
    this.selectedFilterCategoryName = category?.category_name ?? 'All categories';
    this.categoryFilterOpen = false;
    this.categoryFilterQuery = '';
    this.activeCategoryOptionIndex = -1;
    this.loadItems(1);
  }

  clearCategoryFilter(event?: Event): void {
    event?.stopPropagation();
    if (!this.selectedFilterCategoryId) {
      return;
    }
    this.selectCategoryFilter(null);
  }

  onCategoryComboboxKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!this.categoryFilterOpen) {
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        this.toggleCategoryFilterDropdown();
      }
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      this.categoryFilterOpen = false;
      this.activeCategoryOptionIndex = -1;
      return;
    }

    if (!this.filteredCategoryFilterOptions.length) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      this.activeCategoryOptionIndex = Math.min(
        this.activeCategoryOptionIndex + 1,
        this.filteredCategoryFilterOptions.length - 1
      );
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      this.activeCategoryOptionIndex = Math.max(this.activeCategoryOptionIndex - 1, 0);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      if (this.activeCategoryOptionIndex >= 0) {
        this.selectCategoryFilter(this.filteredCategoryFilterOptions[this.activeCategoryOptionIndex]);
      }
    }
  }

  onCategoryOptionHover(index: number): void {
    this.activeCategoryOptionIndex = index;
  }

  private applyCategoryFilterSearch(): void {
    const query = this.categoryFilterQuery.trim().toLowerCase();
    this.filteredCategoryFilterOptions = this.categoryFilterOptions.filter((category) => {
      if (!query) {
        return true;
      }
      return category.category_name.toLowerCase().includes(query);
    });

    if (!this.filteredCategoryFilterOptions.length) {
      this.activeCategoryOptionIndex = -1;
      return;
    }

    const selectedIndex = this.filteredCategoryFilterOptions.findIndex(
      (category) => category.category_id === this.selectedFilterCategoryId
    );
    this.activeCategoryOptionIndex = selectedIndex >= 0 ? selectedIndex : 0;
  }

  private getActiveIndexFromSelection(): number {
    if (!this.filteredCategoryFilterOptions.length) {
      return -1;
    }
    const selectedIndex = this.filteredCategoryFilterOptions.findIndex(
      (category) => category.category_id === this.selectedFilterCategoryId
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.categoryFilterOpen) {
      return;
    }

    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    if (!target.closest('.category-filter-combobox')) {
      this.categoryFilterOpen = false;
      this.activeCategoryOptionIndex = -1;
    }
  }

  editItem(item: InventoryItem): void {
    this.selectedItemId = item.item_id;
    this.showForm = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.formData = {
      item_code: item.item_code,
      item_description: item.item_description,
      item_type_id: item.item_type_id,
      category_id: item.category_id,
      measurement_unit: item.measurement_unit || '',
      particular: item.particular || '',
      mg_dosage: item.mg_dosage,
      shelf_life_days: item.shelf_life_days,
      remarks: item.remarks || '',
      unit_value: item.unit_value,
      reorder_level: item.reorder_level,
      is_active: item.is_active
    };
    // Hide Type in UI; derive from category selection for consistency.
    this.syncItemTypeIdFromCategory();

    this.resetSelectedImage();
    this.imagePreviewUrl = item.image_url || null;

    this.cdr.detectChanges();
  }

  /** Show the form for adding a new item (and clear fields). */
  startNew(): void {
    this.selectedItemId = null;
    this.showForm = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.formData = {
      item_code: '',
      item_description: '',
      item_type_id: null,
      category_id: null,
      measurement_unit: '',
      particular: '',
      mg_dosage: null,
      shelf_life_days: null,
      remarks: '',
      unit_value: null,
      reorder_level: 0,
      is_active: true
    };
    this.syncItemTypeIdFromCategory();
    this.resetSelectedImage();
    this.cdr.detectChanges();
  }

  /** Hide the form and go back to list view. */
  closeForm(): void {
    this.showForm = false;
    this.selectedItemId = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.formData = {
      item_code: '',
      item_description: '',
      item_type_id: null,
      category_id: null,
      measurement_unit: '',
      particular: '',
      mg_dosage: null,
      shelf_life_days: null,
      remarks: '',
      unit_value: null,
      reorder_level: 0,
      is_active: true
    };
    this.syncItemTypeIdFromCategory();
    this.resetSelectedImage();
    this.cdr.detectChanges();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.resetSelectedImage();

    if (!file) {
      this.cdr.detectChanges();
      return;
    }

    this.selectedImageFile = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
    this.cdr.detectChanges();
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    // Always derive item_type_id from the selected category right before save.
    this.syncItemTypeIdFromCategory();

    if (!this.formData.item_code.trim() || !this.formData.item_description.trim() || !this.formData.item_type_id) {
      this.errorMessage = 'Please enter item code or SKU, name or description, and select a category.';
      return;
    }

    this.saving = true;

    const payload = this.buildPayload();

    if (this.selectedItemId) {
      this.itemService.update(this.selectedItemId, payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.successMessage = 'Item updated successfully.';
          this.loadItems(this.currentPage);
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.itemService.create(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.successMessage = 'Item registered successfully.';
        this.loadItems(1);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = this.extractError(err);
        this.cdr.detectChanges();
      }
    });
  }

  toggleStatus(item: InventoryItem): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.itemService.updateStatus(item.item_id, !item.is_active).subscribe({
      next: () => {
        this.successMessage = 'Item status updated.';
        this.loadItems(this.currentPage);
      },
      error: (err) => {
        this.errorMessage = this.extractError(err);
        this.cdr.detectChanges();
      }
    });
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadItems(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadItems(this.currentPage + 1);
    }
  }

  openItemQr(item: InventoryItem): void {
    this.errorMessage = '';
    this.qrModalTitle = `Item QR: ${item.item_code}`;
    this.qrLabel = item.qr_label || `ITEM:${item.item_code}`;
    this.qrPayload = item.qr_payload || JSON.stringify({
      entity: 'item',
      item_id: item.item_id,
      item_code: item.item_code,
      item_description: item.item_description,
    });
    this.showQrModal = true;
    this.qrImageDataUrl = null;

    QRCode.toDataURL(this.qrPayload, { width: 280, margin: 2 })
      .then((url: string) => {
        this.qrImageDataUrl = url;
        this.cdr.detectChanges();
      })
      .catch(() => {
        this.showQrModal = false;
        this.errorMessage = 'Unable to generate QR code for this item.';
        this.cdr.detectChanges();
      });
  }

  openItemQrScanner(): void {
    this.showScanModal = true;
    this.scanErrorMessage = '';

    setTimeout(() => {
      this.startItemScanner();
    }, 0);
  }

  closeItemQrScanner(): void {
    this.stopItemScanner();
    this.showScanModal = false;
    this.scanErrorMessage = '';
  }

  private async startItemScanner(): Promise<void> {
    const video = document.getElementById('itemQrVideo') as HTMLVideoElement | null;
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
        this.scanErrorMessage = 'Camera permission denied. Enable camera access in your browser settings to use QR scanner.';
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
      this.itemScannerControls = await this.itemScanner.decodeFromVideoDevice(
        deviceId,
        video,
        (result, error) => {
          if (result) {
            this.handleScannedItemQr(result.getText());
            this.closeItemQrScanner();
            this.cdr.detectChanges();
            return;
          }

          if (error && !(error instanceof NotFoundException)) {
            this.scanErrorMessage = 'Unable to read QR. Please hold it steady and try again.';
            this.cdr.detectChanges();
          }
        }
      );
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        this.scanErrorMessage = 'Camera permission denied. Enable camera access in your browser settings.';
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
      const permissionResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (permissionResult.state === 'denied') {
        return false;
      }

      if (permissionResult.state === 'granted') {
        return true;
      }

      // If 'prompt', user will be asked when trying to access the camera
      // Attempt accessing the camera directly, which will trigger the browser permission prompt
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      // Immediately stop the stream as we only needed to verify permission
      mediaStream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch {
      // If Permissions API fails or getUserMedia fails, permission was denied
      return false;
    }
  }

  private stopItemScanner(): void {
    this.itemScannerControls?.stop();
    this.itemScannerControls = undefined;
  }

  private handleScannedItemQr(rawText: string): void {
    const parsed = this.tryParseQrPayload(rawText);
    const itemCode = parsed?.['item_code'] || this.extractCodeFromLabel(rawText, 'ITEM:') || rawText.trim();

    if (!itemCode) {
      this.errorMessage = 'QR scanned, but no item code was found.';
      return;
    }

    this.search = itemCode;
    this.onSearch();
    this.successMessage = `QR scanned successfully. Filtered items by: ${itemCode}`;
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

  closeQrModal(): void {
    this.showQrModal = false;
    this.qrModalTitle = '';
    this.qrLabel = '';
    this.qrPayload = '';
    this.qrImageDataUrl = null;
  }

  firstPage(): void {
    if (this.currentPage > 1) {
      this.loadItems(1);
    }
  }

  lastPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadItems(this.totalPages);
    }
  }

  onPageSizeChange(): void {
    this.loadItems(1);
  }

  private nullIfEmpty(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private buildPayload(): FormData {
    const payload = new FormData();

    payload.append('item_code', this.formData.item_code.trim());
    payload.append('item_description', this.formData.item_description.trim());
    payload.append('item_type_id', String(this.formData.item_type_id));
    payload.append('category_id', this.formData.category_id === null ? '' : String(this.formData.category_id));
    payload.append('measurement_unit', this.nullIfEmpty(this.formData.measurement_unit) ?? '');
    payload.append('particular', this.nullIfEmpty(this.formData.particular) ?? '');
    payload.append('mg_dosage', this.formData.mg_dosage === null ? '' : String(this.formData.mg_dosage));
    payload.append(
      'shelf_life_days',
      this.formData.shelf_life_days === null ? '' : String(this.formData.shelf_life_days)
    );
    payload.append('remarks', this.nullIfEmpty(this.formData.remarks) ?? '');
    payload.append('unit_value', this.formData.unit_value === null ? '' : String(this.formData.unit_value));
    payload.append(
      'reorder_level',
      String(Number.isFinite(this.formData.reorder_level) ? this.formData.reorder_level : 0)
    );
    payload.append('is_active', this.formData.is_active ? '1' : '0');

    if (this.selectedImageFile) {
      payload.append('image', this.selectedImageFile);
    }

    return payload;
  }

  private resetSelectedImage(): void {
    if (this.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.imagePreviewUrl);
    }

    this.selectedImageFile = null;
    this.imagePreviewUrl = null;
  }

  private extractError(err: unknown): string {
    const errorObject = err as {
      error?: {
        message?: string;
        errors?: Record<string, string[]>;
      };
    };

    const details = errorObject?.error?.errors;
    if (details) {
      const firstField = Object.keys(details)[0];
      const firstMessage = firstField ? details[firstField]?.[0] : null;
      if (firstMessage) {
        return firstMessage;
      }
    }

    return errorObject?.error?.message || 'Request failed. Please check your input and try again.';
  }
}
