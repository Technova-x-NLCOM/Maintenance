import { Component, Input, OnInit, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../services/auth.service';
import { RbacService, Role } from '../../../rbac/services/rbac.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() user: User | null = null;
  @Input() isMobile = false;
  @Input() mobileOpen = false;
  @Output() navigateItem = new EventEmitter<void>();
  currentRole: Role | null = null;
  loadingRole = false;
  showLogoutModal = false;
  alertsCount = 0;

  // Track which nav groups are open
  openGroups: Set<string> = new Set();

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

    // Auto-expand the group that matches the current route
    this.expandGroupForCurrentRoute(this.router.url);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.expandGroupForCurrentRoute(event.urlAfterRedirects || event.url);
      this.cdr.detectChanges();
    });
  }

  toggleGroup(group: string): void {
    if (this.openGroups.has(group)) {
      this.openGroups.delete(group);
    } else {
      this.openGroups.add(group);
    }
  }

  onNavItemClick(): void {
    if (this.isMobile) {
      this.navigateItem.emit();
    }
  }

  isGroupOpen(group: string): boolean {
    return this.openGroups.has(group);
  }

  /** Dashboard links to `/dashboard`, which redirects to role-specific home; `routerLinkActive` with exact match never stays active after redirect. */
  isDashboardNavActive(): boolean {
    const path = this.router.url.split('?')[0].replace(/\/$/, '') || '/';
    return (
      path === '/dashboard' ||
      path === '/dashboard/super-admin' ||
      path === '/dashboard/inventory-manager' ||
      path === '/dashboard/profile'
    );
  }

  private expandGroupForCurrentRoute(url: string): void {
    if (
      url.includes('/dashboard/inventory/categories') ||
      url.includes('/dashboard/maintenance/items') ||
      url.includes('/dashboard/maintenance/inventory_batches') ||
      url.includes('/dashboard/maintenance/inventory_snapshots')
    ) {
      this.openGroups.add('inventory');
    }
  }

  openLogoutModal() {
    this.showLogoutModal = true;
  }

  closeLogoutModal() {
    this.showLogoutModal = false;
  }

  confirmLogout() {
    this.showLogoutModal = false;
    const role = this.authService.getCurrentUser()?.role;
    const loginRoute = role === 'super_admin' ? '/admin-login' : '/login';
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate([loginRoute]);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.router.navigate([loginRoute]);
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
    // Super_admin always has permission
    if (this.user?.role === 'super_admin') {
      return true;
    }
    // For others, check if role is still loading
    if (this.loadingRole) {
      return false;
    }
    return this.rbacService.roleHasPermission(this.currentRole, permissionName);
  }
}
