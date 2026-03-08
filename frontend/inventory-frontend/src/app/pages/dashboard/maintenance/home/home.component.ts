import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaintenanceService, MaintenanceTableInfo } from '../../../../services/maintenance.service';
import { 
  getFriendlyTableName, 
  getTableDescription
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
    private router: Router,
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
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err?.error?.message || 'Failed to load tables. Please check your permissions.';
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  openTable(tableName: string): void {
    this.router.navigate(['/dashboard/maintenance', tableName]);
  }

  getFriendlyTableName(tableName: string): string {
    return getFriendlyTableName(tableName);
  }

  getTableDescription(tableName: string): string {
    return getTableDescription(tableName);
  }
}
