import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  CategoryItem,
  InventoryCategory,
  InventoryCategoryService
} from '../../../../services/inventory-category.service';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-management.component.html',
  styleUrls: ['./category-management.component.scss']
})
export class CategoryManagementComponent implements OnInit, OnDestroy {
  loading = false;
  saving = false;
  managingItems = false;
  assigningItem = false;
  deletingCategoryId: number | null = null;
  removingItemId: number | null = null;
  categories: InventoryCategory[] = [];
  parentOptions: InventoryCategory[] = [];
  categoryItems: CategoryItem[] = [];
  assignableItems: CategoryItem[] = [];

  search = '';
  showForm = false;
  showItemsModal = false;
  selectedCategoryId: number | null = null;
  selectedCategoryForItems: InventoryCategory | null = null;
  errorMessage = '';
  successMessage = '';
  modalErrorMessage = '';
  modalSuccessMessage = '';
  itemSearch = '';
  assignSearch = '';
  selectedAssignableItemIds: number[] = [];

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadCategoriesSub?: Subscription;
  private catsSearchDebounce?: ReturnType<typeof setTimeout>;
  private categoriesBaseline: InventoryCategory[] | null = null;

  private loadCatItemsSub?: Subscription;
  private itemSearchDebounce?: ReturnType<typeof setTimeout>;
  private categoryItemsBaseline: CategoryItem[] | null = null;

  private loadAssignableSub?: Subscription;
  private assignSearchDebounce?: ReturnType<typeof setTimeout>;
  private assignableItemsBaseline: CategoryItem[] | null = null;

  formData: {
    category_name: string;
    parent_category_id: number | null;
    description: string;
  } = {
    category_name: '',
    parent_category_id: null,
    description: ''
  };

  constructor(
    private categoryService: InventoryCategoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.cancelCatsSearchDebounce();
    this.cancelItemSearchDebounce();
    this.cancelAssignSearchDebounce();
    this.loadCategoriesSub?.unsubscribe();
    this.loadCatItemsSub?.unsubscribe();
    this.loadAssignableSub?.unsubscribe();
  }

  loadCategories(): void {
    this.cancelCatsSearchDebounce();
    this.loading = true;
    this.errorMessage = '';

    this.loadCategoriesSub?.unsubscribe();
    this.loadCategoriesSub = this.categoryService.list(this.search || undefined).subscribe({
      next: (response) => {
        this.categories = response.data;
        this.parentOptions = response.data;
        if (!this.search.trim()) {
          this.categoriesBaseline = response.data.slice();
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Failed to load categories.';
        this.cdr.detectChanges();
      }
    });
  }

  onCategoriesSearchInput(): void {
    this.cancelCatsSearchDebounce();
    if (!this.search.trim()) {
      this.loadCategoriesSub?.unsubscribe();
      this.loading = false;
      this.errorMessage = '';
      this.restoreCategoriesBaseline();
      return;
    }
    this.catsSearchDebounce = setTimeout(() => {
      this.catsSearchDebounce = undefined;
      this.loadCategories();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearCategoriesSearchBox(): void {
    this.search = '';
    this.cancelCatsSearchDebounce();
    this.loadCategoriesSub?.unsubscribe();
    this.loading = false;
    this.errorMessage = '';
    this.restoreCategoriesBaseline();
  }

  private cancelCatsSearchDebounce(): void {
    if (this.catsSearchDebounce !== undefined) {
      clearTimeout(this.catsSearchDebounce);
      this.catsSearchDebounce = undefined;
    }
  }

  private restoreCategoriesBaseline(): void {
    if (this.categoriesBaseline) {
      this.categories = this.categoriesBaseline.slice();
      this.parentOptions = this.categories;
      this.cdr.detectChanges();
      return;
    }
    this.loadCategories();
  }

  onSearch(): void {
    this.cancelCatsSearchDebounce();
    this.loadCategories();
  }

  clearSearch(): void {
    this.clearCategoriesSearchBox();
  }

  startNew(): void {
    this.selectedCategoryId = null;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.formData = {
      category_name: '',
      parent_category_id: null,
      description: ''
    };
    this.cdr.detectChanges();
  }

  editCategory(category: InventoryCategory): void {
    this.selectedCategoryId = category.category_id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.formData = {
      category_name: category.category_name,
      parent_category_id: category.parent_category_id,
      description: category.description || ''
    };
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.selectedCategoryId = null;
    this.errorMessage = '';
    this.formData = {
      category_name: '',
      parent_category_id: null,
      description: ''
    };
    this.cdr.detectChanges();
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.formData.category_name.trim()) {
      this.errorMessage = 'Please enter a category name.';
      return;
    }

    this.saving = true;

    const payload = {
      category_name: this.formData.category_name.trim(),
      parent_category_id: this.formData.parent_category_id,
      description: this.nullIfEmpty(this.formData.description)
    };

    if (this.selectedCategoryId) {
      this.categoryService.update(this.selectedCategoryId, payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.successMessage = 'Category updated successfully.';
          this.loadCategories();
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
      return;
    }

    this.categoryService.create(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.successMessage = 'Category created successfully.';
        this.loadCategories();
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = this.extractError(err);
        this.cdr.detectChanges();
      }
    });
  }

  deleteCategory(category: InventoryCategory): void {
    const confirmed = confirm(`Delete category "${category.category_name}"?`);
    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.deletingCategoryId = category.category_id;

    this.categoryService.delete(category.category_id).subscribe({
      next: (response) => {
        this.deletingCategoryId = null;
        this.successMessage = response.message;
        this.loadCategories();
      },
      error: (err) => {
        this.deletingCategoryId = null;
        this.errorMessage = this.extractError(err);
        this.cdr.detectChanges();
      }
    });
  }

  openManageItems(category: InventoryCategory): void {
    this.selectedCategoryForItems = category;
    this.showItemsModal = true;
    this.modalErrorMessage = '';
    this.modalSuccessMessage = '';
    this.itemSearch = '';
    this.assignSearch = '';
    this.categoryItemsBaseline = null;
    this.assignableItemsBaseline = null;
    this.selectedAssignableItemIds = [];
    this.loadCategoryItems();
    this.loadAssignableItems();
    this.cdr.detectChanges();
  }

  closeItemsModal(): void {
    this.showItemsModal = false;
    this.selectedCategoryForItems = null;
    this.categoryItems = [];
    this.assignableItems = [];
    this.selectedAssignableItemIds = [];
    this.modalErrorMessage = '';
    this.modalSuccessMessage = '';
    this.cdr.detectChanges();
  }

  loadCategoryItems(): void {
    if (!this.selectedCategoryForItems) {
      return;
    }

    this.cancelItemSearchDebounce();
    this.managingItems = true;
    this.modalErrorMessage = '';

    this.loadCatItemsSub?.unsubscribe();
    this.loadCatItemsSub = this.categoryService
      .listCategoryItems(this.selectedCategoryForItems.category_id, this.itemSearch || undefined)
      .subscribe({
        next: (response) => {
          this.categoryItems = response.data;
          if (!this.itemSearch.trim()) {
            this.categoryItemsBaseline = response.data.slice();
          }
          this.managingItems = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.managingItems = false;
          this.modalErrorMessage = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
  }

  onCategoryItemsSearchInput(): void {
    this.cancelItemSearchDebounce();
    if (!this.itemSearch.trim()) {
      this.loadCatItemsSub?.unsubscribe();
      this.managingItems = false;
      this.restoreCategoryItemsBaseline();
      return;
    }
    this.itemSearchDebounce = setTimeout(() => {
      this.itemSearchDebounce = undefined;
      this.loadCategoryItems();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearCategoryItemsSearchBox(): void {
    this.itemSearch = '';
    this.cancelItemSearchDebounce();
    this.loadCatItemsSub?.unsubscribe();
    this.managingItems = false;
    this.restoreCategoryItemsBaseline();
  }

  private cancelItemSearchDebounce(): void {
    if (this.itemSearchDebounce !== undefined) {
      clearTimeout(this.itemSearchDebounce);
      this.itemSearchDebounce = undefined;
    }
  }

  private restoreCategoryItemsBaseline(): void {
    if (this.categoryItemsBaseline) {
      this.categoryItems = this.categoryItemsBaseline.slice();
      this.cdr.detectChanges();
      return;
    }
    this.loadCategoryItems();
  }

  loadAssignableItems(): void {
    this.cancelAssignSearchDebounce();
    this.loadAssignableSub?.unsubscribe();
    this.loadAssignableSub = this.categoryService
      .listAssignableItems(this.assignSearch || undefined, this.selectedCategoryForItems?.category_id)
      .subscribe({
      next: (response) => {
        this.assignableItems = response.data;
        if (!this.assignSearch.trim()) {
          this.assignableItemsBaseline = response.data.slice();
        }
        this.selectedAssignableItemIds = this.selectedAssignableItemIds.filter((id) =>
          this.assignableItems.some((item) => item.item_id === id)
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.modalErrorMessage = this.extractError(err);
        this.cdr.detectChanges();
      }
    });
  }

  onAssignSearchInput(): void {
    this.cancelAssignSearchDebounce();
    if (!this.assignSearch.trim()) {
      this.loadAssignableSub?.unsubscribe();
      this.restoreAssignableBaseline();
      return;
    }
    this.assignSearchDebounce = setTimeout(() => {
      this.assignSearchDebounce = undefined;
      this.loadAssignableItems();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearAssignSearchBox(): void {
    this.assignSearch = '';
    this.cancelAssignSearchDebounce();
    this.loadAssignableSub?.unsubscribe();
    this.restoreAssignableBaseline();
  }

  private cancelAssignSearchDebounce(): void {
    if (this.assignSearchDebounce !== undefined) {
      clearTimeout(this.assignSearchDebounce);
      this.assignSearchDebounce = undefined;
    }
  }

  private restoreAssignableBaseline(): void {
    if (this.assignableItemsBaseline) {
      this.assignableItems = this.assignableItemsBaseline.slice();
      this.selectedAssignableItemIds = this.selectedAssignableItemIds.filter((id) =>
        this.assignableItems.some((item) => item.item_id === id)
      );
      this.cdr.detectChanges();
      return;
    }
    this.loadAssignableItems();
  }

  assignSelectedItem(): void {
    if (!this.selectedCategoryForItems || this.selectedAssignableItemIds.length === 0) {
      this.modalErrorMessage = 'Please select one or more items to assign.';
      return;
    }

    this.assigningItem = true;
    this.modalErrorMessage = '';
    this.modalSuccessMessage = '';

    this.categoryService
      .assignItems(this.selectedCategoryForItems.category_id, this.selectedAssignableItemIds)
      .subscribe({
        next: (response) => {
          this.assigningItem = false;
          this.modalSuccessMessage = response.message;
          this.selectedAssignableItemIds = [];
          this.loadCategoryItems();
          this.loadAssignableItems();
          this.loadCategories();
        },
        error: (err) => {
          this.assigningItem = false;
          this.modalErrorMessage = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
  }

  toggleAssignableItem(itemId: number, checked: boolean): void {
    if (checked) {
      if (!this.selectedAssignableItemIds.includes(itemId)) {
        this.selectedAssignableItemIds = [...this.selectedAssignableItemIds, itemId];
      }
      return;
    }

    this.selectedAssignableItemIds = this.selectedAssignableItemIds.filter((id) => id !== itemId);
  }

  isAssignableItemSelected(itemId: number): boolean {
    return this.selectedAssignableItemIds.includes(itemId);
  }

  toggleSelectAllAssignable(checked: boolean): void {
    if (checked) {
      this.selectedAssignableItemIds = this.assignableItems.map((item) => item.item_id);
      return;
    }

    this.selectedAssignableItemIds = [];
  }

  areAllAssignableSelected(): boolean {
    return this.assignableItems.length > 0 && this.selectedAssignableItemIds.length === this.assignableItems.length;
  }

  onSelectAllAssignableChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleSelectAllAssignable(checked);
  }

  onAssignableItemChange(itemId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleAssignableItem(itemId, checked);
  }

  removeItemFromCategory(item: CategoryItem): void {
    if (!this.selectedCategoryForItems) {
      return;
    }

    this.removingItemId = item.item_id;
    this.modalErrorMessage = '';
    this.modalSuccessMessage = '';

    this.categoryService
      .removeItem(this.selectedCategoryForItems.category_id, item.item_id)
      .subscribe({
        next: (response) => {
          this.removingItemId = null;
          this.modalSuccessMessage = response.message;
          this.loadCategoryItems();
          this.loadAssignableItems();
          this.loadCategories();
        },
        error: (err) => {
          this.removingItemId = null;
          this.modalErrorMessage = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
  }

  getAvailableParentOptions(): InventoryCategory[] {
    if (!this.selectedCategoryId) {
      return this.parentOptions;
    }

    return this.parentOptions.filter((category) => category.category_id !== this.selectedCategoryId);
  }

  private nullIfEmpty(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
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

    return errorObject?.error?.message || 'Request failed. Please try again.';
  }
}
