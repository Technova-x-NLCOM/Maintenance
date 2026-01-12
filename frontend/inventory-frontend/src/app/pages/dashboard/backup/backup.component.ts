import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface Backup {
  name: string;
  size: number;
  size_readable: string;
  created_at: number;
  created_at_readable: string;
}

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent implements OnInit {
  backups: Backup[] = [];
  loading = false;
  error: string | null = null;
  creating = false;
  restoring = false;
  uploadingFile: File | null = null;
  
  // Modal states
  showCreateConfirm = false;
  showRestoreConfirm = false;
  showBackupSuccess = false;
  showRestoreSuccess = false;
  
  private readonly API_URL = 'http://127.0.0.1:8000/api/backup';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // No server-side list; wait for user to upload a file.
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  // Confirmation Modal Methods
  showCreateConfirmModal(): void {
    this.showCreateConfirm = true;
  }

  closeCreateConfirmModal(): void {
    this.showCreateConfirm = false;
  }

  showRestoreConfirmModal(): void {
    if (!this.uploadingFile) return;
    this.showRestoreConfirm = true;
  }

  closeRestoreConfirmModal(): void {
    this.showRestoreConfirm = false;
  }

  // Success Modal Methods
  closeBackupSuccessModal(): void {
    this.showBackupSuccess = false;
  }

  closeRestoreSuccessModal(): void {
    this.showRestoreSuccess = false;
  }

  createBackup(): void {
    if (this.creating) return;
    
    this.showCreateConfirm = false;
    this.creating = true;
    this.error = null;
    this.cdr.detectChanges();
    
    this.http.post(
      `${this.API_URL}/create`,
      {},
      {
        headers: this.getAuthHeaders(),
        responseType: 'blob',
        observe: 'response'
      }
    ).subscribe({
      next: (response) => {
        const blob = response.body;
        if (blob) {
          // Extract filename from Content-Disposition header
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'backup.sql';
          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }

          // Create download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
        
        // Use setTimeout to ensure UI updates
        setTimeout(() => {
          this.creating = false;
          this.showBackupSuccess = true;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err?.error?.message || 'Failed to create backup';
          this.creating = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  downloadBackup(backupName: string): void {
    this.http.post(
      `${this.API_URL}/download`,
      { backup_file: backupName },
      {
        headers: this.getAuthHeaders(),
        responseType: 'blob',
        observe: 'response'
      }
    ).subscribe({
      next: (response) => {
        const blob = response.body;
        if (blob) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = backupName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to download backup';
        this.cdr.detectChanges();
      }
    });
  }

  restoreBackup(backupName: string): void {
    if (this.restoring) return;

    this.restoring = true;
    this.error = null;
    this.cdr.detectChanges();

    this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/restore`,
      { backup_file: backupName },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        setTimeout(() => {
          this.restoring = false;
          this.showRestoreSuccess = true;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err?.error?.message || 'Failed to restore backup';
          this.restoring = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadingFile = input.files[0];
    }
  }

  restoreFromUploadedFile(): void {
    if (!this.uploadingFile || this.restoring) return;

    this.showRestoreConfirm = false;
    this.restoring = true;
    this.error = null;
    this.cdr.detectChanges();

    const formData = new FormData();
    formData.append('backup_file', this.uploadingFile);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    });

    this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/restore-upload`,
      formData,
      { headers }
    ).subscribe({
      next: (response) => {
        // Reset file input
        const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        // Use setTimeout to ensure UI updates
        setTimeout(() => {
          this.restoring = false;
          this.uploadingFile = null;
          this.showRestoreSuccess = true;
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          this.error = err?.error?.message || 'Failed to restore from uploaded file';
          this.restoring = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  deleteBackup(backupName: string): void {
    this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/delete`,
      { backup_file: backupName },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        // No listing to refresh.
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to delete backup';
        this.cdr.detectChanges();
      }
    });
  }
}
