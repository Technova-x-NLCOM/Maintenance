import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { RbacService, Role } from '../../rbac/services/rbac.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() user: User | null = null;
  currentRole: Role | null = null;
  loadingRole = false;
  showLogoutModal = false;

  constructor(
    private authService: AuthService,
    private rbacService: RbacService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((current) => {
      this.user = current;
      if (current) {
        this.loadCurrentRole();
      } else {
        this.currentRole = null;
        this.cdr.detectChanges();
      }
    });
  }

  openLogoutModal() {
    this.showLogoutModal = true;
  }

  closeLogoutModal() {
    this.showLogoutModal = false;
  }

  confirmLogout() {
    this.showLogoutModal = false;
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

  private loadCurrentRole(): void {
    this.loadingRole = true;
    this.rbacService.getCurrentRole().subscribe({
      next: (role) => {
        this.currentRole = role;
        this.loadingRole = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.currentRole = null;
        this.loadingRole = false;
        this.cdr.detectChanges();
      }
    });
  }

  hasPermission(permissionName: string): boolean {
    if (this.loadingRole) {
      return false;
    }
    if (this.user?.role === 'super_admin') {
      return true;
    }
    return this.rbacService.roleHasPermission(this.currentRole, permissionName);
  }
}
