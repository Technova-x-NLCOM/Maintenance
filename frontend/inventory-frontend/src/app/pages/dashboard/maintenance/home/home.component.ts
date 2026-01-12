import { Component, OnInit, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaintenanceService, MaintenanceTableInfo } from '../../../../services/maintenance.service';

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

  constructor(
    private api: MaintenanceService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.api.listTables().subscribe({
      next: (t) => {
        this.tables = t;
        console.log('Loaded tables:', t);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading tables:', err);
      }
    });
  }

  onSelectTable(tableName: string): void {
    this.parent.goToTableList(tableName);
  }

  formatPrimaryKey(pk: string | string[]): string {
    return Array.isArray(pk) ? pk.join(', ') : pk;
  }
}
