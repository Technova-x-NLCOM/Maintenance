import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const REFRESH_SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/check-password-set',
  '/api/auth/set-initial-password',
  '/api/auth/forgot-password',
  '/api/auth/reset-password'
];

export const authRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);

  if (REFRESH_SKIP_PATHS.some(path => request.url.includes(path))) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !authService.isAuthenticated()) {
        return throwError(() => error);
      }

      return authService.refreshToken().pipe(
        switchMap(response => next(request.clone({
          setHeaders: {
            Authorization: `Bearer ${response.access_token}`
          }
        }))),
        catchError(refreshError => throwError(() => refreshError))
      );
    })
  );
};