import { Injectable } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const roleGuard = (roles: ('super_admin' | 'inventory_manager')[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authService.getCurrentUser();
    if (user && roles.includes(user.role)) {
      return true;
    }

    if (user) {
      router.navigate(['/dashboard/unauthorized']);
      return false;
    }

    router.navigate(['/login']);
    return false;
  };
};

export const maintenanceTableGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  const table = String(route.params['table'] || '').toLowerCase();
  if (user.role === 'super_admin') {
    return true;
  }

  const restrictedTables = new Set([
    'users',
    'user_roles',
    'roles',
    'permissions',
    'role_permissions',
    'audit_log',
    'system_settings',
    'item_types',
    'categories'
  ]);

  if (restrictedTables.has(table)) {
    router.navigate(['/dashboard/unauthorized']);
    return false;
  }

  return true;
};
