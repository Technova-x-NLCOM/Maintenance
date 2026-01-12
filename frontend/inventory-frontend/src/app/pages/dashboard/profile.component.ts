import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';
import { Router } from '@angular/router';

interface EditProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  contact_info: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  
  // Edit Profile Modal
  showEditModal = false;
  editForm: EditProfileForm = {
    first_name: '',
    last_name: '',
    email: '',
    contact_info: ''
  };
  editError = '';
  
  // Change Password Modal
  showPasswordModal = false;
  passwordForm: PasswordForm = {
    current_password: '',
    new_password: '',
    confirm_password: ''
  };
  passwordError = '';
  
  // Password visibility toggles
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  // Success modals
  showEditSuccessModal = false;
  showPasswordSuccessModal = false;
  
  saving = false;

  private readonly API_URL = 'http://127.0.0.1:8000/api';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  // Edit Profile Methods
  openEditModal() {
    if (this.user) {
      this.editForm = {
        first_name: this.user.first_name,
        last_name: this.user.last_name,
        email: this.user.email,
        contact_info: this.user.contact_info || ''
      };
    }
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editError = '';
  }

  saveProfile() {
    this.saving = true;
    this.editError = '';

    this.http.put<{ message: string; user: User }>(
      `${this.API_URL}/profile/update`,
      this.editForm,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        // Update local user data immediately
        if (response.user) {
          this.user = response.user;
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        // Refresh auth service in background (non-blocking)
        this.authService.me().subscribe();
        
        // Use setTimeout to ensure UI updates
        setTimeout(() => {
          this.saving = false;
          this.showEditModal = false;
          this.showEditSuccessModal = true;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        setTimeout(() => {
          this.editError = error.error?.message || 'Failed to update profile. Please try again.';
          this.saving = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  // Change Password Methods
  openPasswordModal() {
    this.passwordForm = {
      current_password: '',
      new_password: '',
      confirm_password: ''
    };
    this.passwordError = '';
    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.showPasswordModal = true;
  }

  closePasswordModal() {
    this.showPasswordModal = false;
    this.passwordError = '';
  }

  changePassword() {
    this.passwordError = '';

    // Validate passwords match
    if (this.passwordForm.new_password !== this.passwordForm.confirm_password) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    // Validate password length
    if (this.passwordForm.new_password.length < 8) {
      this.passwordError = 'New password must be at least 8 characters.';
      return;
    }

    this.saving = true;

    this.http.put<{ message: string }>(
      `${this.API_URL}/profile/password`,
      {
        current_password: this.passwordForm.current_password,
        new_password: this.passwordForm.new_password,
        new_password_confirmation: this.passwordForm.confirm_password
      },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: () => {
        // Use setTimeout to ensure UI updates
        setTimeout(() => {
          this.saving = false;
          this.showPasswordModal = false;
          this.showPasswordSuccessModal = true;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        setTimeout(() => {
          this.passwordError = error.error?.message || 'Failed to change password. Please check your current password.';
          this.saving = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  closeEditSuccessModal() {
    this.showEditSuccessModal = false;
  }

  closePasswordSuccessModal() {
    this.showPasswordSuccessModal = false;
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.router.navigate(['/login']);
      }
    });
  }
}
