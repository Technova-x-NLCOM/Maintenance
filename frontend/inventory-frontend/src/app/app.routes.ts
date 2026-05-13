import { Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login/login.component';
import { ResetPasswordComponent } from './pages/auth/reset-password/reset-password.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
import { DashboardRedirectComponent } from './components/dashboard/dashboard-redirect.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { InventoryManagerDashboardComponent } from './components/inventory-manager/inventory-manager-dashboard.component';
import { ProfileComponent } from './components/profile/profile.component';
import { authGuard } from './guards/auth.guard';
import { RolesComponent } from './components/roles/roles.component';
import { MaintenanceComponent } from './components/maintenance/maintenance.component';
import { SettingsComponent } from './components/settings/settings.component';
import { CategoryManagementComponent } from './components/inventory-master/categories/category-management.component';
import { LocationsManagementComponent } from './components/inventory-master/locations/locations-management.component';
import { ItemRegistrationUpdatesComponent } from './components/inventory-master/items/item-registration-updates.component';
import { BatchDistributionComponent } from './components/inventory-master/batch-distribution/batch-distribution.component';
import { ReceivingTransactionComponent } from './components/receiving-transaction/receiving-transaction.component';
import { IssuanceTransactionComponent } from './components/issuance-transaction/issuance-transaction.component';
import { StockReportComponent } from './components/monitoring/stock-report/stock-report.component';
import { TransactionHistoryComponent } from './components/monitoring/transaction-history/transaction-history.component';
import { ScheduledBatchesComponent } from './components/monitoring/scheduled-batches/scheduled-batches.component';
import { StorageInventoryComponent } from './components/monitoring/storage-inventory/storage-inventory.component';
import { SystemUsersComponent } from './components/system-users/system-users.component';
import { AuditLogComponent } from './components/audit-log/audit-log.component';
import { permissionGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'admin-login', component: AdminLoginComponent },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardRedirectComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'inventory-manager', component: InventoryManagerDashboardComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'system-users', component: SystemUsersComponent },
      { path: 'backup', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'inventory/categories', component: CategoryManagementComponent },
      { path: 'inventory/locations', component: LocationsManagementComponent },
      { path: 'inventory/items', component: ItemRegistrationUpdatesComponent },
      { path: 'inventory/minimum-stock', redirectTo: 'inventory/items', pathMatch: 'full' },
      { path: 'inventory/batch-distribution', component: BatchDistributionComponent },
      { path: 'inventory/receiving', component: ReceivingTransactionComponent },
      { path: 'inventory/issuance', component: IssuanceTransactionComponent },
      { path: 'monitoring', redirectTo: 'monitoring/stock-report', pathMatch: 'full' },
      { path: 'monitoring/stock-report', component: StockReportComponent },
      { path: 'monitoring/storage-inventory', component: StorageInventoryComponent },
      { path: 'monitoring/transaction-history', component: TransactionHistoryComponent },
      { path: 'monitoring/scheduled-batches', component: ScheduledBatchesComponent },
      { path: 'audit-log', component: AuditLogComponent, canActivate: [permissionGuard('view_audit')] },
      { path: 'maintenance', component: MaintenanceComponent },
      { path: 'maintenance/:table', component: MaintenanceComponent },
      { path: 'settings', component: SettingsComponent }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
