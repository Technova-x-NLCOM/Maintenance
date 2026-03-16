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
import { BackupComponent } from './pages/dashboard/backup/backup.component';
import { MaintenanceComponent } from './pages/dashboard/maintenance/maintenance.component';
import { SettingsComponent } from './pages/dashboard/settings/settings.component';
import { CategoryManagementComponent } from './pages/dashboard/inventory-master/categories/category-management.component';
import { ItemRegistrationUpdatesComponent } from './pages/dashboard/inventory-master/items/item-registration-updates.component';
import { MinimumStockSetupComponent } from './pages/dashboard/inventory-master/minimum-stock/minimum-stock-setup.component';

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
      { path: 'backup', component: BackupComponent },
      { path: 'inventory/categories', component: CategoryManagementComponent },
      { path: 'inventory/items', component: ItemRegistrationUpdatesComponent },
      { path: 'inventory/minimum-stock', component: MinimumStockSetupComponent },
      { path: 'maintenance', component: MaintenanceComponent },
      { path: 'maintenance/:table', component: MaintenanceComponent },
      { path: 'settings', component: SettingsComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
