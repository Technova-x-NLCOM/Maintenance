import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../services/auth.service';
import { SidebarComponent } from './sidebar.component';
import { filter } from 'rxjs/operators';
import { ToastOutletComponent } from '../../../components/toast-outlet/toast-outlet.component';
import { MaintenanceService } from '../../../services/maintenance.service';
import { ToastService } from '../../../services/toast.service';
import { TopbarActionService } from '../../../services/topbar-action.service';
import { getFriendlyTableName } from '../maintenance/table-config';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, ToastOutletComponent],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss'
})
export class DashboardLayoutComponent implements OnInit {
  currentUser: User | null = null;
  mobileSidebarOpen = false;
  isMobile = false;
  pageTitle = 'Dashboard';
  breadcrumb = 'NLCOM IMS / Dashboard';

  notificationOpen = false;
  expiryAlertTotal = 0;
  loadingNotifications = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private maintenanceService: MaintenanceService,
    private toastService: ToastService,
    private topbarAction: TopbarActionService
  ) {}

  ngOnInit() {
    this.handleViewport();

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.updateHeaderFromUrl(this.router.url);
    this.loadExpiryAlertCount();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateHeaderFromUrl(event.urlAfterRedirects || event.url);
        this.loadExpiryAlertCount();
      });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.notificationOpen) {
      return;
    }
    const el = ev.target as HTMLElement | null;
    if (el?.closest?.('.topbar-action-host')) {
      return;
    }
    this.closePanels();
  }

  closePanels(): void {
    this.notificationOpen = false;
  }

  toggleNotifications(ev: Event): void {
    ev.stopPropagation();
    this.notificationOpen = !this.notificationOpen;
    if (this.notificationOpen) {
      this.loadExpiryAlertCount();
    }
  }

  onPrintClick(ev: Event): void {
    ev.stopPropagation();
    this.closePanels();
    if (this.topbarAction.hasPrintHandler()) {
      this.topbarAction.runPrint();
    } else {
      this.toastService.info('Print is not available on this page.');
    }
  }

  private loadExpiryAlertCount(): void {
    this.loadingNotifications = true;
    this.maintenanceService.listRows('expiry_alerts', { page: 1, perPage: 1 }).subscribe({
      next: (res) => {
        this.expiryAlertTotal = typeof res?.total === 'number' ? res.total : 0;
        this.loadingNotifications = false;
      },
      error: () => {
        this.expiryAlertTotal = 0;
        this.loadingNotifications = false;
      }
    });
  }

  onResize(): void {
    this.handleViewport();
  }

  toggleMobileSidebar(): void {
    if (!this.isMobile) {
      return;
    }
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen = false;
  }

  private handleViewport(): void {
    this.isMobile = window.innerWidth <= 1024;
    if (!this.isMobile) {
      this.mobileSidebarOpen = false;
    }
  }

  private updateHeaderFromUrl(url: string): void {
    const path = url.split('?')[0].replace(/\/$/, '') || '/';

    const map: Array<{ match: string; title: string; breadcrumb: string }> = [
      { match: '/dashboard/maintenance/inventory_transactions', title: 'Transactions', breadcrumb: 'NLCOM IMS / Transactions' },
      { match: '/dashboard/maintenance/inventory_snapshots', title: 'Inventory Snapshots', breadcrumb: 'NLCOM IMS / Inventory / Snapshots' },
      { match: '/dashboard/maintenance/inventory_batches', title: 'Inventory Batches', breadcrumb: 'NLCOM IMS / Inventory / Batches' },
      { match: '/dashboard/maintenance/expiry_alerts', title: 'Expiry Alerts', breadcrumb: 'NLCOM IMS / Expiry Alerts' },
      { match: '/dashboard/maintenance/role_permissions', title: 'Role Permissions', breadcrumb: 'NLCOM IMS / Administration / Role Permissions' },
      { match: '/dashboard/maintenance/user_roles', title: 'User Roles', breadcrumb: 'NLCOM IMS / Administration / User Roles' },
      { match: '/dashboard/maintenance/item_types', title: 'Item Types', breadcrumb: 'NLCOM IMS / Administration / Item Types' },
      { match: '/dashboard/maintenance/audit_log', title: 'Activity Log', breadcrumb: 'NLCOM IMS / Activity Log' },
      { match: '/dashboard/maintenance/permissions', title: 'Permissions', breadcrumb: 'NLCOM IMS / Administration / Permissions' },
      { match: '/dashboard/maintenance/users', title: 'User Management', breadcrumb: 'NLCOM IMS / Administration / Users' },
      { match: '/dashboard/maintenance/items', title: 'Inventory Items', breadcrumb: 'NLCOM IMS / Inventory / Items' },
      { match: '/dashboard/inventory/minimum-stock', title: 'Minimum Stock', breadcrumb: 'NLCOM IMS / Inventory / Minimum Stock' },
      { match: '/dashboard/inventory/categories', title: 'Category Management', breadcrumb: 'NLCOM IMS / Inventory / Categories' },
      { match: '/dashboard/inventory/items', title: 'Item Registration & Updates', breadcrumb: 'NLCOM IMS / Inventory / Items' },
      { match: '/dashboard/inventory/receiving', title: 'Stock Receiving (IN)', breadcrumb: 'NLCOM IMS / Inventory / Receiving' },
      { match: '/dashboard/inventory/issuance', title: 'Stock Issuance (OUT)', breadcrumb: 'NLCOM IMS / Inventory / Issuance' },
      { match: '/dashboard/inventory-manager', title: 'Inventory Manager', breadcrumb: 'NLCOM IMS / Inventory Manager' },
      { match: '/dashboard/super-admin', title: 'Super Admin', breadcrumb: 'NLCOM IMS / Super Admin' },
      { match: '/dashboard/unauthorized', title: 'Unauthorized', breadcrumb: 'NLCOM IMS / Unauthorized' },
      { match: '/dashboard/reports', title: 'Reports', breadcrumb: 'NLCOM IMS / Reports' },
      { match: '/dashboard/settings', title: 'Settings', breadcrumb: 'NLCOM IMS / Administration / Settings' },
      { match: '/dashboard/maintenance/roles', title: 'Roles', breadcrumb: 'NLCOM IMS / Administration / Roles' },
      { match: '/dashboard/roles', title: 'Roles & Permissions', breadcrumb: 'NLCOM IMS / Administration / Roles & Permissions' },
      { match: '/dashboard/backup', title: 'Database Backups', breadcrumb: 'NLCOM IMS / Backup' },
      { match: '/dashboard/profile', title: 'Profile', breadcrumb: 'NLCOM IMS / Profile' }
    ];

    const sorted = [...map].sort((a, b) => b.match.length - a.match.length);
    const found = sorted.find(entry => url.includes(entry.match));
    if (found) {
      this.pageTitle = found.title;
      this.breadcrumb = found.breadcrumb;
      return;
    }

    if (path === '/dashboard/maintenance') {
      this.pageTitle = 'Maintenance';
      this.breadcrumb = 'NLCOM IMS / Maintenance';
      return;
    }

    const maint = path.match(/\/dashboard\/maintenance\/([^/]+)/);
    if (maint) {
      const friendly = getFriendlyTableName(maint[1]);
      this.pageTitle = friendly;
      this.breadcrumb = `NLCOM IMS / ${friendly}`;
      return;
    }

    this.pageTitle = 'Dashboard';
    this.breadcrumb = 'NLCOM IMS / Dashboard';
  }
}
