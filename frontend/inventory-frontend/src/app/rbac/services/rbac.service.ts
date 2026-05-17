import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { getApiBaseUrl } from '../../services/api-base';

export interface Permission {
  permission_id: number;
  permission_name: string;
  display_name?: string | null;
  description?: string | null;
  pivot?: {
    role_id: number;
    permission_id: number;
    can_create?: boolean;
    can_read?: boolean;
    can_update?: boolean;
    can_delete?: boolean;
    created_at?: string;
    updated_at?: string;
  };
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
  private readonly API_URL = `${getApiBaseUrl()}/rbac`;

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

  getCurrentRole(): Observable<Role | null> {
    return this.http
      .get<{ role: Role | null }>(`${this.API_URL}/me/permissions`, { headers: this.authHeaders() })
      .pipe(map((res) => res.role ?? null));
  }

  updatePermissionFlags(role_id: number, permission_id: number, flags: { can_create?: boolean; can_read?: boolean; can_update?: boolean; can_delete?: boolean; }) {
    const payload: any = { role_id, permission_id };
    if (typeof flags.can_create !== 'undefined') payload.can_create = !!flags.can_create;
    if (typeof flags.can_read !== 'undefined') payload.can_read = !!flags.can_read;
    if (typeof flags.can_update !== 'undefined') payload.can_update = !!flags.can_update;
    if (typeof flags.can_delete !== 'undefined') payload.can_delete = !!flags.can_delete;
    return this.http.patch(`${this.API_URL}/role-permission`, payload, { headers: this.authHeaders() });
  }

  /**
   * Attach a permission to a role and set flags. Uses permission_name as required by backend.
   */
  givePermission(role_id: number, permission_name: string, flags: { can_create?: boolean; can_read?: boolean; can_update?: boolean; can_delete?: boolean; }) {
    const payload: any = { role_id, permission_name };
    if (typeof flags.can_create !== 'undefined') payload.can_create = !!flags.can_create;
    if (typeof flags.can_read !== 'undefined') payload.can_read = !!flags.can_read;
    if (typeof flags.can_update !== 'undefined') payload.can_update = !!flags.can_update;
    if (typeof flags.can_delete !== 'undefined') payload.can_delete = !!flags.can_delete;
    return this.http.post(`${this.API_URL}/give-permission`, payload, { headers: this.authHeaders() });
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(role: Role | undefined | null, permissionName: string): boolean {
    if (!role || !role.permissions) {
      return false;
    }
    return role.permissions.some((perm) => {
      if (perm.permission_name !== permissionName) return false;
      const pivot = perm.pivot;
      return pivot ? !!(pivot.can_read || pivot.can_create || pivot.can_update || pivot.can_delete) : true;
    });
  }
}
