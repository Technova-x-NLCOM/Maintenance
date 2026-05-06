import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil, timeout } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  email = '';
  token = '';
  isSubmitting = false;
  isValidLink = true;
  successMessage = '';
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;
  resetForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]]
    });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.email = params.get('email') ?? '';
      this.token = params.get('token') ?? '';
      this.isValidLink = Boolean(this.email && this.token);

      if (!this.isValidLink) {
        this.errorMessage = 'This password reset link is invalid or incomplete. Please request a new reset email.';
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit(): void {
    if (!this.isValidLink) {
      this.errorMessage = 'This password reset link is invalid or incomplete. Please request a new reset email.';
      return;
    }

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const password = this.resetForm.get('password')?.value?.trim() ?? '';
    const passwordConfirmation = this.resetForm.get('password_confirmation')?.value?.trim() ?? '';

    if (password !== passwordConfirmation) {
      this.errorMessage = 'Password confirmation does not match.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resetPassword({
      email: this.email,
      token: this.token,
      password,
      password_confirmation: passwordConfirmation
    }).pipe(
      timeout(15000),
      finalize(() => {
        this.isSubmitting = false;
      })
    ).subscribe({
      next: (response) => {
        this.successMessage = response.message || 'Your password has been reset successfully.';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1800);
      },
      error: (err) => {
        const backendMessage = this.authService.getFriendlyErrorMessage(err, 'Unable to reset password. Please try again.');
        this.errorMessage = err.name === 'TimeoutError'
          ? 'Request timed out. Please check your connection and try again.'
          : backendMessage;
      }
    });
  }
}
