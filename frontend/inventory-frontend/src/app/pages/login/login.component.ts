import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  userRole: 'admin' | 'staff' = 'staff';
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  demoCredentials = {
    admin: {
      email: 'admin@humanitarian.org',
      password: 'admin123'
    },
    staff: {
      email: 'staff@humanitarian.org',
      password: 'staff123'
    }
  };

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // Check if role is passed as query parameter
    this.route.queryParams.subscribe(params => {
      if (params['role'] === 'admin') {
        this.userRole = 'admin';
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

  switchRole(role: 'admin' | 'staff') {
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

    // Simulate API call
    setTimeout(() => {
      // For demo purposes, accept any valid email/password
      if (email && password) {
        // Store user info in sessionStorage
        sessionStorage.setItem('userRole', this.userRole);
        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('isLoggedIn', 'true');
        
        // Redirect to dashboard
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = 'Invalid credentials';
      }
      this.isLoading = false;
    }, 1000);
  }
}
