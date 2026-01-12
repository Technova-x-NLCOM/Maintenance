import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { TableListComponent } from './table-list/table-list.component';
import { TableFormComponent } from './table-form/table-form.component';

type View = 'home' | 'table-list' | 'table-form';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, HomeComponent, TableListComponent, TableFormComponent],
  templateUrl: './maintenance.component.html',
  styleUrls: ['./maintenance.component.scss']
})
export class MaintenanceComponent {
  currentView: View = 'home';
  selectedTable: string | null = null;
  editingRow: any | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  goToHome(): void {
    this.currentView = 'home';
    this.selectedTable = null;
    this.editingRow = null;
    this.cdr.markForCheck();
  }

  goToTableList(tableName: string): void {
    this.selectedTable = tableName;
    this.editingRow = null;
    this.currentView = 'table-list';
    this.cdr.markForCheck();
  }

  goToForm(row: any | null): void {
    this.editingRow = row;
    this.currentView = 'table-form';
    this.cdr.markForCheck();
  }

  goToTableListView(): void {
    this.editingRow = null;
    this.currentView = 'table-list';
    this.cdr.markForCheck();
  }
}

