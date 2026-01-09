import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  userRole: 'super_admin' | 'admin' | 'staff' = 'staff';
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  demoCredentials = {
    'super_admin': {
      email: 'superadmin@nlcom.org',
      password: 'superadmin123'
    },
    admin: {
      email: 'admin@nlcom.org',
      password: 'admin123'
    },
    staff: {
      email: 'staff@nlcom.org',
      password: 'staff123'
    }
  };

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Check if role is passed as query parameter
    this.route.queryParams.subscribe(params => {
      if (params['role'] === 'super_admin' || params['role'] === 'admin' || params['role'] === 'staff') {
        this.userRole = params['role'];
      }
    });

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  switchRole(role: 'super_admin' | 'admin' | 'staff') {
    this.userRole = role;
    this.errorMessage = '';
    this.loginForm.reset();
  }

  fillDemoCredentials() {
    const credentials = this.demoCredentials[this.userRole];
    this.loginForm.patchValue({
      email: credentials.email,
      password: credentials.password
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please fill in all fields correctly';
      return;
    }

    this.isLoading = true;
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
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
