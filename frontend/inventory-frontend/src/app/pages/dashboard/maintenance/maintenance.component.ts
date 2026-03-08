import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
export class MaintenanceComponent implements OnInit, OnDestroy {
  currentView: View = 'home';
  selectedTable: string | null = null;
  editingRow: any | null = null;
  private routeSub: Subscription | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      const table = params['table'];
      if (table) {
        this.selectedTable = table;
        this.editingRow = null;
        this.currentView = 'table-list';
      } else {
        this.currentView = 'home';
        this.selectedTable = null;
        this.editingRow = null;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  goToHome(): void {
    this.router.navigate(['/dashboard/maintenance']);
  }

  goToTableList(tableName: string): void {
    this.router.navigate(['/dashboard/maintenance', tableName]);
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

