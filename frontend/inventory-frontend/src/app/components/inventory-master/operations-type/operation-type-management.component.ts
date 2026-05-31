import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { OperationTypeRow, OperationTypeService } from '../../../services/operation-type.service';
import { ToastService } from '../../../services/toast.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-operation-type-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './operation-type-management.component.html',
  styleUrls: ['./operation-type-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationTypeManagementComponent implements OnInit, OnDestroy {
  loading = false;
  saving = false;
  error = '';
  search = '';
  operationTypes: OperationTypeRow[] = [];
  currentPage = 1;
  perPage = 10;
  totalPages = 1;
  totalRecords = 0;

  showForm = false;
  editingOperationTypeId: number | null = null;
  showDeleteConfirm = false;
  deleteTarget: OperationTypeRow | null = null;
  deleteLoading = false;

  formData: {
    operation_name: string;
    operation_direction: 'IN' | 'OUT';
    description: string;
    is_active: boolean;
  } = {
    operation_name: '',
    operation_direction: 'IN',
    description: '',
    is_active: true,
  };

  private readonly SEARCH_DEBOUNCE_MS = 300;
  private loadSub?: Subscription;
  private searchDebounce?: ReturnType<typeof setTimeout>;

  constructor(
    private operationTypeService: OperationTypeService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadOperationTypes();
  }

  ngOnDestroy(): void {
    this.cancelSearchDebounce();
    this.loadSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.showDeleteConfirm && !this.deleteLoading) {
      this.cancelDeleteConfirm();
    }
  }

  loadOperationTypes(page: number = 1): void {
    this.cancelSearchDebounce();
    this.loading = true;
    this.error = '';

    this.loadSub?.unsubscribe();
    this.loadSub = this.operationTypeService.list({
      page,
      per_page: this.perPage,
      search: this.search || undefined,
    }).subscribe({
      next: (response) => {
        this.operationTypes = response.data.data;
        this.currentPage = response.data.current_page;
        this.totalPages = response.data.last_page;
        this.totalRecords = response.data.total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load operation types.';
        this.cdr.markForCheck();
      },
    });
  }

  onSearchInput(): void {
    this.cancelSearchDebounce();
    this.searchDebounce = setTimeout(() => {
      this.searchDebounce = undefined;
      this.loadOperationTypes(1);
    }, this.SEARCH_DEBOUNCE_MS);
  }

  clearSearch(): void {
    this.search = '';
    this.loadOperationTypes(1);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadOperationTypes(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadOperationTypes(this.currentPage + 1);
    }
  }

  startNew(): void {
    this.editingOperationTypeId = null;
    this.showForm = true;
    this.formData = {
      operation_name: '',
      operation_direction: 'IN',
      description: '',
      is_active: true,
    };
    this.cdr.markForCheck();
  }

  editOperationType(row: OperationTypeRow): void {
    this.editingOperationTypeId = row.operation_type_id;
    this.showForm = true;
    this.formData = {
      operation_name: row.operation_name,
      operation_direction: row.operation_direction,
      description: row.description || '',
      is_active: !!row.is_active,
    };
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingOperationTypeId = null;
    this.cdr.markForCheck();
  }

  saveOperationType(): void {
    if (!this.formData.operation_name.trim()) {
      this.toast.error('Operation name is required.');
      return;
    }

    this.saving = true;
    const payload = {
      operation_name: this.formData.operation_name.trim(),
      operation_direction: this.formData.operation_direction,
      description: this.formData.description.trim() || null,
      is_active: this.formData.is_active,
    };

    const request = this.editingOperationTypeId
      ? this.operationTypeService.update(this.editingOperationTypeId, payload)
      : this.operationTypeService.create(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.toast.success(this.editingOperationTypeId ? 'Operation type updated.' : 'Operation type created.');
        this.closeForm();
        this.loadOperationTypes(this.currentPage);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err?.error?.message || 'Failed to save operation type.');
        this.cdr.markForCheck();
      },
    });
  }

  openDeleteConfirm(row: OperationTypeRow): void {
    this.deleteTarget = row;
    this.showDeleteConfirm = true;
    this.cdr.markForCheck();
  }

  cancelDeleteConfirm(): void {
    this.showDeleteConfirm = false;
    this.deleteTarget = null;
    this.cdr.markForCheck();
  }

  confirmDeleteOperationType(): void {
    if (!this.deleteTarget) {
      return;
    }

    this.deleteLoading = true;
    this.operationTypeService.delete(this.deleteTarget.operation_type_id).subscribe({
      next: () => {
        this.deleteLoading = false;
        this.toast.success('Operation type deleted.');
        this.cancelDeleteConfirm();
        this.loadOperationTypes(this.currentPage);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.deleteLoading = false;
        this.toast.error(err?.error?.message || 'Failed to delete operation type.');
        this.cdr.markForCheck();
      },
    });
  }

  trackByOperationType(_: number, row: OperationTypeRow): number {
    return row.operation_type_id;
  }

  private cancelSearchDebounce(): void {
    if (this.searchDebounce !== undefined) {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = undefined;
    }
  }
}