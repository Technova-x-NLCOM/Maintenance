import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss'
})
export class AdminLoginComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  showSetPasswordModal = false;
  pendingIdentifier: string | null = null;
  setPasswordErrorMessage = '';
  isSettingPassword = false;

  showNewPassword = false;
  showConfirmPassword = false;
  setPasswordForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['']
    });

    this.setPasswordForm = this.fb.group({
      new_password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(
            '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$'
          ),
        ],
      ],
      confirm_password: ['', [Validators.required]],
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please fill in all fields correctly';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const { identifier, password } = this.loginForm.value;

    this.authService.login(identifier, password, 'super_admin').subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        if (error.error?.error_type === 'password_not_set') {
          this.pendingIdentifier = identifier;
          this.openSetPasswordModal();
          return;
        }
        if (error.error?.error_type === 'unauthorized_portal_access') {
          const userRole = error.error?.user_role;
          if (userRole === 'inventory_manager') {
            this.errorMessage = 'This login is for Administrators only. Use the Inventory Manager login for your account.';
            return;
          }
        }
        this.errorMessage = error.error?.message || 'Invalid credentials or server error';
      }
    });
  }

  onPasswordInputClick(): void {
    if (this.showSetPasswordModal || this.isSettingPassword) return;
    const identifier = (this.loginForm.get('identifier')?.value || '').toString().trim();
    if (!identifier) {
      this.errorMessage = 'Enter your username or email first.';
      return;
    }

    this.errorMessage = '';
    this.pendingIdentifier = identifier;
    this.openSetPasswordModal();
  }

  private openSetPasswordModal(): void {
    this.setPasswordErrorMessage = '';
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.setPasswordForm.reset();
    this.showSetPasswordModal = true;
  }

  closeSetPasswordModal(): void {
    if (this.isSettingPassword) return;
    this.showSetPasswordModal = false;
    this.pendingIdentifier = null;
    this.setPasswordErrorMessage = '';
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSetPasswordSubmit(): void {
    if (!this.pendingIdentifier) return;
    if (this.setPasswordForm.invalid) {
      this.setPasswordErrorMessage = 'Please fill in all password fields correctly.';
      return;
    }

    const newPassword = this.setPasswordForm.value.new_password;
    const confirmPassword = this.setPasswordForm.value.confirm_password;
    if (newPassword !== confirmPassword) {
      this.setPasswordErrorMessage = 'Password confirmation does not match.';
      return;
    }

    this.isSettingPassword = true;
    this.setPasswordErrorMessage = '';

    this.authService
      .setPassword(this.pendingIdentifier, newPassword, confirmPassword, 'super_admin')
      .subscribe({
        next: () => {
          this.isSettingPassword = false;
          this.showSetPasswordModal = false;
          this.loginForm.patchValue({ password: newPassword });
        },
        error: (error) => {
          this.isSettingPassword = false;
          const backend = error?.error as any;
          const fieldErrors = backend?.errors;
          const firstPasswordError = fieldErrors?.password?.[0] || fieldErrors?.password_confirmation?.[0];
          this.setPasswordErrorMessage =
            firstPasswordError ||
            backend?.message ||
            'Could not set password. Please try again.';
        },
      });
  }
}
