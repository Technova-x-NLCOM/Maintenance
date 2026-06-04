import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { getApiBaseUrl } from './api-base';

export type ExportReportType = 'stock_report' | 'transaction_history' | 'discrepancy_monitoring' | 'schedule_monitoring';
export type ExportFormat = 'excel' | 'pdf';

@Injectable({ providedIn: 'root' })
export class AuditExportService {
  private readonly url = `${getApiBaseUrl()}/audit/export`;

  constructor(private http: HttpClient) {}

  /**
   * Fire-and-forget: records the export action in the audit log.
   * Errors are swallowed so they never block the actual download.
   */
  log(reportType: ExportReportType, format: ExportFormat, rowCount: number): void {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    });

    this.http
      .post(this.url, { report_type: reportType, format, row_count: rowCount }, { headers })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }
}
