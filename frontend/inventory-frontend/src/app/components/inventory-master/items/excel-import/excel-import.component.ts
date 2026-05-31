import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  aliases?: string[];
  transform?: (value: unknown) => unknown;
}

export interface ImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  error?: string;
}

export interface ImportResult {
  rowNumber: number;
  status: 'success' | 'error';
  message: string;
}

export interface ImportCategoryOption {
  category_id: number;
  category_name: string;
}

export interface ImportConflict {
  incoming: ImportRow;
  existing: Record<string, string>;
  resolve: (useFileValues: boolean) => void;
}

@Component({
  selector: 'app-excel-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './excel-import.component.html',
  styleUrls: ['./excel-import.component.scss'],
})
export class ExcelImportComponent implements OnChanges, OnDestroy {
  @Input() columns: ImportColumn[] = [];
  @Input() templateName = 'import-template';
  @Input() categoryOptions: ImportCategoryOption[] = [];

  @Output() closed = new EventEmitter<boolean>();
  @Output() importRow = new EventEmitter<{
    row: ImportRow;
    resolve: (result: ImportResult) => void;
  }>();
  @Output() conflictRow = new EventEmitter<ImportConflict>();

  step: 'upload' | 'preview' | 'importing' | 'results' = 'upload';
  isDragging = false;
  parseError = '';
  categorySelectError = '';
  importing = false;

  selectedCategoryId: number | null = null;

  get selectedCategoryName(): string {
    if (!this.selectedCategoryId) return '';
    return (
      this.categoryOptions.find((c) => c.category_id === this.selectedCategoryId)
        ?.category_name ?? ''
    );
  }

  rows: ImportRow[] = [];
  results: ImportResult[] = [];
  importedCount = 0;

  // ── Conflict resolution state ─────────────────────────────────────────────
  activeConflict: ImportConflict | null = null;
  conflictChoice: 'keep' | 'replace' = 'keep';
  bulkConflictChoice: 'none' | 'keep' | 'replace' = 'none';
  conflictExistingFields: { label: string; value: string }[] = [];
  conflictIncomingFields: { label: string; value: string }[] = [];

  // ── Computed ──────────────────────────────────────────────────────────────

  get validRows(): ImportRow[] {
    return this.rows.filter((r) => !r.error);
  }

  get invalidRows(): ImportRow[] {
    return this.rows.filter((r) => !!r.error);
  }

  get progressPercent(): number {
    if (!this.validRows.length) return 0;
    return Math.round((this.importedCount / this.validRows.length) * 100);
  }

  get successCount(): number {
    return this.results.filter((r) => r.status === 'success').length;
  }

  get failCount(): number {
    return this.results.filter((r) => r.status === 'error').length;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(_changes: SimpleChanges): void {}

  ngOnDestroy(): void {}

  // ── Modal behaviour ───────────────────────────────────────────────────────

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

  close(): void {
    this.closed.emit(this.successCount > 0);
  }

  resetToUpload(): void {
    this.step = 'upload';
    this.rows = [];
    this.results = [];
    this.parseError = '';
    this.categorySelectError = '';
    this.importedCount = 0;
    this.importing = false;
    this.activeConflict = null;
    this.bulkConflictChoice = 'none';
  }

  // ── File handling ─────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
    input.value = '';
  }

  private processFile(file: File): void {
    this.parseError = '';
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      this.parseError = 'Only .xlsx, .xls, and .csv files are supported.';
      return;
    }

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result as string, { type: 'string' });
          this.parseWorkbook(workbook);
        } catch {
          this.parseError = 'Failed to read the CSV file. Make sure it is a valid CSV.';
        }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          this.parseWorkbook(workbook);
        } catch {
          this.parseError = 'Failed to read the file. Make sure it is a valid Excel file.';
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  private parseWorkbook(workbook: XLSX.WorkBook): void {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (!allRows.length) {
      this.parseError = 'The file appears to be empty.';
      return;
    }

    // Build known name set for header detection
    const allKnownNames = new Set<string>();
    for (const col of this.columns) {
      allKnownNames.add(col.label.toLowerCase());
      for (const alias of col.aliases ?? []) allKnownNames.add(alias.toLowerCase());
    }

    // Find the header row (best match in first 20 rows)
    let headerRowIndex = 0;
    let bestMatchCount = 0;
    const scanLimit = Math.min(20, allRows.length);

    for (let r = 0; r < scanLimit; r++) {
      const matchCount = allRows[r].filter((cell) =>
        allKnownNames.has(String(cell ?? '').trim().toLowerCase()),
      ).length;
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        headerRowIndex = r;
      }
    }

    const headerRow = allRows[headerRowIndex] as string[];

    // Map column key → sheet column index
    const colIndexMap = new Map<string, number>();
    for (const col of this.columns) {
      const candidates = [col.label, ...(col.aliases ?? [])].map((n) => n.toLowerCase());
      for (let c = 0; c < headerRow.length; c++) {
        if (candidates.includes(String(headerRow[c] ?? '').trim().toLowerCase())) {
          colIndexMap.set(col.key, c);
          break;
        }
      }
    }

    // Parse data rows
    const parsed: ImportRow[] = [];
    const dataRows = allRows.slice(headerRowIndex + 1);

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r] as unknown[];
      if (!row.some((cell) => String(cell ?? '').trim())) continue;
      parsed.push(this.parseRow(row, headerRowIndex + 2 + r, colIndexMap));
    }

    if (!parsed.length) {
      this.parseError = 'No data rows found after the header row.';
      return;
    }

    this.rows = parsed;

    if (this.categoryOptions.length && !this.selectedCategoryId) {
      this.categorySelectError = 'Please select a category before proceeding.';
      this.step = 'upload';
      return;
    }

    this.step = 'preview';
  }

  private parseRow(
    row: unknown[],
    rowNumber: number,
    colIndexMap: Map<string, number>,
  ): ImportRow {
    const data: Record<string, unknown> = {};
    let error: string | undefined;

    for (const col of this.columns) {
      const colIndex = colIndexMap.get(col.key);
      const value = String(colIndex !== undefined ? (row[colIndex] ?? '') : '').trim();
      const transformed = col.transform ? col.transform(value) : value;
      data[col.key] = transformed;

      if (
        col.required &&
        (transformed === null ||
          transformed === undefined ||
          String(transformed).trim() === '')
      ) {
        error = `"${col.label}" is required`;
      }
    }

    return { rowNumber, data, error };
  }

  // ── Template download ─────────────────────────────────────────────────────

  downloadTemplate(): void {
    const headers = this.columns.map((c) => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(() => ({ wch: 24 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${this.templateName}.xlsx`);
  }

  // ── Conflict resolution ───────────────────────────────────────────────────

  resolveConflict(): void {
    if (!this.activeConflict) return;
    const useFileValues = this.conflictChoice === 'replace';
    const resolver = this.activeConflict.resolve;
    this.activeConflict = null;
    resolver(useFileValues);
  }

  /** X button — dismiss and keep existing without changing anything */
  dismissConflict(): void {
    if (!this.activeConflict) return;
    const resolver = this.activeConflict.resolve;
    this.activeConflict = null;
    resolver(false); // keep existing
  }

  showConflict(
    conflict: ImportConflict,
    existingFields: { label: string; value: string }[],
    incomingFields: { label: string; value: string }[],
  ): void {
    if (this.bulkConflictChoice === 'keep') { conflict.resolve(false); return; }
    if (this.bulkConflictChoice === 'replace') { conflict.resolve(true); return; }

    this.conflictChoice = 'keep';
    this.conflictExistingFields = existingFields;
    this.conflictIncomingFields = incomingFields;
    this.activeConflict = conflict;
  }

  // ── Import ────────────────────────────────────────────────────────────────

  proceedToPreview(): void {
    this.categorySelectError = '';
    if (this.categoryOptions.length && !this.selectedCategoryId) {
      this.categorySelectError = 'Please select a category before proceeding.';
      return;
    }
    this.step = 'preview';
  }

  async startImport(): Promise<void> {
    this.step = 'importing';
    this.importing = true;
    this.importedCount = 0;
    this.results = [];

    for (const row of this.validRows) {
      if (this.selectedCategoryId !== null) {
        row.data['_selectedCategoryId'] = this.selectedCategoryId;
      }

      const result = await new Promise<ImportResult>((resolve) => {
        this.importRow.emit({ row, resolve });
      });
      this.results.push(result);
      this.importedCount++;
    }

    this.importing = false;
    this.step = 'results';
  }
}
