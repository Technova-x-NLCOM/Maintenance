import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { finalize, timeout } from 'rxjs/operators';
import { ModalUtils } from '../../shared/utils/modal.utils';

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

  // Set password modal functionality removed - no longer needed

  toastVisible = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'error';
  private toastTimer: any;

  // Deactivated account modal
  showInactiveAccountModal = false;

  // Forgot password modal
  showForgotPasswordModal = false;
  forgotPasswordForm!: FormGroup;
  forgotPasswordLoading = false;
  forgotPasswordMessage = '';
  forgotPasswordError = '';

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

    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Set password modal functionality removed

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

  openForgotPasswordModal() {
    this.forgotPasswordMessage = '';
    this.forgotPasswordError = '';
    this.forgotPasswordForm.reset();
    this.showForgotPasswordModal = true;
    this.cdr.detectChanges();
    // autofocus the email input for accessibility
    setTimeout(() => {
      const el = document.getElementById('fp-email') as HTMLInputElement | null;
      if (el) { el.focus(); }
    }, 50);
  }

  closeForgotPasswordModal() {
    this.showForgotPasswordModal = false;
  }

  submitForgotPassword() {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordError = 'Please enter your email address.';
      return;
    }

    const email = (this.forgotPasswordForm.get('email')?.value || '').trim();
    if (!email) {
      this.forgotPasswordError = 'Please enter your email address.';
      return;
    }

    this.forgotPasswordLoading = true;
    this.forgotPasswordError = '';
    this.authService.forgotPassword(email)
      .pipe(
        timeout(15000),
        finalize(() => (this.forgotPasswordLoading = false))
      )
      .subscribe({
        next: (res) => {
          this.forgotPasswordMessage = res.message || 'If that email exists, a reset link has been sent.';
          this.showToast(this.forgotPasswordMessage, 'success');
          this.showForgotPasswordModal = false;
        },
        error: (err) => {
          this.forgotPasswordError = err?.error?.message || 'Failed to send reset email. Please try again.';
        }
      });
  }
}
