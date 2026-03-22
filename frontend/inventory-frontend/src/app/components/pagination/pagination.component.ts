import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent {
  /** 1-based current page */
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  /** Max numbered page buttons (sliding window) */
  @Input() maxVisible = 5;
  /** Hide the control when there is only one page */
  @Input() hideWhenSinglePage = true;

  @Output() pageChange = new EventEmitter<number>();

  get visiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 0) {
      return [];
    }
    const max = Math.min(this.maxVisible, total);
    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    let start = Math.max(1, this.currentPage - Math.floor(max / 2));
    let end = start + max - 1;
    if (end > total) {
      end = total;
      start = Math.max(1, end - max + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get show(): boolean {
    if (this.hideWhenSinglePage) {
      return this.totalPages > 1;
    }
    return this.totalPages >= 1;
  }

  goPrev(): void {
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  goNext(): void {
    if (this.currentPage < this.totalPages) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  goTo(n: number): void {
    if (n === this.currentPage || n < 1 || n > this.totalPages) {
      return;
    }
    this.pageChange.emit(n);
  }
}
