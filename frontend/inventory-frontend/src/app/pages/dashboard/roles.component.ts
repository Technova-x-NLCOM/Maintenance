import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RbacService, Role } from '../../rbac/services/rbac.service';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit {
  roles: Role[] = [];
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
    this.rbac.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.message || 'Failed to load roles';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startEdit(role: Role) {
    this.editingRoleId = role.role_id;
    this.editPermissions = {};
    (role.permissions || []).forEach(p => {
      this.editPermissions[p.permission_id] = {
        can_create: !!p.pivot?.can_create,
        can_read: typeof p.pivot?.can_read === 'undefined' ? true : !!p.pivot?.can_read,
        can_update: !!p.pivot?.can_update,
        can_delete: !!p.pivot?.can_delete,
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

    const updates = Object.keys(this.editPermissions).map(pid => {
      const permissionId = Number(pid);
      const flags = this.editPermissions[permissionId];
      return this.rbac.updatePermissionFlags(role.role_id, permissionId, flags).toPromise();
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
}
