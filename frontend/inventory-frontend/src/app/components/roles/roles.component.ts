import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RbacService, Role, Permission } from '../../rbac/services/rbac.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
  styleUrls: ['./roles.component.scss']
})
export class RolesComponent implements OnInit {
  roles: Role[] = [];
  permissions: Permission[] = [];
  currentRole: Role | null = null;
  loading = false;
  error: string | null = null;

  // Create role modal
  showCreateModal = false;
  newRole: { role_name: string; display_name?: string; description?: string; is_system_role?: boolean } = { role_name: '', is_system_role: true };
  savingNewRole = false;
  createRoleError: string | null = null;

  // Editing state: permissionId → granted (true/false)
  editingRoleId: number | null = null;
  editGranted: { [permissionId: number]: boolean } = {};
  savingRoles: { [roleId: number]: boolean } = {};

  constructor(private rbac: RbacService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadRoles();
  }

  loadRoles(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      roles: this.rbac.getRoles(),
      permissions: this.rbac.getPermissions(),
      currentRole: this.rbac.getCurrentRole()
    }).subscribe({
      next: ({ roles, permissions, currentRole }) => {
        this.currentRole = currentRole || null;
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

  hasManageRoles(): boolean {
    return this.rbac.roleHasPermission(this.currentRole || undefined, 'manage_roles');
  }

  // ── Create modal ──────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.createRoleError = null;
    this.newRole = { role_name: '', is_system_role: true };
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createRoleError = null;
  }

  get canSubmitCreateRole(): boolean {
    return !!this.newRole.role_name?.trim() && !this.savingNewRole;
  }

  submitCreateRole(): void {
    const roleName = this.newRole.role_name.trim();
    if (!roleName) { this.createRoleError = 'Role name is required'; return; }
    this.createRoleError = null;
    this.savingNewRole = true;
    this.rbac.createRole({
      ...this.newRole,
      role_name: roleName,
      display_name: this.newRole.display_name?.trim() || undefined,
      description: this.newRole.description?.trim() || undefined,
    }).subscribe({
      next: () => {
        this.savingNewRole = false;
        this.showCreateModal = false;
        this.loadRoles();
      },
      error: (err) => {
        this.savingNewRole = false;
        const details = err?.error;
        const validationMsg = details?.errors ? Object.values(details.errors).flat().join(' ') : null;
        this.createRoleError = details?.message || validationMsg || err?.message || 'Failed to create role';
        this.cdr.detectChanges();
      }
    });
  }

  // ── Permission editing ────────────────────────────────────────────────────

  startEdit(role: Role): void {
    if (role.role_name === 'super_admin') return;
    this.editingRoleId = role.role_id;
    this.editGranted = {};

    const attached = new Set((role.permissions || []).map(p => p.permission_id));
    (this.permissions || []).forEach(perm => {
      // A permission is considered "granted" if it exists on the role (any flag true)
      const pivot = (role.permissions || []).find(p => p.permission_id === perm.permission_id)?.pivot;
      const hasAny = pivot
        ? !!(pivot.can_create || pivot.can_read || pivot.can_update || pivot.can_delete)
        : false;
      this.editGranted[perm.permission_id] = attached.has(perm.permission_id) && hasAny;
    });
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingRoleId = null;
    this.editGranted = {};
  }

  toggleGranted(permissionId: number): void {
    if (!(permissionId in this.editGranted)) return;
    this.editGranted[permissionId] = !this.editGranted[permissionId];
  }

  saveRolePermissions(role: Role): void {
    if (!this.editingRoleId || this.editingRoleId !== role.role_id) return;
    this.savingRoles[role.role_id] = true;

    const attached = new Set((role.permissions || []).map(p => p.permission_id));
    const allFlags = { can_create: true, can_read: true, can_update: true, can_delete: true };
    const noFlags  = { can_create: false, can_read: false, can_update: false, can_delete: false };

    const updates = Object.keys(this.editGranted).map(async pidStr => {
      const permissionId = Number(pidStr);
      const granted = this.editGranted[permissionId];
      const permMeta = (this.permissions || []).find(p => p.permission_id === permissionId);
      if (!permMeta) return;

      if (attached.has(permissionId)) {
        // Update existing pivot: set all flags on or all off
        await this.rbac.updatePermissionFlags(role.role_id, permissionId, granted ? allFlags : noFlags).toPromise();
      } else if (granted) {
        // Not yet attached — attach with all flags on
        await this.rbac.givePermission(role.role_id, permMeta.permission_name, allFlags).toPromise();
      }
      // If not attached and not granted — nothing to do
    });

    Promise.all(updates)
      .then(() => {
        this.savingRoles[role.role_id] = false;
        this.editingRoleId = null;
        this.editGranted = {};
        this.loadRoles();
      })
      .catch(err => {
        this.savingRoles[role.role_id] = false;
        this.error = err?.message || 'Failed to update permissions';
        this.cdr.detectChanges();
      });
  }

  // ── View helpers ──────────────────────────────────────────────────────────

  isGranted(role: Role, permissionId: number): boolean {
    const pivot = (role.permissions || []).find(p => p.permission_id === permissionId)?.pivot;
    return pivot
      ? !!(pivot.can_create || pivot.can_read || pivot.can_update || pivot.can_delete)
      : false;
  }
}
