import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CategoryItem,
  InventoryCategory,
  InventoryCategoryService,
  ItemTypeOption
} from '../../../../services/inventory-category.service';
import { PaginationComponent } from '../../../../components/pagination/pagination.component';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './category-management.component.html',
  styleUrls: ['./category-management.component.scss']
})
export class CategoryManagementComponent implements OnInit {
  loading = false;
  saving = false;
  managingItems = false;
  assigningItem = false;
  deletingCategoryId: number | null = null;
  removingItemId: number | null = null;
  categories: InventoryCategory[] = [];
  parentOptions: InventoryCategory[] = [];
  categoryPage = 1;
  categoryPageSize = 15;
  categoryTotalPages = 1;
  categoryTotalCount = 0;
  itemTypes: ItemTypeOption[] = [];
  categoryItems: CategoryItem[] = [];
  assignableItems: CategoryItem[] = [];
  savingInlineItemType = false;
  savingInlineParent = false;
  showInlineItemTypeCreate = false;
  showInlineParentCreate = false;
  newItemTypeName = '';
  newItemTypeDesc = '';
  newParentName = '';
  newParentDesc = '';
  inlineItemTypeError = '';
  inlineParentError = '';

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

  formData: {
    category_name: string;
    parent_category_id: number | null;
    item_type_id: number | null;
    description: string;
  } = {
    category_name: '',
    parent_category_id: null,
    item_type_id: null,
    description: ''
  };

  constructor(
    private categoryService: InventoryCategoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadItemTypes();
    this.loadParentOptions();
    this.loadCategories(1);
  }

  loadParentOptions(): void {
    this.categoryService.getOptions().subscribe({
      next: (res) => {
        const list = res.data?.categories ?? [];
        this.parentOptions = list.map((c) => ({
          category_id: c.category_id,
          category_name: c.category_name,
          parent_category_id: c.parent_category_id ?? null,
          description: null,
          created_at: '',
          item_type_id: (c as { item_type_id?: number | null }).item_type_id ?? null
        }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.parentOptions = [];
        this.cdr.detectChanges();
      }
    });
  }

  onCategoryPageChange(page: number): void {
    this.loadCategories(page);
  }

  loadItemTypes(): void {
    this.categoryService.listItemTypes().subscribe({
      next: (response) => {
        this.itemTypes = response.data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.itemTypes = [];
        this.cdr.detectChanges();
      }
    });
  }

  loadCategories(page?: number): void {
    const targetPage = page ?? this.categoryPage;
    this.loading = true;
    this.errorMessage = '';

    this.categoryService.list(this.search || undefined, targetPage, this.categoryPageSize).subscribe({
      next: (response) => {
        this.categories = response.data.data;
        this.categoryPage = response.data.current_page;
        this.categoryTotalPages = response.data.last_page;
        this.categoryTotalCount = response.data.total;
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

  onSearch(): void {
    this.loadCategories(1);
  }

  clearSearch(): void {
    this.search = '';
    this.loadCategories(1);
  }

  startNew(): void {
    this.selectedCategoryId = null;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetInlinePanels();
    this.formData = {
      category_name: '',
      parent_category_id: null,
      item_type_id: null,
      description: ''
    };
    this.cdr.detectChanges();
  }

  editCategory(category: InventoryCategory): void {
    this.selectedCategoryId = category.category_id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.resetInlinePanels();
    this.formData = {
      category_name: category.category_name,
      parent_category_id: category.parent_category_id,
      item_type_id: category.item_type_id ?? null,
      description: category.description || ''
    };
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.selectedCategoryId = null;
    this.errorMessage = '';
    this.resetInlinePanels();
    this.formData = {
      category_name: '',
      parent_category_id: null,
      item_type_id: null,
      description: ''
    };
    this.cdr.detectChanges();
  }

  private resetInlinePanels(): void {
    this.showInlineItemTypeCreate = false;
    this.showInlineParentCreate = false;
    this.newItemTypeName = '';
    this.newItemTypeDesc = '';
    this.newParentName = '';
    this.newParentDesc = '';
    this.inlineItemTypeError = '';
    this.inlineParentError = '';
  }

  openInlineItemType(): void {
    this.showInlineItemTypeCreate = true;
    this.inlineItemTypeError = '';
    this.newItemTypeName = '';
    this.newItemTypeDesc = '';
  }

  cancelInlineItemType(): void {
    this.showInlineItemTypeCreate = false;
    this.inlineItemTypeError = '';
  }

  openInlineParent(): void {
    this.showInlineParentCreate = true;
    this.inlineParentError = '';
    this.newParentName = '';
    this.newParentDesc = '';
  }

  cancelInlineParent(): void {
    this.showInlineParentCreate = false;
    this.inlineParentError = '';
  }

  createItemTypeInline(): void {
    this.inlineItemTypeError = '';
    const name = this.newItemTypeName.trim();
    if (!name) {
      this.inlineItemTypeError = 'Enter a name for the new item type.';
      return;
    }

    this.savingInlineItemType = true;
    this.categoryService
      .createItemType({
        type_name: name,
        description: this.nullIfEmpty(this.newItemTypeDesc)
      })
      .subscribe({
        next: (res) => {
          this.savingInlineItemType = false;
          const id = res.data.item_type_id;
          this.itemTypes = [...this.itemTypes, res.data as ItemTypeOption].sort((a, b) =>
            a.type_name.localeCompare(b.type_name)
          );
          this.formData.item_type_id = id;
          this.showInlineItemTypeCreate = false;
          this.newItemTypeName = '';
          this.newItemTypeDesc = '';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.savingInlineItemType = false;
          this.inlineItemTypeError = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
  }

  createParentInline(): void {
    this.inlineParentError = '';
    const name = this.newParentName.trim();
    if (!name) {
      this.inlineParentError = 'Enter a name for the new parent category.';
      return;
    }

    this.savingInlineParent = true;
    this.categoryService
      .create({
        category_name: name,
        parent_category_id: null,
        item_type_id: null,
        description: this.nullIfEmpty(this.newParentDesc)
      })
      .subscribe({
        next: (res) => {
          this.savingInlineParent = false;
          const id = res.data.category_id;
          this.formData.parent_category_id = id;
          this.showInlineParentCreate = false;
          this.newParentName = '';
          this.newParentDesc = '';
          this.loadParentOptions();
          this.loadCategories(this.categoryPage);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.savingInlineParent = false;
          this.inlineParentError = this.extractError(err);
          this.cdr.detectChanges();
        }
      });
  }

  save(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.formData.item_type_id) {
      this.errorMessage = 'Select an item type, or create a new one with “New item type”.';
      return;
    }
    if (!this.formData.category_name.trim()) {
      this.errorMessage = 'Please enter a category name.';
      return;
    }

    this.saving = true;

    const payload = {
      category_name: this.formData.category_name.trim(),
      parent_category_id: this.formData.parent_category_id,
      item_type_id: this.formData.item_type_id,
      description: this.nullIfEmpty(this.formData.description)
    };

    if (this.selectedCategoryId) {
      this.categoryService.update(this.selectedCategoryId, payload).subscribe({
        next: () => {
          this.saving = false;
          this.showForm = false;
          this.successMessage = 'Category updated successfully.';
          this.loadParentOptions();
          this.loadCategories(this.categoryPage);
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
        this.loadParentOptions();
        this.loadCategories(1);
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
        this.loadParentOptions();
        this.loadCategories(1);
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

    this.managingItems = true;
    this.modalErrorMessage = '';

    this.categoryService
      .listCategoryItems(this.selectedCategoryForItems.category_id, this.itemSearch || undefined)
      .subscribe({
        next: (response) => {
          this.categoryItems = response.data;
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

  loadAssignableItems(): void {
    this.categoryService
      .listAssignableItems(this.assignSearch || undefined, this.selectedCategoryForItems?.category_id)
      .subscribe({
      next: (response) => {
        this.assignableItems = response.data;
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
          this.loadCategories(this.categoryPage);
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
          this.loadCategories(this.categoryPage);
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
