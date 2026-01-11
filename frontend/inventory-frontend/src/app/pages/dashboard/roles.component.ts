import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RbacService, Role, Permission } from '../../rbac/services/rbac.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit {
  roles: Role[] = [];
  permissions: Permission[] = [];
  loading = false;
  error: string | null = null;
  // editing state per role
  editingRoleId: number | null = null;
  editPermissions: { [permissionId: number]: { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean } } = {};
  savingRoles: { [roleId: number]: boolean } = {};

  constructor(private rbac: RbacService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.error = null;
    forkJoin({ roles: this.rbac.getRoles(), permissions: this.rbac.getPermissions() }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles = roles || [];
        this.permissions = permissions || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.message || 'Failed to load roles & permissions';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startEdit(role: Role) {
    this.editingRoleId = role.role_id;
    this.editPermissions = {};
    // Initialize all known permissions; default to false if role doesn't have it in DB
    const attached = new Map<number, Permission>();
    (role.permissions || []).forEach(p => attached.set(p.permission_id, p));

    (this.permissions || []).forEach(perm => {
      const existing = attached.get(perm.permission_id);
      this.editPermissions[perm.permission_id] = {
        can_create: !!existing?.pivot?.can_create,
        // Default missing perms to false (no access) as requested
        can_read: !!existing?.pivot?.can_read,
        can_update: !!existing?.pivot?.can_update,
        can_delete: !!existing?.pivot?.can_delete,
      };
    });
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.editingRoleId = null;
    this.editPermissions = {};
  }

  toggleFlag(permissionId: number, flag: 'can_create' | 'can_read' | 'can_update' | 'can_delete') {
    if (!this.editPermissions[permissionId]) return;
    this.editPermissions[permissionId][flag] = !this.editPermissions[permissionId][flag];
  }

  saveRolePermissions(role: Role) {
    if (!this.editingRoleId || this.editingRoleId !== role.role_id) return;
    this.savingRoles[role.role_id] = true;
    const attachedIds = new Set((role.permissions || []).map(p => p.permission_id));
    const updates = Object.keys(this.editPermissions).map(async pidStr => {
      const permissionId = Number(pidStr);
      const flags = this.editPermissions[permissionId];
      const permMeta = (this.permissions || []).find(p => p.permission_id === permissionId);
      if (!permMeta) return;

      // If role already has this permission, update flags
      if (attachedIds.has(permissionId)) {
        await this.rbac.updatePermissionFlags(role.role_id, permissionId, flags).toPromise();
      } else {
        // Only attach if any flag is true; otherwise keep as no permission
        const wantsAny = !!flags.can_create || !!flags.can_read || !!flags.can_update || !!flags.can_delete;
        if (wantsAny) {
          await this.rbac.givePermission(role.role_id, permMeta.permission_name, flags).toPromise();
        }
      }
    });

    Promise.all(updates)
      .then(() => {
        this.savingRoles[role.role_id] = false;
        this.editingRoleId = null;
        this.editPermissions = {};
        this.loadRoles();
      })
      .catch(err => {
        this.savingRoles[role.role_id] = false;
        this.error = err?.message || 'Failed to update permissions';
        this.cdr.detectChanges();
      });
  }

  // Helper: find pivot for a role+permission by id
  pivotFor(role: Role, permissionId: number) {
    const p = (role.permissions || []).find(x => x.permission_id === permissionId);
    return p?.pivot;
  }
}
