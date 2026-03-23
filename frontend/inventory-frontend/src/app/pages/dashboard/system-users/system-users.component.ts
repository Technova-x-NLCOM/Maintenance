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
  roles: Role[] = [];
  loading = true;
  error: string | null = null;
  currentUser: User | null = null;
  currentRole: Role | null = null;

  showModal = false;
  editingUser: SystemUserDto | null = null;
  saving = false;
  modalError: string | null = null;
  fieldErrors: Record<string, string[]> = {};
  /** Password field visibility in Add/Edit modal */
  showPassword = false;
  showPasswordConfirm = false;

  /** Form aligned with backend (first_name / last_name, not full name) */
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

  private readonly avatarPalette = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2'];

  constructor(
    private api: UserManagementService,
    private rbac: RbacService,
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
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
    this.rbac.getCurrentRole().pipe(catchError(() => of(null))).subscribe((role) => {
      this.currentRole = role;
      if (!this.hasManageRoles()) {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.load();
    });
  }

  /** Matches backend: `permission:manage_roles` (super_admin bypasses in middleware). */
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
          ['super_admin', 'inventory_manager'].includes(r.role_name)
        );
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403 || err.status === 401) {
          this.router.navigate(['/dashboard']);
        }
        this.error = this.httpErr(err, 'Could not load users.');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

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

  private resetPasswordVisibility(): void {
    this.showPassword = false;
    this.showPasswordConfirm = false;
  }

  togglePasswordField(field: 'password' | 'confirm', event?: Event): void {
    event?.stopPropagation();
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showPasswordConfirm = !this.showPasswordConfirm;
    }
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

    if (!this.editingUser) {
      if (!this.form.password || this.form.password.length < 8) {
        this.modalError = 'Password must be at least 8 characters and meet complexity rules.';
        return;
      }
      if (this.form.password !== this.form.password_confirmation) {
        this.modalError = 'Password confirmation does not match.';
        return;
      }
    } else {
      if (this.form.password) {
        if (this.form.password.length < 8) {
          this.modalError = 'Password must be at least 8 characters.';
          return;
        }
        if (this.form.password !== this.form.password_confirmation) {
          this.modalError = 'Password confirmation does not match.';
          return;
        }
      }
    }

    this.saving = true;
    const contact = this.form.contact_info?.trim() || null;

    if (!this.editingUser) {
      this.api
        .create({
          username: this.form.username,
          email: this.form.email,
          password: this.form.password,
          password_confirmation: this.form.password_confirmation,
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
    if (this.currentUser?.user_id === u.user_id) {
      return;
    }
    this.api.update(u.user_id, { is_active: !u.is_active }).subscribe({
      next: () => this.load(),
      error: (err: HttpErrorResponse) => {
        alert(this.httpErr(err, 'Could not update status.'));
      },
    });
  }

  initials(u: SystemUserDto): string {
    const a = (u.first_name || '?').charAt(0).toUpperCase();
    const b = (u.last_name || '?').charAt(0).toUpperCase();
    return a + b;
  }

  avatarColor(u: SystemUserDto): string {
    const idx = Math.abs(u.user_id) % this.avatarPalette.length;
    return this.avatarPalette[idx];
  }

  roleLabel(u: SystemUserDto): string {
    return u.role_display_name || u.role_name || '—';
  }

  formatLastLogin(iso: string | null): string {
    if (iso == null || iso === '') return '—';
    const normalized =
      typeof iso === 'string' && iso.includes(' ') && !iso.includes('T')
        ? iso.replace(' ', 'T')
        : iso;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return '—';
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return (
        'Today, ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
      return (e as any).message;
    }
    return fallback;
  }

  fieldError(key: string): string | null {
    const v = this.fieldErrors[key];
    return v && v.length ? v[0] : null;
  }
}
