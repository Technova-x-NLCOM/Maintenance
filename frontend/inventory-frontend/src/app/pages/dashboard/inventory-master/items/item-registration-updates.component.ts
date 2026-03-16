import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InventoryItem,
  InventoryItemService,
  ItemFormOptions
} from '../../../../services/inventory-item.service';

@Component({
  selector: 'app-item-registration-updates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-registration-updates.component.html',
  styleUrls: ['./item-registration-updates.component.scss']
})
export class ItemRegistrationUpdatesComponent implements OnInit {
  loading = false;
  saving = false;

  items: InventoryItem[] = [];
  options: ItemFormOptions = { item_types: [], categories: [] };

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  perPage = 10;

  search = '';

  selectedItemId: number | null = null;
  /** When true, the Register/Update form is visible. Hidden by default; shown when user clicks New Item or Edit. */
  showForm = false;

  errorMessage = '';
  successMessage = '';
  selectedImageFile: File | null = null;
  imagePreviewUrl: string | null = null;

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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadOptionsAndItems();
  }

  loadOptionsAndItems(): void {
    this.loading = true;
    this.errorMessage = '';

    this.itemService.getOptions().subscribe({
      next: (optionsRes) => {
        this.options = optionsRes.data;
        this.loadItems(1);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load item form options.';
        this.cdr.detectChanges();
      }
    });
  }

  loadItems(page: number = 1): void {
    this.loading = true;
    this.errorMessage = '';

    this.itemService
      .list({
        page,
        per_page: this.perPage,
        search: this.search || undefined
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

  onSearch(): void {
    this.loadItems(1);
  }

  clearSearch(): void {
    this.search = '';
    this.loadItems(1);
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

    if (!this.formData.item_code.trim() || !this.formData.item_description.trim() || !this.formData.item_type_id) {
      this.errorMessage = 'Please enter item code or SKU, name or description, and select a type of item.';
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
