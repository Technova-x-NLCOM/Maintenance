import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../../shared/toast/toast.component';

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
  imports: [CommonModule, ToastComponent],
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent implements OnInit {
  /** When true, hides the page title and uses compact spacing (e.g. inside System Settings). */
  @Input() embedded = false;

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

  private readonly API_URL = '/api/backup';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef, private toast: ToastService) {}

  ngOnInit(): void {
    // No server-side list; wait for user to upload a file.
  }

  /** JSON body for POSTs that send a JSON object (not FormData). */
  private getJsonAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json'
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /** Blob download requests — errors often come back as JSON in a Blob body. */
  private getBlobAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({ Accept: 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * When responseType is 'blob', failed requests still use Blob for error bodies that are JSON.
   * Laravel/Angular otherwise hide the real message.
   */
  private async extractApiError(err: HttpErrorResponse | unknown, fallback: string): Promise<string> {
    const httpErr = err as HttpErrorResponse;
    const body = httpErr.error;

    if (body instanceof Blob) {
      try {
        const text = await body.text();
        if (!text?.trim()) {
          return httpErr.status ? `${fallback} (HTTP ${httpErr.status})` : fallback;
        }
        try {
          const j = JSON.parse(text) as { message?: string; errors?: Record<string, string[]> };
          if (j.message) {
            return j.message;
          }
          if (j.errors) {
            const first = Object.values(j.errors)[0]?.[0];
            if (first) {
              return first;
            }
          }
        } catch {
          return text.trim();
        }
      } catch {
        return fallback;
      }
    }

    if (body && typeof body === 'object') {
      const o = body as { message?: string; errors?: Record<string, string[]> };
      if (o.message) {
        return o.message;
      }
      if (o.errors) {
        const first = Object.values(o.errors)[0]?.[0];
        if (first) {
          return first;
        }
      }
    }

    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }

    return httpErr.message || (httpErr.status ? `${fallback} (HTTP ${httpErr.status})` : fallback);
  }

  private setErrorFromHttp(err: HttpErrorResponse | unknown, fallback: string): void {
    void this.extractApiError(err, fallback).then((msg) => {
      this.toast.error(msg);
      this.cdr.detectChanges();
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

    this.http
      .post(`${this.API_URL}/create`, {}, {
        headers: this.getBlobAuthHeaders(),
        responseType: 'blob',
        observe: 'response'
      })
      .subscribe({
        next: (response) => {
          const blob = response.body;
          const contentType = response.headers.get('Content-Type') || '';

          // Error responses may still be 200 with wrong type in edge cases; prefer status check
          if (!blob || blob.size === 0) {
            this.creating = false;
            this.toast.error('Empty response from server.');
            this.cdr.detectChanges();
            return;
          }

          if (contentType.includes('application/json')) {
            void blob.text().then((text) => {
              try {
                const j = JSON.parse(text) as { message?: string };
                this.toast.error(j.message || 'Backup failed.');
              } catch {
                this.toast.error(text || 'Backup failed.');
              }
              this.creating = false;
              this.cdr.detectChanges();
            });
            return;
          }

          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'backup.sql';
          if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          }

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          setTimeout(() => {
            this.creating = false;
            this.showBackupSuccess = true;
            this.toast.success('Backup created and downloaded successfully.');
            this.cdr.detectChanges();
          }, 0);
        },
        error: (err: HttpErrorResponse) => {
          setTimeout(() => {
            this.creating = false;
            this.setErrorFromHttp(err, 'Failed to create backup');
          }, 0);
        }
      });
  }

  downloadBackup(backupName: string): void {
    this.http
      .post(
        `${this.API_URL}/download`,
        { backup_file: backupName },
        {
          headers: this.getBlobAuthHeaders(),
          responseType: 'blob',
          observe: 'response'
        }
      )
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (blob && response.headers.get('Content-Type')?.includes('application/json')) {
            void blob.text().then((t) => {
              try {
                const j = JSON.parse(t) as { message?: string };
                this.error = j.message || 'Download failed.';
              } catch {
                this.error = t || 'Download failed.';
              }
              this.cdr.detectChanges();
            });
            return;
          }
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
        error: (err: HttpErrorResponse) => {
          this.setErrorFromHttp(err, 'Failed to download backup');
        }
      });
  }

  restoreBackup(backupName: string): void {
    if (this.restoring) return;

    this.restoring = true;
    this.error = null;
    this.cdr.detectChanges();

    this.http
      .post<{ success: boolean; message: string }>(
        `${this.API_URL}/restore`,
        { backup_file: backupName },
        { headers: this.getJsonAuthHeaders() }
      )
      .subscribe({
        next: () => {
          setTimeout(() => {
            this.restoring = false;
            this.showRestoreSuccess = true;
            this.cdr.detectChanges();
          }, 0);
        },
        error: (err: HttpErrorResponse) => {
          setTimeout(() => {
            this.restoring = false;
            this.setErrorFromHttp(err, 'Failed to restore backup');
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

    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders({ Accept: 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    this.http
      .post<{ success: boolean; message: string }>(`${this.API_URL}/restore-upload`, formData, { headers })
      .subscribe({
        next: () => {
          const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
          if (fileInput) fileInput.value = '';

          setTimeout(() => {
            this.restoring = false;
            this.uploadingFile = null;
            this.showRestoreSuccess = true;
            this.toast.success('Database restored successfully from backup file.');
            this.cdr.detectChanges();
          }, 0);
        },
        error: (err: HttpErrorResponse) => {
          setTimeout(() => {
            this.restoring = false;
            this.setErrorFromHttp(err, 'Failed to restore from uploaded file');
          }, 0);
        }
      });
  }

  deleteBackup(backupName: string): void {
    this.http
      .post<{ success: boolean; message: string }>(
        `${this.API_URL}/delete`,
        { backup_file: backupName },
        { headers: this.getJsonAuthHeaders() }
      )
      .subscribe({
        next: () => {
          // No listing to refresh.
        },
        error: (err: HttpErrorResponse) => {
          this.setErrorFromHttp(err, 'Failed to delete backup');
        }
      });
  }
}
