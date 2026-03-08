import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';
import { SuperAdminDashboardComponent } from './super-admin/super-admin-dashboard.component';
import { InventoryManagerDashboardComponent } from './inventory-manager/inventory-manager-dashboard.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, SuperAdminDashboardComponent, InventoryManagerDashboardComponent],
  template: `
    <app-super-admin-dashboard *ngIf="user?.role === 'super_admin'" />
    <app-inventory-manager-dashboard *ngIf="user?.role === 'inventory_manager'" />
  `
})
export class HomeComponent implements OnInit {
  user: User | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
  }
}
