import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RecipeTypeRow, RecipeTypeService } from '../../../services/recipe-type.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-recipe-type-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './recipe-type-management.component.html',
  styleUrls: ['./recipe-type-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeTypeManagementComponent implements OnInit, OnDestroy {
  loading       = false;
  saving        = false;
  error         = '';
  search        = '';
  recipeTypes: RecipeTypeRow[] = [];
  currentPage   = 1;
  perPage       = 10;
  totalPages    = 1;
  totalRecords  = 0;

  showForm          = false;
  editingId: number | null = null;
  showDeleteConfirm = false;
  deleteTarget: RecipeTypeRow | null = null;
  deleteLoading     = false;

  formData: { name: string; description: string } = {
    name: '',
    description: '',
  };

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadSub?: Subscription;
  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor(
    private recipeTypeService: RecipeTypeService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadRecipeTypes();
  }

  ngOnDestroy(): void {
    this.cancelSearchDebounce();
    this.loadSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.showDeleteConfirm && !this.deleteLoading) {
      this.cancelDeleteConfirm();
    } else if (this.showForm && !this.saving) {
      this.closeForm();
    }
  }

  loadRecipeTypes(page: number = 1): void {
    this.cancelSearchDebounce();
    this.loading = true;
    this.error   = '';

    this.loadSub?.unsubscribe();
    this.loadSub = this.recipeTypeService
      .list({ page, per_page: this.perPage, search: this.search || undefined })
      .subscribe({
        next: (res) => {
          this.recipeTypes  = res.data.data;
          this.currentPage  = res.data.current_page;
          this.totalPages   = res.data.last_page;
          this.totalRecords = res.data.total;
          this.loading      = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.error   = err?.error?.message || 'Failed to load recipe types.';
          this.cdr.markForCheck();
        },
      });
  }

  onSearchInput(): void {
    this.cancelSearchDebounce();
    this.searchDebounce = setTimeout(() => {
      this.searchDebounce = undefined;
      this.loadRecipeTypes(1);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearSearch(): void {
    this.search = '';
    this.loadRecipeTypes(1);
  }

  previousPage(): void {
    if (this.currentPage > 1) this.loadRecipeTypes(this.currentPage - 1);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.loadRecipeTypes(this.currentPage + 1);
  }

  startNew(): void {
    this.editingId = null;
    this.formData  = { name: '', description: '' };
    this.showForm  = true;
    this.cdr.markForCheck();
  }

  editRecipeType(row: RecipeTypeRow): void {
    this.editingId = row.recipe_type_id;
    this.formData  = { name: row.name, description: row.description || '' };
    this.showForm  = true;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showForm  = false;
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveRecipeType(): void {
    if (!this.formData.name.trim()) {
      this.toast.error('Recipe type name is required.');
      return;
    }

    this.saving = true;
    const payload = {
      name:        this.formData.name.trim(),
      description: this.formData.description.trim() || null,
    };

    const request = this.editingId
      ? this.recipeTypeService.update(this.editingId, payload)
      : this.recipeTypeService.create(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(this.editingId ? 'Recipe type updated.' : 'Recipe type created.');
        this.closeForm();
        this.loadRecipeTypes(this.currentPage);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to save recipe type.');
        this.cdr.markForCheck();
      },
    });
  }

  openDeleteConfirm(row: RecipeTypeRow): void {
    this.deleteTarget      = row;
    this.showDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  cancelDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.deleteTarget      = null;
    this.cdr.markForCheck();
  }

  confirmDelete(): void {
    if (!this.deleteTarget) return;

    this.deleteLoading = true;
    this.recipeTypeService.delete(this.deleteTarget.recipe_type_id).subscribe({
      next: () => {
        this.deleteLoading = false;
        this.toast.success('Recipe type deleted.');
        this.cancelDeleteConfirm();
        this.loadRecipeTypes(this.currentPage);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.deleteLoading = false;
        this.toast.error(err?.error?.message || 'Failed to delete recipe type.');
        this.cdr.markForCheck();
      },
    });
  }

  trackByRecipeType(_: number, row: RecipeTypeRow): number {
    return row.recipe_type_id;
  }

  private cancelSearchDebounce(): void {
    if (this.searchDebounce !== undefined) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = undefined;
    }
  }
}
