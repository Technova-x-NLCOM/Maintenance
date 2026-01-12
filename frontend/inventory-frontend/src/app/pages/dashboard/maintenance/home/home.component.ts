import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceService, MaintenanceTableInfo } from '../../../../services/maintenance.service';
import { 
  getFriendlyTableName, 
  getTableDescription, 
  getTableIcon, 
  getTableCategory 
} from '../table-config';

@Component({
  selector: 'app-maintenance-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  @Input() parent: any;
  tables: MaintenanceTableInfo[] = [];
  loading = true;
  error = '';

  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.loading = true;
    this.error = '';
    this.api.listTables().subscribe({
      next: (t) => {
        setTimeout(() => {
          this.tables = t;
          this.loading = false;
          console.log('Loaded tables:', t);
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          console.error('Error loading tables:', err);
          this.error = err?.error?.message || 'Failed to load tables. Please check your permissions.';
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  onSelectTable(tableName: string): void {
    this.parent.goToTableList(tableName);
  }

  // Helper methods for template
  getFriendlyTableName(tableName: string): string {
    return getFriendlyTableName(tableName);
  }

  getTableDescription(tableName: string): string {
    return getTableDescription(tableName);
  }

  getTableIcon(tableName: string): string {
    return getTableIcon(tableName);
  }

  getTableCategory(tableName: string): string {
    return getTableCategory(tableName);
  }

  hasUncategorizedTables(): boolean {
    return this.tables.some(t => {
      const cat = this.getTableCategory(t.name);
      return cat !== 'inventory' && cat !== 'users' && cat !== 'system';
    });
  }
}
