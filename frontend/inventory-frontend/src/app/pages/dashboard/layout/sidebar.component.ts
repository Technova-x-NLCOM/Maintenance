import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
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
  currentRole: Role | null = null;
  loadingRole = false;
  showLogoutModal = false;

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

  isGroupOpen(group: string): boolean {
    return this.openGroups.has(group);
  }

  private expandGroupForCurrentRoute(url: string): void {
    const inventoryTables = ['items', 'categories', 'item_types', 'inventory_batches', 'inventory_transactions', 'inventory_snapshots', 'expiry_alerts'];
    const userTables = ['users', 'user_roles'];
    const systemTables = ['audit_log'];

    if (
      url.includes('/dashboard/inventory/items') ||
      url.includes('/dashboard/inventory/categories') ||
      url.includes('/dashboard/inventory/minimum-stock') ||
      url.includes('/dashboard/inventory/receiving')
    ) {
      this.openGroups.add('inventory-master-data');
      return;
    }

    for (const t of inventoryTables) {
      if (url.includes(`/maintenance/${t}`)) {
        this.openGroups.add('inventory');
        return;
      }
    }
    for (const t of userTables) {
      if (url.includes(`/maintenance/${t}`) || url.includes('/roles')) {
        this.openGroups.add('users');
        return;
      }
    }
    for (const t of systemTables) {
      if (url.includes(`/maintenance/${t}`) || url.includes('/settings')) {
        this.openGroups.add('system');
        return;
      }
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
    if (this.loadingRole) {
      return false;
    }
    if (this.user?.role === 'super_admin') {
      return true;
    }
    return this.rbacService.roleHasPermission(this.currentRole, permissionName);
  }
}
