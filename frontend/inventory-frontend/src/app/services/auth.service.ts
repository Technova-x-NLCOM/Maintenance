import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError, mergeMap, throwError } from 'rxjs';

export interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  contact_info: string | null;
  role: 'super_admin' | 'inventory_manager';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  first_name: string;
  last_name: string;
  contact_info?: string | null;
  role?: 'super_admin' | 'inventory_manager';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://127.0.0.1:8000/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCurrentUser();
  }

    private getAuthHeaders(): HttpHeaders {
      const token = this.getToken();
      return new HttpHeaders({
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      });
    }

    private getToken(): string | null {
      return localStorage.getItem('access_token');
    }

    private setToken(token: string): void {
      localStorage.setItem('access_token', token);
    }

    private removeToken(): void {
      localStorage.removeItem('access_token');
    }

  private loadCurrentUser(): void {
    const token = this.getToken();
    if (!token) {
        this.currentUserSubject.next(null);
        return;
      }

    // Optimistic restore from localStorage to avoid guard redirect on refresh
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        this.currentUserSubject.next(JSON.parse(cachedUser));
      } catch {}
    }

    // Validate token and refresh user in background
    this.me().pipe(
      catchError(() => {
        this.currentUserSubject.next(null);
          this.removeToken();
        return of(null);
      })
    ).subscribe();
  }

    login(
      identifier: string,
      password: string,
      expectedRole?: 'super_admin' | 'inventory_manager'
    ): Observable<AuthResponse> {
      return this.http.post<AuthResponse>(
      `${this.API_URL}/login`,
        { identifier, password }
    ).pipe(
      mergeMap(response => {
        if (expectedRole && response.user.role !== expectedRole) {
          return throwError(() => ({
            error: {
              message:
                expectedRole === 'super_admin'
                  ? 'Access denied. This portal is for administrators only.'
                  : 'This portal is for Inventory Managers only. Please use the administrator portal.'
            }
          }));
        }

          this.setToken(response.access_token);
        this.currentUserSubject.next(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        return of(response);
      }),
      catchError(error => {
        throw error;
      })
    );
  }

    register(data: RegisterRequest): Observable<AuthResponse> {
      return this.http.post<AuthResponse>(
      `${this.API_URL}/register`,
        data
    ).pipe(
      tap(response => {
          this.setToken(response.access_token);
        this.currentUserSubject.next(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.API_URL}/logout`,
      {},
        { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
          this.removeToken();
        localStorage.removeItem('user');
      }),
      catchError(error => {
        this.currentUserSubject.next(null);
          this.removeToken();
        localStorage.removeItem('user');
        throw error;
      })
    );
  }

  me(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(
      `${this.API_URL}/me`,
        { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        this.currentUserSubject.next(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    // Consider user authenticated if a token exists; user details are refreshed via me()
    return this.getToken() !== null;
  }
}
