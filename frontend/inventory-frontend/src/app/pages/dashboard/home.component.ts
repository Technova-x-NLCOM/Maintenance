import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { StaffDashboardComponent } from './staff-dashboard.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, AdminDashboardComponent, StaffDashboardComponent],
  template: `
    <app-admin-dashboard *ngIf="user?.role === 'admin'" />
    <app-staff-dashboard *ngIf="user?.role === 'staff'" />
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
