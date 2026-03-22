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
import { authGuard, roleGuard, maintenanceTableGuard } from './guards/auth.guard';
import { RolesComponent } from './pages/dashboard/roles/roles.component';
import { BackupComponent } from './pages/dashboard/backup/backup.component';
import { MaintenanceComponent } from './pages/dashboard/maintenance/maintenance.component';
import { SettingsComponent } from './pages/dashboard/settings/settings.component';
import { CategoryManagementComponent } from './pages/dashboard/inventory-master/categories/category-management.component';
import { ItemRegistrationUpdatesComponent } from './pages/dashboard/inventory-master/items/item-registration-updates.component';
import { MinimumStockSetupComponent } from './pages/dashboard/inventory-master/minimum-stock/minimum-stock-setup.component';
import { ReceivingTransactionComponent } from './components/receiving-transaction/receiving-transaction.component';
import { IssuanceTransactionComponent } from './components/issuance-transaction/issuance-transaction.component';
import { ReportsComponent } from './pages/dashboard/reports/reports.component';
import { UnauthorizedComponent } from './pages/unauthorized/unauthorized.component';
import { UserManagementComponent } from './pages/dashboard/user-management/user-management.component';

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
      { path: 'unauthorized', component: UnauthorizedComponent },
      { path: 'super-admin', component: SuperAdminDashboardComponent },
      { path: 'inventory-manager', component: InventoryManagerDashboardComponent },
      { path: 'profile', component: ProfileComponent },
        { path: 'roles', component: RolesComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'backup', component: BackupComponent },
      { path: 'inventory/categories', component: CategoryManagementComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'inventory/items', component: ItemRegistrationUpdatesComponent },
      { path: 'inventory/minimum-stock', component: MinimumStockSetupComponent },
      { path: 'inventory/receiving', component: ReceivingTransactionComponent },
      { path: 'inventory/issuance', component: IssuanceTransactionComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'maintenance', component: MaintenanceComponent },
      { path: 'maintenance/users', component: UserManagementComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/item_types', component: MaintenanceComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/user_roles', component: MaintenanceComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/roles', component: MaintenanceComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/permissions', component: MaintenanceComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/role_permissions', component: MaintenanceComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/audit_log', component: MaintenanceComponent, canActivate: [roleGuard(['super_admin'])] },
      { path: 'maintenance/:table', component: MaintenanceComponent, canActivate: [maintenanceTableGuard] },
      { path: 'settings', component: SettingsComponent, canActivate: [roleGuard(['super_admin'])] }
    ]
  },
  { path: '**', redirectTo: '' }
];
