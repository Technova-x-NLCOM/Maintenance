import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
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
export class CategoryManagementComponent implements OnInit {
  loading = false;
  saving = false;
  deletingCategoryId: number | null = null;
  categories: InventoryCategory[] = [];
  parentOptions: InventoryCategory[] = [];

  search = '';
  showForm = false;
  selectedCategoryId: number | null = null;
  errorMessage = '';
  successMessage = '';

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

  loadCategories(): void {
    this.loading = true;
    this.errorMessage = '';

    this.categoryService.list(this.search || undefined).subscribe({
      next: (response) => {
        this.categories = response.data;
        this.parentOptions = response.data;
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
    this.loadCategories();
  }

  clearSearch(): void {
    this.search = '';
    this.loadCategories();
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
