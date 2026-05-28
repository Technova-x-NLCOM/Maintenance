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
  ItemFormOptions,
} from '../../../services/inventory-item.service';
import { InventoryCategoryService } from '../../../services/inventory-category.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-item-registration-updates',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './item-registration-updates.component.html',
  styleUrls: ['./item-registration-updates.component.scss'],
})
export class ItemRegistrationUpdatesComponent implements OnInit, OnDestroy {
  viewMode: 'table' | 'cards' = 'table';
  loading = false;
  saving = false;

  items: InventoryItem[] = [];
  options: ItemFormOptions = { categories: [] };

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  perPage = 10;
  readonly pageSizeOptions = [10, 20, 50];

  search = '';
  selectedFilterCategoryId: number | null = null;
  selectedFilterCategoryName = 'All categories';
  categoryFilterOpen = false;
  categoryFilterQuery = '';
  activeCategoryOptionIndex = -1;
  categoryFilterOptions: Array<{ category_id: number; category_name: string }> = [];
  filteredCategoryFilterOptions: Array<{ category_id: number; category_name: string }> = [];

  formCategoryOpen = false;
  formCategoryQuery = '';
  formActiveCategoryOptionIndex = -1;
  filteredFormCategoryOptions: Array<{ category_id: number; category_name: string }> = [];

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
  isDraggingOver = false;
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
    category_id: null,
    measurement_unit: '',
    particular: '',
    mg_dosage: null,
    shelf_life_days: null,
    remarks: '',
    unit_value: null,
    reorder_level: 0,
    is_active: true,
  };

  constructor(
    private itemService: InventoryItemService,
    private categoryService: InventoryCategoryService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  // Getter to access navigator object in template
  get navigator(): Navigator {
    return navigator;
  }

  get selectedFormCategoryName(): string {
    if (!this.formData.category_id) {
      return 'Select category';
    }

    const category = this.options.categories.find(
      (entry) => entry.category_id === this.formData.category_id,
    );

    return category?.category_name ?? 'Select category';
  }

  ngOnInit(): void {
    this.loadOptionsAndItems();
  }

  onCategoryChange(): void {
    // Category change handler kept for future dependent-field behavior.
  }

  loadOptionsAndItems(): void {
    this.loading = true;
    this.errorMessage = '';
    this.loadCategoryFilterOptions();

    this.itemService.getOptions().subscribe({
      next: (optionsRes) => {
        this.options = optionsRes.data;
        this.applyFormCategorySearch();
        this.loadItems(1);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load item form options.';
        this.cdr.detectChanges();
      },
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
        category_id: this.selectedFilterCategoryId || undefined,
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
        },
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
            category_name: category.category_name,
          }))
          .sort((a, b) => a.category_name.localeCompare(b.category_name));

        this.applyCategoryFilterSearch();

        if (this.selectedFilterCategoryId) {
          const selected = this.categoryFilterOptions.find(
            (category) => category.category_id === this.selectedFilterCategoryId,
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
      },
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
        this.filteredCategoryFilterOptions.length - 1,
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
        this.selectCategoryFilter(
          this.filteredCategoryFilterOptions[this.activeCategoryOptionIndex],
        );
      }
    }
  }

  onCategoryOptionHover(index: number): void {
    this.activeCategoryOptionIndex = index;
  }

  toggleFormCategoryDropdown(): void {
    this.formCategoryOpen = !this.formCategoryOpen;
    if (this.formCategoryOpen) {
      this.formCategoryQuery = '';
      this.applyFormCategorySearch();
      this.formActiveCategoryOptionIndex = this.getFormActiveIndexFromSelection();
      this.cdr.detectChanges();
    }
  }

  onFormCategoryQueryChange(): void {
    this.applyFormCategorySearch();
  }

  selectFormCategory(category: { category_id: number; category_name: string }): void {
    this.formData.category_id = category.category_id;
    this.formCategoryOpen = false;
    this.formCategoryQuery = '';
    this.formActiveCategoryOptionIndex = -1;
    this.onCategoryChange();
    this.cdr.detectChanges();
  }

  clearFormCategory(event?: Event): void {
    event?.stopPropagation();
    if (!this.formData.category_id) {
      return;
    }

    this.formData.category_id = null;
    this.formCategoryOpen = false;
    this.formCategoryQuery = '';
    this.formActiveCategoryOptionIndex = -1;
    this.onCategoryChange();
    this.cdr.detectChanges();
  }

  onFormCategoryComboboxKeydown(event: KeyboardEvent): void {
    const key = event.key;

    if (!this.formCategoryOpen) {
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        this.toggleFormCategoryDropdown();
      }
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      this.formCategoryOpen = false;
      this.formActiveCategoryOptionIndex = -1;
      return;
    }

    if (!this.filteredFormCategoryOptions.length) {
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      this.formActiveCategoryOptionIndex = Math.min(
        this.formActiveCategoryOptionIndex + 1,
        this.filteredFormCategoryOptions.length - 1,
      );
      return;
    }

    if (key === 'ArrowUp') {
      event.preventDefault();
      this.formActiveCategoryOptionIndex = Math.max(this.formActiveCategoryOptionIndex - 1, 0);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      if (this.formActiveCategoryOptionIndex >= 0) {
        this.selectFormCategory(
          this.filteredFormCategoryOptions[this.formActiveCategoryOptionIndex],
        );
      }
    }
  }

  onFormCategoryOptionHover(index: number): void {
    this.formActiveCategoryOptionIndex = index;
  }

  private resetFormCategoryCombobox(): void {
    this.formCategoryOpen = false;
    this.formCategoryQuery = '';
    this.formActiveCategoryOptionIndex = -1;
    this.applyFormCategorySearch();
  }

  private applyFormCategorySearch(): void {
    const query = this.formCategoryQuery.trim().toLowerCase();
    this.filteredFormCategoryOptions = (this.options.categories || []).filter((category) => {
      if (!query) {
        return true;
      }
      return category.category_name.toLowerCase().includes(query);
    });

    if (!this.filteredFormCategoryOptions.length) {
      this.formActiveCategoryOptionIndex = -1;
      return;
    }

    const selectedIndex = this.filteredFormCategoryOptions.findIndex(
      (category) => category.category_id === this.formData.category_id,
    );
    this.formActiveCategoryOptionIndex = selectedIndex >= 0 ? selectedIndex : 0;
  }

  private getFormActiveIndexFromSelection(): number {
    if (!this.filteredFormCategoryOptions.length) {
      return -1;
    }

    const selectedIndex = this.filteredFormCategoryOptions.findIndex(
      (category) => category.category_id === this.formData.category_id,
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
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
      (category) => category.category_id === this.selectedFilterCategoryId,
    );
    this.activeCategoryOptionIndex = selectedIndex >= 0 ? selectedIndex : 0;
  }

  private getActiveIndexFromSelection(): number {
    if (!this.filteredCategoryFilterOptions.length) {
      return -1;
    }
    const selectedIndex = this.filteredCategoryFilterOptions.findIndex(
      (category) => category.category_id === this.selectedFilterCategoryId,
    );
    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    if (this.categoryFilterOpen && !target.closest('[data-category-combobox="filter"]')) {
      this.categoryFilterOpen = false;
      this.activeCategoryOptionIndex = -1;
    }

    if (this.formCategoryOpen && !target.closest('[data-category-combobox="form"]')) {
      this.formCategoryOpen = false;
      this.formActiveCategoryOptionIndex = -1;
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
      category_id: item.category_id,
      measurement_unit: item.measurement_unit || '',
      particular: item.particular || '',
      mg_dosage: item.mg_dosage,
      shelf_life_days: item.shelf_life_days,
      remarks: item.remarks || '',
      unit_value: item.unit_value,
      reorder_level: item.reorder_level,
      is_active: item.is_active,
    };
    this.resetSelectedImage();
    this.imagePreviewUrl = item.image_url || null;
    this.resetFormCategoryCombobox();

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
      category_id: null,
      measurement_unit: '',
      particular: '',
      mg_dosage: null,
      shelf_life_days: null,
      remarks: '',
      unit_value: null,
      reorder_level: 0,
      is_active: true,
    };
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
      category_id: null,
      measurement_unit: '',
      particular: '',
      mg_dosage: null,
      shelf_life_days: null,
      remarks: '',
      unit_value: null,
      reorder_level: 0,
      is_active: true,
    };
    this.resetSelectedImage();
    this.resetFormCategoryCombobox();
    this.cdr.detectChanges();
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

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.resetSelectedImage();
    if (!file) { this.cdr.detectChanges(); return; }
    this.compressImage(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file || !file.type.startsWith('image/')) return;
    this.resetSelectedImage();
    this.compressImage(file);
  }

  compressImage(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        // Convert base64 back to File so the existing buildPayload() still works
        const byteString = atob(compressed.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        this.selectedImageFile = new File([ab], file.name, { type: 'image/jpeg' });
        this.imagePreviewUrl = compressed;
        this.cdr.detectChanges();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.resetSelectedImage();
    this.cdr.detectChanges();
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (
      !this.formData.item_code.trim() ||
      !this.formData.item_description.trim() ||
      !this.formData.category_id
    ) {
      this.toast.error('Please fill out all required fields (*)');
      return;
    }

    // Validate length limits
    if (this.formData.item_code.length > 50) {
      this.toast.error('Item code must be 50 characters or less.');
      return;
    }

    if (this.formData.item_description.length > 100) {
      this.toast.error('Item name/description must be 100 characters or less.');
      return;
    }

    if (this.formData.measurement_unit && this.formData.measurement_unit.length > 30) {
      this.toast.error('Unit of measure must be 30 characters or less.');
      return;
    }

    if (this.formData.particular && this.formData.particular.length > 500) {
      this.toast.error('Additional details must be 500 characters or less.');
      return;
    }

    if (this.formData.remarks && this.formData.remarks.length > 500) {
      this.toast.error('Notes must be 500 characters or less.');
      return;
    }

    if (this.formData.mg_dosage !== null && String(this.formData.mg_dosage).length > 50) {
      this.toast.error('Dosage value is too long (max 50 characters).');
      return;
    }

    if (this.formData.shelf_life_days !== null && String(this.formData.shelf_life_days).length > 50) {
      this.toast.error('Shelf life value is too long (max 50 characters).');
      return;
    }

    this.saving = true;

    const payload = this.buildPayload();

    if (this.selectedItemId) {
      this.itemService.update(this.selectedItemId, payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.toast.success('Item updated successfully.');
          this.loadItems(this.currentPage);
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(this.extractError(err));
          this.cdr.detectChanges();
        },
      });
      return;
    }

    this.itemService.create(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.toast.success('New Item registered successfully.');
        this.loadItems(1);
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(this.extractError(err));
        this.cdr.detectChanges();
      },
    });
  }

  toggleStatus(item: InventoryItem): void {
    this.errorMessage = '';
    this.successMessage = '';

    this.itemService.updateStatus(item.item_id, !item.is_active).subscribe({
      next: () => {
        this.toast.success('Item status updated.');
        this.loadItems(this.currentPage);
      },
      error: (err) => {
        this.toast.error(this.extractError(err));
        this.cdr.detectChanges();
      },
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
    this.qrPayload =
      item.qr_payload ||
      JSON.stringify({
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

  // QR Code Download Methods
  downloadQrCode(item?: InventoryItem): void {
    if (!this.qrImageDataUrl) {
      this.toast.error('QR code not ready for download');
      return;
    }

    try {
      const itemCode = item?.item_code || this.qrLabel.replace('ITEM:', '') || 'item';
      const filename = `QR_${itemCode}_${new Date().toISOString().slice(0, 10)}.png`;
      
      // Create download link
      const link = document.createElement('a');
      link.href = this.qrImageDataUrl;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.toast.success(`QR code downloaded: ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      this.toast.error('Failed to download QR code');
    }
  }

  printQrCode(): void {
    if (!this.qrImageDataUrl) {
      this.toast.error('QR code not ready for printing');
      return;
    }

    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        this.toast.error('Please allow popups to print QR codes');
        return;
      }

      // Generate print-friendly HTML
      const printContent = this.generatePrintableQrHtml();
      
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Wait for image to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
      
      this.toast.success('QR code sent to printer');
    } catch (error) {
      console.error('Print failed:', error);
      this.toast.error('Failed to print QR code');
    }
  }

  copyQrToClipboard(): void {
    if (!this.qrImageDataUrl) {
      this.toast.error('QR code not ready for copying');
      return;
    }

    try {
      // Convert data URL to blob
      fetch(this.qrImageDataUrl)
        .then(res => res.blob())
        .then(blob => {
          // Use modern Clipboard API if available
          if (navigator.clipboard && window.ClipboardItem) {
            const item = new ClipboardItem({ 'image/png': blob });
            return navigator.clipboard.write([item]);
          } else {
            // Fallback: copy the data URL as text
            return navigator.clipboard.writeText(this.qrImageDataUrl!);
          }
        })
        .then(() => {
          this.toast.success('QR code copied to clipboard');
        })
        .catch(() => {
          // Final fallback: copy payload as text
          navigator.clipboard.writeText(this.qrPayload)
            .then(() => {
              this.toast.success('QR code data copied as text');
            })
            .catch(() => {
              this.toast.error('Failed to copy QR code');
            });
        });
    } catch (error) {
      console.error('Copy failed:', error);
      this.toast.error('Failed to copy QR code');
    }
  }

  shareQrCode(): void {
    if (!this.qrImageDataUrl) {
      this.toast.error('QR code not ready for sharing');
      return;
    }

    try {
      // Check if Web Share API is supported
      if (navigator.share) {
        // Convert data URL to blob for sharing
        fetch(this.qrImageDataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `QR_${this.qrLabel}.png`, { type: 'image/png' });
            return navigator.share({
              title: `QR Code: ${this.qrLabel}`,
              text: `QR code for inventory item: ${this.qrLabel}`,
              files: [file]
            });
          })
          .then(() => {
            this.toast.success('QR code shared successfully');
          })
          .catch((error) => {
            if (error.name !== 'AbortError') {
              console.error('Share failed:', error);
              this.fallbackShare();
            }
          });
      } else {
        this.fallbackShare();
      }
    } catch (error) {
      console.error('Share failed:', error);
      this.fallbackShare();
    }
  }

  private fallbackShare(): void {
    // Fallback: copy to clipboard and show instructions
    this.copyQrToClipboard();
    this.toast.success('QR code copied! You can now paste it in other apps');
  }

  private generatePrintableQrHtml(): string {
    const itemCode = this.qrLabel.replace('ITEM:', '') || 'Item';
    const currentDate = new Date().toLocaleDateString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${itemCode}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: white;
          }
          
          .qr-print-container {
            text-align: center;
            max-width: 400px;
            border: 2px solid #333;
            padding: 20px;
            border-radius: 8px;
            background: white;
          }
          
          .qr-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
          }
          
          .qr-image {
            margin: 15px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px;
            background: white;
          }
          
          .qr-image img {
            max-width: 100%;
            height: auto;
            display: block;
          }
          
          .qr-label {
            font-size: 16px;
            font-weight: 600;
            margin: 10px 0;
            color: #333;
            word-break: break-all;
          }
          
          .qr-instructions {
            font-size: 12px;
            color: #666;
            margin-top: 15px;
            line-height: 1.4;
          }
          
          .qr-footer {
            font-size: 10px;
            color: #999;
            margin-top: 20px;
            border-top: 1px solid #eee;
            padding-top: 10px;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .qr-print-container {
              border: 2px solid #000;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-print-container">
          <div class="qr-title">Inventory Item QR Code</div>
          <div class="qr-image">
            <img src="${this.qrImageDataUrl}" alt="QR Code for ${itemCode}" />
          </div>
          <div class="qr-label">${this.qrLabel}</div>
          <div class="qr-instructions">
            Scan this QR code with the inventory app to quickly identify this item.
            <br>Attach this label to the item or storage location.
          </div>
          <div class="qr-footer">
            Generated: ${currentDate} | Inventory Management System
          </div>
        </div>
      </body>
      </html>
    `;
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
      this.itemScannerControls = await this.itemScanner.decodeFromVideoDevice(
        deviceId,
        video,
        (result: any, error: any) => {
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

  private stopItemScanner(): void {
    this.itemScannerControls?.stop();
    this.itemScannerControls = undefined;
  }

  private handleScannedItemQr(rawText: string): void {
    const parsed = this.tryParseQrPayload(rawText);
    const itemCode =
      parsed?.['item_code'] || this.extractCodeFromLabel(rawText, 'ITEM:') || rawText.trim();

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
    payload.append(
      'category_id',
      this.formData.category_id === null ? '' : String(this.formData.category_id),
    );
    payload.append('measurement_unit', this.nullIfEmpty(this.formData.measurement_unit) ?? '');
    payload.append('particular', this.nullIfEmpty(this.formData.particular) ?? '');
    payload.append(
      'mg_dosage',
      this.formData.mg_dosage === null ? '' : String(this.formData.mg_dosage),
    );
    payload.append(
      'shelf_life_days',
      this.formData.shelf_life_days === null ? '' : String(this.formData.shelf_life_days),
    );
    payload.append('remarks', this.nullIfEmpty(this.formData.remarks) ?? '');
    payload.append(
      'unit_value',
      this.formData.unit_value === null ? '' : String(this.formData.unit_value),
    );
    payload.append(
      'reorder_level',
      String(Number.isFinite(this.formData.reorder_level) ? this.formData.reorder_level : 0),
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
