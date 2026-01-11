import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Permission {
  permission_id: number;
  permission_name: string;
  display_name?: string | null;
  description?: string | null;
}

export interface Role {
  role_id: number;
  role_name: string;
  display_name?: string | null;
  description?: string | null;
  is_system_role?: boolean;
  permissions?: Permission[];
}

@Injectable({
  providedIn: 'root'
})
export class RbacService {
  private readonly API_URL = 'http://127.0.0.1:8000/api/rbac';

  constructor(private http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.API_URL}/roles`, { headers: this.authHeaders() });
  }

  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.API_URL}/permissions`, { headers: this.authHeaders() });
  }
}
