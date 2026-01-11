import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { DashboardLayoutComponent } from './pages/dashboard/dashboard-layout.component';
import { HomeComponent as DashboardHomeComponent } from './pages/dashboard/home.component';
import { ProfileComponent } from './pages/dashboard/profile.component';
import { authGuard } from './guards/auth.guard';
import { RolesComponent } from './pages/dashboard/roles.component';
import { BackupComponent } from './pages/dashboard/backup/backup.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home', component: DashboardHomeComponent },
      { path: 'profile', component: ProfileComponent },
        { path: 'roles', component: RolesComponent },
      { path: 'backup', component: BackupComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '' }
];
