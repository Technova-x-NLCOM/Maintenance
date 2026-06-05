import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { finalize, timeout } from 'rxjs/operators';
import { ModalUtils } from '../../../shared/utils/modal.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  currentFormState: 'login' | 'forgotPassword' | 'success' = 'login';
  loginForm!: FormGroup;
  forgotPasswordForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  // Set password modal functionality removed - no longer needed
  forgotPasswordLoading = false;

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
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });


  }

  showForgotPasswordForm() {
    this.currentFormState = 'forgotPassword';
    this.forgotPasswordForm.reset();
  }

  backToLogin() {
    this.currentFormState = 'login';
    this.forgotPasswordForm.reset();
  }

  sendResetLink() {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    const email = (this.forgotPasswordForm.get('email')?.value || '').trim();
    if (!email) {
      this.showToast('Please enter your email address.');
      return;
    }

    this.forgotPasswordLoading = true;
    this.authService.forgotPassword(email)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.forgotPasswordLoading = false;
        })
      )
      .subscribe({
        next: () => {
          this.currentFormState = 'success';
          this.showToast('Password reset instructions have been sent if the email exists.', 'success');
        },
        error: (err) => {
          const message = err.name === 'TimeoutError'
            ? 'Request timed out. Please check your connection and try again.'
            : this.authService.getFriendlyErrorMessage(err, 'Failed to send reset link. Please try again.');
          this.showToast(message);
        },
        complete: () => {}
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
    this.authService.login(identifier, password, 'inventory_manager')
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
          this.showToast('This login is for Inventory Manager only. Use the Administrator login for admin accounts.');
        } else if (errType === 'invalid_password') {
          this.showToast('Incorrect password. Please try again.');
        } else if (errType === 'user_not_found') {
          this.showToast('No account found with that username or email.');
        } else if (error?.status === 429) {
          this.showToast(this.authService.getFriendlyErrorMessage(error, 'Too many requests. Please wait and try again.'));
        } else {
          this.showToast(this.authService.getFriendlyErrorMessage(error, 'Login failed. Please try again.'));
        }
      }
    });
  }
}
