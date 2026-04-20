import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UserManagementService, SystemUserDto } from '../../../services/user-management.service';
import { RbacService, Role } from '../../../rbac/services/rbac.service';
import { AuthService, User } from '../../../services/auth.service';

@Component({
  selector: 'app-system-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-users.component.html',
  styleUrl: './system-users.component.scss',
})
export class SystemUsersComponent implements OnInit {
  users: SystemUserDto[] = [];
  userSearch = '';
  roles: Role[] = [];
  loading = true;
  error: string | null = null;
  currentUser: User | null = null;
  currentRole: Role | null = null;

  // Add/Edit modal
  showModal = false;
  editingUser: SystemUserDto | null = null;
  saving = false;
  modalError: string | null = null;
  fieldErrors: Record<string, string[]> = {};
  showPassword = false;
  showPasswordConfirm = false;

  // Inactive users modal
  showInactiveModal = false;
  inactivePage = 1;
  readonly inactivePageSize = 10;

  // Confirmation modal (deactivate / activate)
  showConfirmModal = false;
  confirmAction: 'deactivate' | 'activate' = 'deactivate';
  confirmTargetUser: SystemUserDto | null = null;
  confirmLoading = false;

  // Active table pagination
  activePage = 1;
  readonly activePageSize = 10;

  form = {
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    contact_info: '',
    role: 'inventory_manager' as 'super_admin' | 'inventory_manager',
    password: '',
    password_confirmation: '',
    is_active: true,
  };

  private readonly avatarPalette = [
    '#2563eb',
    '#7c3aed',
    '#059669',
    '#d97706',
    '#db2777',
    '#0891b2',
  ];

  constructor(
    private api: UserManagementService,
    private rbac: RbacService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.subscribe((u) => {
      this.currentUser = u;
      this.cdr.markForCheck();
    });

    const cached = this.auth.getCurrentUser();
    if (cached) {
      this.beginLoadForUser(cached);
      return;
    }

    this.auth.me().subscribe({
      next: (res) => this.beginLoadForUser(res.user),
      error: () => this.router.navigate(['/login']),
    });
  }

  private beginLoadForUser(u: User | null): void {
    if (!u) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = u;
    this.rbac
      .getCurrentRole()
      .pipe(catchError(() => of(null)))
      .subscribe((role) => {
        this.currentRole = role;
        if (!this.hasManageRoles()) {
          this.router.navigate(['/dashboard']);
          return;
        }
        this.load();
      });
  }

  hasManageRoles(): boolean {
    if (this.currentUser?.role === 'super_admin') return true;
    return this.rbac.roleHasPermission(this.currentRole, 'manage_roles');
  }

  load(): void {
    this.loading = true;
    this.error = null;
    forkJoin({
      users: this.api.list(),
      roles: this.rbac.getRoles(),
    }).subscribe({
      next: ({ users, roles }) => {
        this.users = users || [];
        this.roles = (roles || []).filter((r) =>
          ['super_admin', 'inventory_manager'].includes(r.role_name),
        );
        this.activePage = 1;
        this.inactivePage = 1;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403 || err.status === 401) this.router.navigate(['/dashboard']);
        this.error = this.httpErr(err, 'Could not load users.');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Active users (main table) ──────────────────────────────
  get activeUsers(): SystemUserDto[] {
    const q = this.userSearch.trim().toLowerCase();
    const list = this.users.filter((u) => u.is_active);
    if (!q) return list;
    return list.filter((u) => {
      const name = `${u.first_name} ${u.last_name}`.toLowerCase();
      return (
        name.includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        this.roleLabel(u).toLowerCase().includes(q)
      );
    });
  }

  get activeTotalPages(): number {
    return Math.max(1, Math.ceil(this.activeUsers.length / this.activePageSize));
  }

  get pagedActiveUsers(): SystemUserDto[] {
    const start = (this.activePage - 1) * this.activePageSize;
    return this.activeUsers.slice(start, start + this.activePageSize);
  }

  activePageRange(): number[] {
    return Array.from({ length: this.activeTotalPages }, (_, i) => i + 1);
  }

  goActivePage(p: number): void {
    if (p < 1 || p > this.activeTotalPages) return;
    this.activePage = p;
  }

  // ── Inactive users (modal table) ──────────────────────────
  get inactiveUsers(): SystemUserDto[] {
    return this.users.filter((u) => !u.is_active);
  }

  get inactiveTotalPages(): number {
    return Math.max(1, Math.ceil(this.inactiveUsers.length / this.inactivePageSize));
  }

  get pagedInactiveUsers(): SystemUserDto[] {
    const start = (this.inactivePage - 1) * this.inactivePageSize;
    return this.inactiveUsers.slice(start, start + this.inactivePageSize);
  }

  inactivePageRange(): number[] {
    return Array.from({ length: this.inactiveTotalPages }, (_, i) => i + 1);
  }

  goInactivePage(p: number): void {
    if (p < 1 || p > this.inactiveTotalPages) return;
    this.inactivePage = p;
  }

  openInactiveModal(): void {
    this.inactivePage = 1;
    this.showInactiveModal = true;
  }

  closeInactiveModal(): void {
    this.showInactiveModal = false;
  }

  // ── Add / Edit ─────────────────────────────────────────────
  openAdd(): void {
    this.editingUser = null;
    this.resetForm();
    this.resetPasswordVisibility();
    this.modalError = null;
    this.fieldErrors = {};
    this.showModal = true;
  }

  openEdit(u: SystemUserDto): void {
    this.editingUser = u;
    this.form = {
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      email: u.email,
      contact_info: u.contact_info || '',
      role:
        u.role_name === 'super_admin' || u.role_name === 'inventory_manager'
          ? u.role_name
          : 'inventory_manager',
      password: '',
      password_confirmation: '',
      is_active: u.is_active,
    };
    this.resetPasswordVisibility();
    this.modalError = null;
    this.fieldErrors = {};
    this.showModal = true;
  }

  closeModal(): void {
    if (this.saving) return;
    this.showModal = false;
    this.editingUser = null;
    this.resetPasswordVisibility();
  }

  bounceModal(selector: string): void {
    const el = document.querySelector<HTMLElement>(`.${selector}`);
    if (!el) return;
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.05)' },
        { transform: 'scale(0.97)' },
        { transform: 'scale(1.02)' },
        { transform: 'scale(1)' },
      ],
      { duration: 400, easing: 'ease' },
    );
  }

  private resetPasswordVisibility(): void {
    this.showPassword = false;
    this.showPasswordConfirm = false;
  }

  normalizeUsername(): void {
    let v = (this.form.username || '').trim();
    if (v.startsWith('@')) v = v.slice(1);
    this.form.username = v;
  }

  save(): void {
    this.modalError = null;
    this.fieldErrors = {};
    this.normalizeUsername();
    this.form.first_name = (this.form.first_name || '').trim();
    this.form.last_name = (this.form.last_name || '').trim();

    if (!this.form.first_name) {
      this.modalError = 'First name is required.';
      return;
    }
    if (!this.form.last_name) {
      this.modalError = 'Last name is required.';
      return;
    }

    this.saving = true;
    const contact = this.form.contact_info?.trim() || null;

    if (!this.editingUser) {
      this.api
        .create({
          username: this.form.username,
          email: this.form.email,
          password: undefined as any,
          password_confirmation: undefined as any,
          first_name: this.form.first_name,
          last_name: this.form.last_name,
          contact_info: contact,
          role: this.form.role,
          is_active: this.form.is_active,
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.showModal = false;
            this.load();
          },
          error: (err: HttpErrorResponse) => this.handleSaveError(err),
        });
    } else {
      const payload: Record<string, unknown> = {
        first_name: this.form.first_name,
        last_name: this.form.last_name,
        username: this.form.username,
        email: this.form.email,
        contact_info: contact,
        role: this.form.role,
        is_active: this.form.is_active,
      };
      if (this.form.password) {
        payload['password'] = this.form.password;
        payload['password_confirmation'] = this.form.password_confirmation;
      }
      this.api.update(this.editingUser.user_id, payload as any).subscribe({
        next: () => {
          this.saving = false;
          this.showModal = false;
          this.load();
        },
        error: (err: HttpErrorResponse) => this.handleSaveError(err),
      });
    }
  }

  toggleActive(u: SystemUserDto): void {
    if (this.currentUser?.user_id === u.user_id) return;
    this.confirmTargetUser = u;
    this.confirmAction = 'deactivate';
    this.showConfirmModal = true;
  }

  activateUser(u: SystemUserDto): void {
    this.confirmTargetUser = u;
    this.confirmAction = 'activate';
    this.showConfirmModal = true;
  }

  confirmStatusChange(): void {
    if (!this.confirmTargetUser) return;
    const u = this.confirmTargetUser;
    const newStatus = this.confirmAction === 'activate';
    this.confirmLoading = true;
    this.api.update(u.user_id, { is_active: newStatus }).subscribe({
      next: () => {
        this.confirmLoading = false;
        this.showConfirmModal = false;
        this.confirmTargetUser = null;
        if (!newStatus && this.pagedInactiveUsers.length === 1 && this.inactivePage > 1) {
          this.inactivePage--;
        }
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.confirmLoading = false;
        alert(this.httpErr(err, 'Could not update status.'));
      },
    });
  }

  cancelConfirm(): void {
    if (this.confirmLoading) return;
    this.showConfirmModal = false;
    this.confirmTargetUser = null;
  }

  roleLabel(u: SystemUserDto): string {
    return u.role_display_name || u.role_name || '—';
  }

  get displayedUsers(): SystemUserDto[] {
    return this.pagedActiveUsers;
  }

  clearUserSearch(): void {
    this.userSearch = '';
    this.activePage = 1;
  }

  isSelf(u: SystemUserDto): boolean {
    return this.currentUser?.user_id === u.user_id;
  }

  private resetForm(): void {
    this.form = {
      first_name: '',
      last_name: '',
      username: '',
      email: '',
      contact_info: '',
      role: 'inventory_manager',
      password: '',
      password_confirmation: '',
      is_active: true,
    };
  }

  private handleSaveError(err: HttpErrorResponse): void {
    this.saving = false;
    const body = err.error as { message?: string; errors?: Record<string, string[]> };
    if (body?.errors) {
      this.fieldErrors = body.errors;
      this.modalError = body.message || 'Please fix the highlighted fields.';
    } else {
      this.modalError = this.httpErr(err, 'Save failed.');
    }
    this.cdr.markForCheck();
  }

  private httpErr(err: HttpErrorResponse, fallback: string): string {
    const e = err.error;
    if (typeof e === 'string' && e.trim()) return e;
    if (e && typeof e === 'object' && 'message' in e) return (e as any).message;
    return fallback;
  }

  fieldError(key: string): string | null {
    const v = this.fieldErrors[key];
    return v && v.length ? v[0] : null;
  }
}
