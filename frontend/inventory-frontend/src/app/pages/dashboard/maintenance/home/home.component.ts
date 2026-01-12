import { Component, OnInit, Input } from '@angular/core';
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

  constructor(private api: MaintenanceService) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.api.listTables().subscribe(t => (this.tables = t));
  }

  onSelectTable(tableName: string): void {
    this.parent.goToTableList(tableName);
  }

  formatPrimaryKey(pk: string | string[]): string {
    return Array.isArray(pk) ? pk.join(', ') : pk;
  }
}
