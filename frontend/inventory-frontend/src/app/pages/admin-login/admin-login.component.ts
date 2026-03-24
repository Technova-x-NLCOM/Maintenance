import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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

  toastVisible = false;
  toastMessage = '';
  private toastTimer: any;

  showToast(message: string) {
    this.toastMessage = message;
    this.toastVisible = true;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 3500);
  }

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.setPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
    });

    // Pre-fetch password status as user types the identifier
    this.loginForm.get('identifier')!.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(val => {
        const id = (val || '').trim();
        if (!id) { this.passwordNeedsSet = false; return of(null); }
        return this.authService.checkPasswordSet(id).pipe(catchError(() => of(null)));
      })
    ).subscribe(res => {
      this.passwordNeedsSet = res ? !res.password_set : false;
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onPasswordClick() {
    if (this.passwordNeedsSet) {
      this.showSetPasswordModal = true;
      this.setPasswordError = '';
      this.setPasswordForm.reset();
      return;
    }
    // Fallback: check immediately if valueChanges hasn't resolved yet
    const identifier = this.loginForm.get('identifier')?.value?.trim();
    if (!identifier) return;
    this.authService.checkPasswordSet(identifier).subscribe({
      next: (res) => {
        this.passwordNeedsSet = !res.password_set;
        if (!res.password_set) {
          this.showSetPasswordModal = true;
          this.setPasswordError = '';
          this.setPasswordForm.reset();
        }
      },
      error: () => {}
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
    const username = this.loginForm.get('identifier')?.value?.trim();
    this.setPasswordLoading = true;
    this.setPasswordError = '';
    this.authService.setInitialPassword(username, password, password_confirmation).subscribe({
      next: () => {
        this.setPasswordLoading = false;
        this.showSetPasswordModal = false;
        this.passwordNeedsSet = false;
      },
      error: (err) => {
        this.setPasswordLoading = false;
        this.setPasswordError = err.error?.message || 'Failed to set password.';
      }
    });
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
        if (error.error?.error_type === 'unauthorized_portal_access') {
          if (error.error?.user_role === 'inventory_manager') {
            this.showToast('This login is for Administrators only. Use the Inventory Manager login for your account.');
            return;
          }
        }
        if (error.error?.error_type === 'invalid_password') {
          this.showToast('Incorrect password. Please try again.');
        } else {
          this.showToast(error.error?.message || 'Invalid credentials or server error');
        }
      }
    });
  }
}
