import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaintenanceService } from '../../../services/maintenance.service';
import { ToastService } from '../../../services/toast.service';
import { TopbarActionService } from '../../../services/topbar-action.service';
import { PaginationComponent } from '../../../components/pagination/pagination.component';

interface UserRow {
  user_id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
  role?: 'super_admin' | 'inventory_manager' | string;
  is_active?: number | boolean;
  last_login_at?: string;
  updated_at?: string;
  created_at?: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: UserRow[] = [];
  searchQuery = '';
  userPage = 1;
  userPerPage = 10;
  loading = false;
  error = '';

  showModal = false;
  saving = false;
  editingUser: UserRow | null = null;
  /** Show password plain text in add/edit modal */
  passwordVisible = false;

  form = {
    fullName: '',
    username: '',
    email: '',
    role: 'inventory_manager',
    password: '',
    isActive: true
  };

  constructor(
    private maintenanceService: MaintenanceService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private topbarAction: TopbarActionService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.topbarAction.setPrintHandler(() => window.print());
  }

  ngOnDestroy(): void {
    this.topbarAction.setPrintHandler(null);
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';

    this.maintenanceService.listRows('users', { page: 1, perPage: 200 }).subscribe({
      next: (response) => {
        this.users = Array.isArray(response?.data) ? response.data : [];
        this.searchQuery = '';
        this.userPage = 1;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load users.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  openAddModal(): void {
    this.passwordVisible = false;
    this.editingUser = null;
    this.form = {
      fullName: '',
      username: '',
      email: '',
      role: 'inventory_manager',
      password: '',
      isActive: true
    };
    this.showModal = true;
  }

  openEditModal(user: UserRow): void {
    this.passwordVisible = false;
    this.editingUser = user;
    this.form = {
      fullName: this.getFullName(user),
      username: user.username || '',
      email: user.email || '',
      role: (user.role as string) || 'inventory_manager',
      password: '',
      isActive: this.isActive(user)
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingUser = null;
    this.passwordVisible = false;
  }

  saveUser(): void {
    if (this.saving) {
      return;
    }

    if (!this.form.fullName.trim() || !this.form.username.trim() || !this.form.email.trim()) {
      this.toastService.error('Full name, username, and email are required.');
      return;
    }

    if (!this.editingUser?.user_id && !this.form.password.trim()) {
      this.toastService.error('Password is required for new users.');
      return;
    }

    const { firstName, lastName } = this.splitName(this.form.fullName);

    const payload: any = {
      first_name: firstName,
      last_name: lastName,
      username: this.form.username.trim(),
      email: this.form.email.trim(),
      role: this.form.role,
      is_active: this.form.isActive ? 1 : 0
    };

    if (this.form.password.trim()) {
      payload.password = this.form.password.trim();
    }

    this.saving = true;

    if (!this.editingUser?.user_id) {
      this.maintenanceService.createRow('users', payload).subscribe({
        next: () => {
          this.saving = false;
          this.showModal = false;
          this.toastService.success('User created successfully.');
          this.loadUsers();
        },
        error: (err) => {
          this.saving = false;
          this.toastService.error(err?.error?.message || 'Failed to create user.');
        }
      });
      return;
    }

    this.maintenanceService.updateRow('users', this.editingUser.user_id, payload).subscribe({
      next: () => {
        this.saving = false;
        this.showModal = false;
        this.toastService.success('User updated successfully.');
        this.loadUsers();
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(err?.error?.message || 'Failed to update user.');
      }
    });
  }

  deactivateUser(user: UserRow): void {
    if (!user.user_id) {
      return;
    }
    if (!confirm(`Deactivate ${this.getFullName(user)}?`)) {
      return;
    }
    this.maintenanceService.updateRow('users', user.user_id, { is_active: 0 }).subscribe({
      next: () => {
        this.toastService.success('User deactivated.');
        this.loadUsers();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to deactivate user.');
      }
    });
  }

  reactivateUser(user: UserRow): void {
    if (!user.user_id) {
      return;
    }
    if (!confirm(`Reactivate ${this.getFullName(user)}?`)) {
      return;
    }
    this.maintenanceService.updateRow('users', user.user_id, { is_active: 1 }).subscribe({
      next: () => {
        this.toastService.success('User reactivated.');
        this.loadUsers();
      },
      error: (err) => {
        this.toastService.error(err?.error?.message || 'Failed to reactivate user.');
      }
    });
  }

  getFullName(user: UserRow): string {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown User';
  }

  getRoleLabel(role: string | undefined): string {
    if (String(role).toLowerCase() === 'super_admin') {
      return 'Admin';
    }
    return 'Inventory Manager';
  }

  getRoleClass(role: string | undefined): string {
    return String(role).toLowerCase() === 'super_admin' ? 'role-admin' : 'role-manager';
  }

  isActive(user: UserRow): boolean {
    return user.is_active === true || user.is_active === 1;
  }

  formatLastLogin(user: UserRow): string {
    const raw = user.last_login_at || user.updated_at || user.created_at;
    if (!raw) {
      return 'N/A';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    return date.toLocaleString();
  }

  get userTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.userPerPage));
  }

  get pagedUsers(): UserRow[] {
    const start = (this.userPage - 1) * this.userPerPage;
    return this.filteredUsers.slice(start, start + this.userPerPage);
  }

  get filteredUsers(): UserRow[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.users;
    }

    return this.users.filter((user) => {
      const fullName = this.getFullName(user).toLowerCase();
      const username = String(user.username || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const role = this.getRoleLabel(user.role).toLowerCase();
      const status = this.isActive(user) ? 'active' : 'inactive';
      return (
        fullName.includes(query)
        || username.includes(query)
        || email.includes(query)
        || role.includes(query)
        || status.includes(query)
      );
    });
  }

  onUserPageChange(page: number): void {
    this.userPage = page;
  }

  onSearchChange(): void {
    this.userPage = 1;
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const trimmed = fullName.trim();
    if (!trimmed) {
      return { firstName: '', lastName: '' };
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }
}
