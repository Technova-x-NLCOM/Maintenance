import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SystemUserDto {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  contact_info: string | null;
  is_active: boolean;
  role_name: string | null;
  role_display_name: string | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  first_name: string;
  last_name: string;
  contact_info?: string | null;
  role?: 'super_admin' | 'inventory_manager';
  is_active?: boolean;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  contact_info?: string | null;
  role?: 'super_admin' | 'inventory_manager';
  password?: string;
  password_confirmation?: string;
  is_active?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly baseUrl = '/api/users';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
  }

  list(): Observable<SystemUserDto[]> {
    return this.http.get<SystemUserDto[]>(this.baseUrl, { headers: this.headers() });
  }

  create(payload: CreateUserPayload): Observable<{ message: string; user: SystemUserDto }> {
    return this.http.post<{ message: string; user: SystemUserDto }>(this.baseUrl, payload, {
      headers: this.headers(),
    });
  }

  update(
    userId: number,
    payload: UpdateUserPayload
  ): Observable<{ message: string; user: SystemUserDto }> {
    return this.http.put<{ message: string; user: SystemUserDto }>(`${this.baseUrl}/${userId}`, payload, {
      headers: this.headers(),
    });
  }
}
