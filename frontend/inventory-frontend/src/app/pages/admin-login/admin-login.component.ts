import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { finalize, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss'
})
export class AdminLoginComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  // Set password modal
  showSetPasswordModal = false;
  setPasswordForm!: FormGroup;
  setPasswordError = '';
  setPasswordLoading = false;
  showSetPwd = false;
  showSetPwdConfirm = false;
  passwordNeedsSet = false;
  checkingFirstTimeUser = false;

  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'error';
  private toastTimer: any;

  // Deactivated account modal
  showInactiveAccountModal = false;

  showToast(message: string, type: 'success' | 'error' = 'error') {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = false;
    this.cdr.markForCheck();
    clearTimeout(this.toastTimer);
    // Force reflow so removing/re-adding the class restarts the animation
    this.toastTimer = setTimeout(() => {
      this.toastVisible = true;
      this.cdr.markForCheck();
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastVisible = false;
        this.cdr.markForCheck();
      }, 3500);
    }, 20);
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
    this.setPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  checkFirstTimeUser() {
    if (this.showSetPasswordModal || this.checkingFirstTimeUser) {
      return;
    }

    const identifier = this.loginForm.get('identifier')?.value?.trim();
    if (!identifier) return;

    this.checkingFirstTimeUser = true;
    this.authService.checkPasswordSet(identifier)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.checkingFirstTimeUser = false;
        })
      )
      .subscribe({
        next: (res) => {
          this.passwordNeedsSet = !res.password_set;
          // Only trigger from password field interaction, never from identifier input activity.
          if (!res.password_set && document.activeElement?.id === 'password') {
            this.showSetPasswordModal = true;
            this.setPasswordError = '';
            this.setPasswordForm.reset();
            this.cdr.detectChanges();
          }
        },
        error: () => {
          this.passwordNeedsSet = false;
        },
        complete: () => {}
      });
  }

  bounceModal() {
    const el = document.querySelector<HTMLElement>('.modal-panel');
    if (!el) return;
    el.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.05)' },
      { transform: 'scale(0.97)' },
      { transform: 'scale(1.02)' },
      { transform: 'scale(1)' },
    ], { duration: 400, easing: 'ease' });
  }

  submitSetPassword() {
    if (this.setPasswordForm.invalid) return;
    const { password, password_confirmation } = this.setPasswordForm.value;
    if (password !== password_confirmation) {
      this.setPasswordError = 'Passwords do not match.';
      return;
    }
    const identifier = this.loginForm.get('identifier')?.value?.trim();
    if (!identifier) {
      this.setPasswordError = 'Please enter your username or email first.';
      return;
    }

    this.setPasswordLoading = true;
    this.setPasswordError = '';
    this.authService.setInitialPassword(identifier, password, password_confirmation)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.setPasswordLoading = false;
        })
      )
      .subscribe({
        next: () => {
          this.showSetPasswordModal = false;
          this.passwordNeedsSet = false;
          this.setPasswordForm.reset();
          this.showToast('Password set successfully. Please log in with your new password.', 'success');
        },
        error: (err) => {
          this.setPasswordError = err.name === 'TimeoutError'
            ? 'Request timed out. Please check your connection and try again.'
            : (err.error?.message || 'Failed to set password. Please try again.');
        },
        complete: () => {}
      });
  }

  onSubmit() {
    const identifier = (this.loginForm.get('identifier')?.value || '').trim();
    const password = this.loginForm.get('password')?.value || '';

    if (!identifier) { this.showToast('Please enter your username or email.'); return; }
    if (!password) { this.showToast('Please enter your password.'); return; }

    this.isLoading = true;
    this.authService.login(identifier, password, 'super_admin')
      .pipe(
        timeout(15000),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        if (error?.name === 'TimeoutError') {
          this.showToast('Login request timed out. Please ensure the backend server is running and try again.');
          return;
        }

        const errType = error.error?.error_type;
        if (errType === 'account_inactive') {
          this.showInactiveAccountModal = true;
          this.cdr.markForCheck();
        } else if (errType === 'unauthorized_portal_access') {
          this.showToast('This login is for Administrators only. Use the Inventory Manager login for your account.');
        } else if (errType === 'invalid_password') {
          this.showToast('Incorrect password. Please try again.');
        } else if (errType === 'user_not_found') {
          this.showToast('No account found with that username or email.');
        } else {
          this.showToast(error.error?.message || 'Login failed. Please try again.');
        }
      }
    });
  }
}
