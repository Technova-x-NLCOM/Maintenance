import { Component, Input, OnInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../../services/auth.service';
import { RbacService, Role } from '../../../../rbac/services/rbac.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit {
  @Input() user: User | null = null;
  currentRole: Role | null = null;
  loadingRole = false;
  showLogoutModal = false;
  loggingOut = false;
  isCollapsed = false;

  openGroups: Set<string> = new Set();

  constructor(
    private authService: AuthService,
    private rbacService: RbacService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
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

    this.expandGroupForCurrentRoute(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.expandGroupForCurrentRoute(event.urlAfterRedirects || event.url);
        this.cdr.detectChanges();
      });
  }

  toggleGroup(group: string): void {
    if (this.isCollapsed && this.canCollapseSidebar) {
      if (this.openGroups.has(group)) {
        this.openGroups.clear();
      } else {
        this.openGroups = new Set([group]);
      }
      return;
    }

    if (this.openGroups.has(group)) {
      this.openGroups.delete(group);
    } else {
      this.openGroups.add(group);
    }
  }

  toggleSidebarCollapse(): void {
    if (!this.canCollapseSidebar) {
      return;
    }

    this.isCollapsed = !this.isCollapsed;
    this.openGroups.clear();
  }

  closeCollapsedFlyouts(): void {
    if (this.isCollapsed && this.openGroups.size > 0) {
      this.openGroups.clear();
    }
  }

  get canCollapseSidebar(): boolean {
    return this.user?.role === 'super_admin' || this.user?.role === 'inventory_manager';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isCollapsed || !this.openGroups.size) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.openGroups.clear();
    }
  }

  isGroupOpen(group: string): boolean {
    return this.openGroups.has(group);
  }

  isDashboardActive(): boolean {
    const url = this.router.url;
    return (
      url === '/dashboard' ||
      url.startsWith('/dashboard/super-admin') ||
      url.startsWith('/dashboard/inventory-manager')
    );
  }

  hasPermission(permissionName: string): boolean {
    if (this.loadingRole) return false;
    if (this.user?.role === 'super_admin') return true;
    return this.rbacService.roleHasPermission(this.currentRole, permissionName);
  }

  openLogoutModal(): void {
    this.showLogoutModal = true;
  }

  closeLogoutModal(): void {
    this.showLogoutModal = false;
  }

  confirmLogout(): void {
    this.showLogoutModal = false;
    this.loggingOut = true;
    const role = this.authService.getCurrentUser()?.role;
    const loginRoute = role === 'super_admin' ? '/admin-login' : '/login';
    this.authService.logout().subscribe({
      next: () => this.router.navigate([loginRoute]),
      error: () => this.router.navigate([loginRoute]),
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
      },
    });
  }

  private expandGroupForCurrentRoute(url: string): void {
    const inventoryTables = [
      'items',
      'categories',
      'item_types',
      'inventory_batches',
      'inventory_transactions',
      'inventory_snapshots',
      'expiry_alerts',
    ];
    const userTables = ['users', 'user_roles'];

    if (
      url.includes('/dashboard/inventory/items') ||
      url.includes('/dashboard/inventory/categories')
    ) {
      this.openGroups.add('inventory-master-data');
      return;
    }

    if (
      url.includes('/dashboard/inventory/batch-distribution') ||
      url.includes('/dashboard/inventory/receiving') ||
      url.includes('/dashboard/inventory/issuance')
    ) {
      this.openGroups.add('inventory-transactions');
      return;
    }

    if (
      url.includes('/dashboard/monitoring/stock-report') ||
      url.includes('/dashboard/monitoring/transaction-history') ||
      url.includes('/dashboard/monitoring/scheduled-batches')
    ) {
      this.openGroups.add('monitoring');
      return;
    }

    for (const t of inventoryTables) {
      if (url.includes(`/maintenance/${t}`)) {
        this.openGroups.add('inventory');
        return;
      }
    }
    if (url.includes('/dashboard/system-users')) {
      this.openGroups.add('users');
      return;
    }
    for (const t of userTables) {
      if (url.includes(`/maintenance/${t}`) || url.includes('/roles')) {
        this.openGroups.add('users');
        return;
      }
    }
  }
}
