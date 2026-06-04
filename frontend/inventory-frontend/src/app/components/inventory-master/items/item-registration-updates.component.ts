import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  InventoryItem,
  InventoryItemService,
  ItemFormOptions,
} from '../../../services/inventory-item.service';
import { InventoryCategoryService } from '../../../services/inventory-category.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import {
  ExcelImportComponent,
  ImportCategoryOption,
  ImportColumn,
  ImportConflict,
  ImportResult,
  ImportRow,
} from './excel-import/excel-import.component';
import { ModalUtils } from '../../../shared/utils/modal.utils';

@Component({
  selector: 'app-item-registration-updates',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent, ExcelImportComponent],
  templateUrl: './item-registration-updates.component.html',
  styleUrls: ['./item-registration-updates.component.scss'],
})
export class ItemRegistrationUpdatesComponent implements OnInit, OnDestroy {
  viewMode: 'table' | 'cards' = 'table';
  loading = false;
  saving = false;

  // ── Excel import ──────────────────────────────────────────────────────────
  showImportModal = false;

  readonly importColumns: ImportColumn[] = [
    {
      key: 'item_description',
      label: 'Item Description',
      required: true,
      aliases: ['ITEM', 'Item', 'Item Name', 'Name'],
    },
    {
      key: 'particular',
      label: 'Particular',
      required: false,
      // "DESCRIPTION" in Mobile Kitchen = extra notes; "Particular" in Medicines = unit
      // We keep this as the unit-of-measure field (measurement_unit in DB)
      aliases: ['DESCRIPTION', 'Description', 'Details', 'Additional Details'],
    },
    {
      key: 'mg_dosage',
      label: 'Dosage (mg)',
      required: false,
      aliases: ['MG', 'mg', 'Dosage', 'Dosage mg'],
      transform: (v) => {
        const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
        return isNaN(n) ? null : n;
      },
    },
    {
      key: 'reorder_level',
      label: 'Reorder Level',
      required: false,
      aliases: ['Reorder', 'Min Stock'],
      transform: (v) => {
        const n = parseInt(String(v ?? ''), 10);
        return isNaN(n) ? 0 : n;
      },
    },
    {
      key: 'shelf_life_days',
      label: 'Shelf Life (Days)',
      required: false,
      aliases: ['Shelf Life', 'Shelf Life Days'],
      transform: (v) => {
        const n = parseInt(String(v ?? ''), 10);
        return isNaN(n) ? null : n;
      },
    },
    {
      key: 'unit_value',
      label: 'Unit Value',
      required: false,
      aliases: ['Value', 'Price', 'Cost'],
      transform: (v) => {
        const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
        return isNaN(n) ? null : n;
      },
    },
    {
      key: 'remarks',
      label: 'Remarks',
      required: false,
      aliases: ['Remarks / latest doc update', 'Notes', 'Note', 'Comment'],
    },
  ];

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
  // QR UI and scanner removed.

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

  /** Category list passed to the import modal dropdown */
  get importCategoryOptions(): ImportCategoryOption[] {
    return (this.options.categories || [])
      .slice()
      .sort((a, b) => a.category_name.localeCompare(b.category_name));
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
    ModalUtils.bounce(`.${selector}`);
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
      !this.formData.item_description.trim()
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
      this.toast.error('Particular must be 30 characters or less.');
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
    // QR generation removed.
  }

  // QR Code Download Methods
  downloadQrCode(item?: InventoryItem): void {
    // QR download removed.
  }

  openItemQrScanner(): void {
    // QR scanner removed.
  }

  closeItemQrScanner(): void {
    // QR scanner removed.
  }

  private async startItemScanner(): Promise<void> {
    // QR scanner removed.
  }

  private async requestCameraPermission(): Promise<boolean> {
    // QR scanner removed.
    return false;
  }

  private stopItemScanner(): void {
    // QR scanner removed.
  }

  private handleScannedItemQr(rawText: string): void {
    // QR scanner removed.
  }

  private tryParseQrPayload(rawText: string): Record<string, string> | null {
    return null;
  }

  private extractCodeFromLabel(value: string, prefix: string): string | null {
    return null;
  }

  closeQrModal(): void {
    // QR modal removed.
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

  // ── Excel import handlers ─────────────────────────────────────────────────

  @ViewChild('importModal') importComponent?: ExcelImportComponent;

  /** Map of lowercase description → full InventoryItem for duplicate detection */
  private existingItemsMap = new Map<string, InventoryItem>();

  openImportModal(): void {
    this.showImportModal = true;
    this.existingItemsMap.clear();

    // Fetch all items to build the duplicate-check map
    this.itemService.list({ page: 1, per_page: 9999 }).subscribe({
      next: (res) => {
        for (const item of res.data.data) {
          this.existingItemsMap.set(item.item_description.trim().toLowerCase(), item);
        }
      },
      error: () => {
        // Non-fatal — conflict check will be skipped if this fails
      },
    });

    this.cdr.detectChanges();
  }

  onImportClosed(hadSuccess: boolean): void {
    this.showImportModal = false;
    this.existingItemsMap.clear();
    if (hadSuccess) {
      this.loadItems(1);
    }
    this.cdr.detectChanges();
  }

  onImportRow(event: { row: ImportRow; resolve: (result: ImportResult) => void }): void {
    const { row, resolve } = event;
    const d = row.data;

    const categoryId = d['_selectedCategoryId'] != null ? Number(d['_selectedCategoryId']) : null;
    const description = String(d['item_description'] ?? '').trim();
    const autoCode = 'ITEM-' + String(row.rowNumber).padStart(3, '0');
    const measurementUnit = String(d['particular'] ?? '').trim();
    const descKey = description.toLowerCase();

    const doCreate = () => {
      const payload = new FormData();
      payload.append('item_code', autoCode);
      payload.append('item_description', description);
      payload.append('category_id', categoryId !== null ? String(categoryId) : '');
      payload.append('measurement_unit', measurementUnit);
      payload.append('particular', '');
      payload.append('remarks', String(d['remarks'] ?? '').trim());
      payload.append('reorder_level', String(Number.isFinite(d['reorder_level']) ? d['reorder_level'] : 0));
      payload.append('shelf_life_days', d['shelf_life_days'] != null ? String(d['shelf_life_days']) : '');
      payload.append('unit_value', d['unit_value'] != null ? String(d['unit_value']) : '');
      payload.append('mg_dosage', d['mg_dosage'] != null ? String(d['mg_dosage']) : '');
      payload.append('is_active', '1');

      this.itemService.create(payload).subscribe({
        next: () => {
          // Register so within-file duplicates are also caught
          if (descKey) this.existingItemsMap.set(descKey, { item_description: description } as InventoryItem);
          resolve({ rowNumber: row.rowNumber, status: 'success', message: 'Imported successfully.' });
        },
        error: (err) => {
          resolve({ rowNumber: row.rowNumber, status: 'error', message: this.extractError(err) });
        },
      });
    };

    const doUpdate = (existingItem: InventoryItem) => {
      const payload = new FormData();
      payload.append('_method', 'PUT');
      payload.append('item_code', existingItem.item_code);
      payload.append('item_description', description);
      payload.append('category_id', categoryId !== null ? String(categoryId) : String(existingItem.category_id ?? ''));
      payload.append('measurement_unit', measurementUnit || existingItem.measurement_unit || '');
      payload.append('particular', existingItem.particular || '');
      payload.append('remarks', String(d['remarks'] ?? '').trim() || existingItem.remarks || '');
      payload.append('reorder_level', String(existingItem.reorder_level ?? 0));
      payload.append('shelf_life_days', existingItem.shelf_life_days != null ? String(existingItem.shelf_life_days) : '');
      payload.append('unit_value', existingItem.unit_value != null ? String(existingItem.unit_value) : '');
      payload.append('mg_dosage', existingItem.mg_dosage != null ? String(existingItem.mg_dosage) : '');
      payload.append('is_active', existingItem.is_active ? '1' : '0');

      this.itemService.update(existingItem.item_id, payload).subscribe({
        next: () => {
          resolve({ rowNumber: row.rowNumber, status: 'success', message: 'Updated existing item.' });
        },
        error: (err) => {
          resolve({ rowNumber: row.rowNumber, status: 'error', message: this.extractError(err) });
        },
      });
    };

    // ── Duplicate check ───────────────────────────────────────────────────────
    const existingItem = descKey ? this.existingItemsMap.get(descKey) : undefined;

    if (existingItem) {
      // Show conflict modal — import pauses until user decides
      const conflict: ImportConflict = {
        incoming: row,
        existing: {
          'Item Description': existingItem.item_description,
          'Particular (UoM)': existingItem.measurement_unit || '—',
          'Category': existingItem.category_name || '—',
          'Remarks': existingItem.remarks || '—',
        },
        resolve: (useFileValues: boolean) => {
          if (useFileValues) {
            doUpdate(existingItem);
          } else {
            resolve({ rowNumber: row.rowNumber, status: 'error', message: 'Kept existing — skipped.' });
          }
          this.cdr.detectChanges();
        },
      };

      const existingFields = [
        { label: 'Item Description', value: existingItem.item_description },
        { label: 'Particular (UoM)', value: existingItem.measurement_unit || '' },
        { label: 'Category', value: existingItem.category_name || '' },
        { label: 'Remarks', value: existingItem.remarks || '' },
      ];

      const incomingFields = [
        { label: 'Item Description', value: description },
        { label: 'Particular (UoM)', value: measurementUnit },
        { label: 'Category', value: this.importCategoryOptions.find(c => c.category_id === categoryId)?.category_name || '' },
        { label: 'Remarks', value: String(d['remarks'] ?? '') },
      ];

      this.importComponent?.showConflict(conflict, existingFields, incomingFields);
      this.cdr.detectChanges();
      return;
    }

    doCreate();
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
