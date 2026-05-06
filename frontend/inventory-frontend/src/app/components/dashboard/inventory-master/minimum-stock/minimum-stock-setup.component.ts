import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryItemService } from '../../../../services/inventory-item.service';

interface MinimumStockRow {
  item_id: number;
  item_code: string;
  item_description: string;
  item_type_name?: string;
  category_name?: string;
  reorder_level: number;
  current_stock: number;
  shelf_life_days: number | null;
  is_active: boolean;
}

@Component({
  selector: 'app-minimum-stock-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './minimum-stock-setup.component.html',
  styleUrls: ['./minimum-stock-setup.component.scss']
})
export class MinimumStockSetupComponent implements OnInit {
  loading = false;
  saving = false;

  rows: MinimumStockRow[] = [];
  editedValues: Record<number, number> = {};

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  perPage = 15;

  search = '';
  errorMessage = '';
  successMessage = '';

  constructor(
    private itemService: InventoryItemService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadRows(1);
  }

  loadRows(page: number = 1): void {
    this.loading = true;
    this.errorMessage = '';

    this.itemService
      .listMinimumStock({
        page,
        per_page: this.perPage,
        search: this.search || undefined,
        is_active: true
      })
      .subscribe({
        next: (response) => {
          this.rows = response.data.data;
          this.currentPage = response.data.current_page;
          this.totalPages = response.data.last_page;
          this.totalItems = response.data.total;
          this.editedValues = {};
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.message || 'Failed to load minimum stock data.';
          this.cdr.detectChanges();
        }
      });
  }

  onSearch(): void {
    this.loadRows(1);
  }

  clearSearch(): void {
    this.search = '';
    this.loadRows(1);
  }

  trackEdit(row: MinimumStockRow, value: number | null): void {
    const normalized = Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
    this.editedValues[row.item_id] = normalized;
  }

  hasPendingChanges(): boolean {
    return Object.keys(this.editedValues).length > 0;
  }

  saveAll(): void {
    if (!this.hasPendingChanges()) {
      this.successMessage = 'No changes to save.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const updates = Object.entries(this.editedValues).map(([itemId, reorderLevel]) => ({
      item_id: Number(itemId),
      reorder_level: Math.max(0, Number(reorderLevel))
    }));

    this.itemService.bulkUpdateMinimumStock(updates).subscribe({
      next: (response) => {
        this.saving = false;
        this.successMessage = response.message;
        this.loadRows(this.currentPage);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || 'Failed to save minimum stock values.';
        this.cdr.detectChanges();
      }
    });
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadRows(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadRows(this.currentPage + 1);
    }
  }

  isBelowMinimum(row: MinimumStockRow): boolean {
    return row.current_stock < this.getEffectiveReorderLevel(row);
  }

  getEffectiveReorderLevel(row: MinimumStockRow): number {
    return this.editedValues[row.item_id] ?? row.reorder_level;
  }
}
