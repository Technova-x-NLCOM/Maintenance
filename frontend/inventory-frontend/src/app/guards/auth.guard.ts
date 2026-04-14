import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RbacService } from '../rbac/services/rbac.service';
import { inject } from '@angular/core';
import { map, catchError, of } from 'rxjs';

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

    router.navigate(['/login']);
    return false;
  };
};

export const permissionGuard = (permission: string): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const authService = inject(AuthService);
    const rbacService = inject(RbacService);

    if (!authService.isAuthenticated()) {
      return router.parseUrl('/login');
    }

    return rbacService.getCurrentRole().pipe(
      map((role) => {
        if (rbacService.roleHasPermission(role, permission)) {
          return true;
        }

        return router.parseUrl('/dashboard');
      }),
      catchError(() => of(router.parseUrl('/dashboard')))
    );
  };
};
