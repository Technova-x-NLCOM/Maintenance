import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-redirect',
  standalone: true,
  template: '<div>Loading...</div>',
  styles: [`
    div {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-size: 1.5rem;
      color: #374151;
    }
  `]
})
export class DashboardRedirectComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        // Redirect based on user role
        const role = user.role;
        
        if (role === 'super_admin') {
          this.router.navigate(['/dashboard/dashboard']);
        } else if (role === 'inventory_manager') {
          this.router.navigate(['/dashboard/inventory-manager']);
        } else {
          this.router.navigate(['/dashboard/profile']);
        }
      }
    });
  }
}
