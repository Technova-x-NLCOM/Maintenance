import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, NgForOf } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService, RegisterRequest } from '../../services/auth.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgIf],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent implements OnInit, OnDestroy {
  signupForm!: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  showSuccessModal = false;
  successMessage = '';
  errorMessage = '';

  // Multi-step form
  currentStep = 1;
  totalSteps = 3;
  stepTitles = ['Account Info', 'Personal Info', 'Security'];

  // Password validation
  passwordValidation = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    symbol: false,
  };
  showPasswordValidation = false;
  private destroy = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.signupForm = this.fb.group(
      {
        username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
        email: ['', [Validators.required, Validators.email]],
        first_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
        last_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
        contact_info: ['', [Validators.maxLength(100)]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        agreeTerms: [false, Validators.requiredTrue],
      },
      { validators: this.passwordMatchValidator },
    );

    // Setup password validation with debounce
    // Validation is handled on input events (see template handler)
  }

  ngOnDestroy() {
    this.destroy.next();
    this.destroy.complete();
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onPasswordInput(e: Event) {
    const pw = (e.target as HTMLInputElement).value || '';
    this.showPasswordValidation = pw.length > 0;
    this.validatePasswordRules(pw);
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.errorMessage = 'Please fill in all fields correctly';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const formData = this.signupForm.value;

    // Prepare payload for backend
    const registerPayload: RegisterRequest = {
      username: formData.username,
      email: formData.email,
      password: formData.password,
      password_confirmation: formData.confirmPassword,
      first_name: formData.first_name,
      last_name: formData.last_name,
      contact_info: formData.contact_info || null,
      role: 'inventory_manager', // New users default to inventory manager role
    };

    this.authService.register(registerPayload).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.showSuccessModal = true;
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 3000);
      },
      error: (error) => {
        this.isLoading = false;
        // Surface the first validation error if available, else generic message
        const errors = error.error?.errors;
        if (errors) {
          const firstKey = Object.keys(errors)[0];
          this.errorMessage =
            errors[firstKey]?.[0] || error.error?.message || 'Registration failed';
        } else {
          this.errorMessage = error.error?.message || error.error?.error || 'Registration failed';
        }
      },
    });
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  getPasswordStrength(): string {
    const password = this.signupForm.get('password')?.value;
    if (!password) return '';

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength < 2) return 'weak';
    if (strength < 3) return 'fair';
    if (strength < 4) return 'good';
    return 'strong';
  }

  private validatePasswordRules(password: string): void {
    this.passwordValidation = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };
    // Enforce password rules on the form control so the form stays invalid
    const control = this.signupForm?.get('password');
    if (control) {
      if (this.isPasswordValid()) {
        control.setErrors(null);
      } else {
        control.setErrors({ passwordRules: true });
      }
    }
  }

  isPasswordValid(): boolean {
    return Object.values(this.passwordValidation).every((v) => v);
  }

  // Step navigation methods
  nextStep(): void {
    if (this.isCurrentStepValid() && this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.errorMessage = '';
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.errorMessage = '';
    }
  }

  goToStep(step: number): void {
    // Only allow going to previous steps or current step
    if (step <= this.currentStep && step >= 1) {
      this.currentStep = step;
      this.errorMessage = '';
    }
  }

  isCurrentStepValid(): boolean {
    switch (this.currentStep) {
      case 1:
        const username = this.signupForm.get('username');
        const email = this.signupForm.get('email');
        return !!(username?.valid && email?.valid);
      case 2:
        const firstName = this.signupForm.get('first_name');
        const lastName = this.signupForm.get('last_name');
        return !!(firstName?.valid && lastName?.valid);
      case 3:
        return this.signupForm.valid;
      default:
        return false;
    }
  }

  getStepStatus(step: number): string {
    if (step < this.currentStep) return 'completed';
    if (step === this.currentStep) return 'active';
    return 'pending';
  }
}
