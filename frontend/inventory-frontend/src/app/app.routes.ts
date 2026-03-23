import { Routes } from '@angular/router';
import { LoginComponent } from './pages/auth/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { HomeComponent } from './pages/home/home.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { DashboardLayoutComponent } from './pages/dashboard/layout/dashboard-layout.component';
import { DashboardRedirectComponent } from './pages/dashboard/home/home.component';
import { SuperAdminDashboardComponent } from './pages/dashboard/super-admin/super-admin-dashboard.component';
import { InventoryManagerDashboardComponent } from './pages/dashboard/inventory-manager/inventory-manager-dashboard.component';
import { ProfileComponent } from './pages/dashboard/profile/profile.component';
import { authGuard } from './guards/auth.guard';
import { RolesComponent } from './pages/dashboard/roles/roles.component';
import { MaintenanceComponent } from './pages/dashboard/maintenance/maintenance.component';
import { SettingsComponent } from './pages/dashboard/settings/settings.component';
import { CategoryManagementComponent } from './pages/dashboard/inventory-master/categories/category-management.component';
import { ItemRegistrationUpdatesComponent } from './pages/dashboard/inventory-master/items/item-registration-updates.component';
import { BatchDistributionComponent } from './pages/dashboard/inventory-master/batch-distribution/batch-distribution.component';
import { ReceivingTransactionComponent } from './components/receiving-transaction/receiving-transaction.component';
import { IssuanceTransactionComponent } from './components/issuance-transaction/issuance-transaction.component';
import { StockAdjustmentComponent } from './components/stock-adjustment/stock-adjustment.component';
import { MonitoringComponent } from './pages/dashboard/monitoring/monitoring.component';
import { StockReportComponent } from './pages/dashboard/monitoring/stock-report/stock-report.component';
import { TransactionHistoryComponent } from './pages/dashboard/monitoring/transaction-history/transaction-history.component';
import { SystemUsersComponent } from './pages/dashboard/system-users/system-users.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin-login', component: AdminLoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardRedirectComponent },
      { path: 'super-admin', component: SuperAdminDashboardComponent },
      { path: 'inventory-manager', component: InventoryManagerDashboardComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'system-users', component: SystemUsersComponent },
      { path: 'backup', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'inventory/categories', component: CategoryManagementComponent },
      { path: 'inventory/items', component: ItemRegistrationUpdatesComponent },
      { path: 'inventory/minimum-stock', redirectTo: 'inventory/items', pathMatch: 'full' },
      { path: 'inventory/batch-distribution', component: BatchDistributionComponent },
      { path: 'inventory/receiving', component: ReceivingTransactionComponent },
      { path: 'inventory/issuance', component: IssuanceTransactionComponent },
      { path: 'inventory/adjustment', component: StockAdjustmentComponent },
      { path: 'monitoring', redirectTo: 'monitoring/stock-report', pathMatch: 'full' },
      { path: 'monitoring/stock-report', component: StockReportComponent },
      { path: 'monitoring/transaction-history', component: TransactionHistoryComponent },
      { path: 'maintenance', component: MaintenanceComponent },
      { path: 'maintenance/:table', component: MaintenanceComponent },
      { path: 'settings', component: SettingsComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
