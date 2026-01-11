import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface DemoAccount {
  role: string;
  icon: string;
  identifier: string;
  password: string;
  description: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  demoAccounts: DemoAccount[] = [
    {
      role: 'Super Administrator',
      icon: '👑',
      identifier: 'superadmin@nlcom.org',
      password: 'superadmin123',
      description: 'Full system access with all permissions'
    },
    {
      role: 'Administrator',
      icon: '🔐',
      identifier: 'admin@nlcom.org',
      password: 'admin123',
      description: 'Administrative access to manage users and inventory'
    },
    {
      role: 'Staff Member',
      icon: '👤',
      identifier: 'staff@nlcom.org',
      password: 'staff123',
      description: 'Standard staff access for inventory operations'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  fillDemoCredentials(account: DemoAccount) {
    this.loginForm.patchValue({
      identifier: account.identifier,
      password: account.password
    });
    this.errorMessage = '';
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please fill in all fields correctly';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const { identifier, password } = this.loginForm.value;

    this.authService.login(identifier, password).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Invalid credentials or server error';
      }
    });
  }
}
