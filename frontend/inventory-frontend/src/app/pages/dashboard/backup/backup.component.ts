import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { timeout, catchError, of } from 'rxjs';

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
  private readonly API_URL = 'http://127.0.0.1:8000/api/backup';

  constructor(private http: HttpClient) {}

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

  // Removed server backups listing; focusing on upload-based restore.

  createBackup(): void {
    if (this.creating) return;
    
    if (!confirm('Create a new database backup? This will download the backup file.')) {
      return;
    }

    this.creating = true;
    this.error = null;
    
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
        
        this.creating = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to create backup';
        this.creating = false;
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
      }
    });
  }

  restoreBackup(backupName: string): void {
    if (this.restoring) return;

    if (!confirm(`⚠️ WARNING: This will DROP all existing tables and restore from "${backupName}".\n\nThis action cannot be undone. Are you absolutely sure?`)) {
      return;
    }

    this.restoring = true;
    this.error = null;

    this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/restore`,
      { backup_file: backupName },
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        alert(response.message || 'Database restored successfully!');
        this.restoring = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to restore backup';
        this.restoring = false;
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

    if (!confirm(`⚠️ WARNING: This will DROP all existing tables and restore from the uploaded file "${this.uploadingFile.name}".\n\nThis action cannot be undone. Are you absolutely sure?`)) {
      return;
    }

    this.restoring = true;
    this.error = null;

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
        alert(response.message || 'Database restored successfully from uploaded file!');
        this.restoring = false;
        this.uploadingFile = null;
        // Reset file input
        const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to restore from uploaded file';
        this.restoring = false;
      }
    });
  }

  deleteBackup(backupName: string): void {
    if (!confirm(`Delete backup "${backupName}"? This action cannot be undone.`)) {
      return;
    }

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
      }
    });
  }
}
