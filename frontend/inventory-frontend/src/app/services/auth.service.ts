import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError } from 'rxjs';

export interface User {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  contact_info: string | null;
  role: 'admin' | 'staff';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  contact_info?: string;
  role?: 'admin' | 'staff';
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

  private loadCurrentUser(): void {
    this.me().pipe(
      catchError(() => {
        this.currentUserSubject.next(null);
        return of(null);
      })
    ).subscribe();
  }

  login(identifier: string, password: string): Observable<{ message: string; user: User }> {
    return this.http.post<{ message: string; user: User }>(
      `${this.API_URL}/login`,
      { identifier, password },
      { withCredentials: true }
    ).pipe(
      tap(response => {
        this.currentUserSubject.next(response.user);
        sessionStorage.setItem('user', JSON.stringify(response.user));
      }),
      catchError(error => {
        throw error;
      })
    );
  }

  register(data: RegisterRequest): Observable<{ message: string; user: User }> {
    return this.http.post<{ message: string; user: User }>(
      `${this.API_URL}/register`,
      data,
      { withCredentials: true }
    ).pipe(
      tap(response => {
        this.currentUserSubject.next(response.user);
        sessionStorage.setItem('user', JSON.stringify(response.user));
      })
    );
  }

  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.API_URL}/logout`,
      {},
      { withCredentials: true }
    ).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
        sessionStorage.removeItem('user');
      }),
      catchError(error => {
        this.currentUserSubject.next(null);
        sessionStorage.removeItem('user');
        throw error;
      })
    );
  }

  me(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(
      `${this.API_URL}/me`,
      { withCredentials: true }
    ).pipe(
      tap(response => {
        this.currentUserSubject.next(response.user);
        sessionStorage.setItem('user', JSON.stringify(response.user));
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
