import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { RbacService } from '../../rbac/services/rbac.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() user: User | null = null;

  constructor(
    private authService: AuthService,
    private rbacService: RbacService,
    private router: Router
  ) {}

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.router.navigate(['/login']);
      }
    });
  }

  /**
   * Check if user has manage_backups permission via role
   */
  canManageBackups(): boolean {
    // Get the current user's role and check if it has manage_backups permission
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }
    // For now, only super_admin and admin can manage backups
    // This can be enhanced to check the actual RBAC permissions
    return currentUser.role === 'super_admin' || currentUser.role === 'admin';
  }
}
