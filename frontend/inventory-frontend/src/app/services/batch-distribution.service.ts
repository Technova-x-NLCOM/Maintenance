import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DistributionType = 'feeding_program' | 'relief_goods';

export interface BatchDistributionTemplateSummary {
  template_id: number;
  template_name: string;
  distribution_type: DistributionType;
  distribution_type_label: string;
  base_unit_count: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface BatchDistributionItemOption {
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  current_stock: number;
}

export interface BatchDistributionTemplateItemInput {
  item_id: number;
  quantity_per_base: number;
  notes?: string | null;
}

export interface BatchDistributionTemplatePayload {
  template_name: string;
  distribution_type: DistributionType;
  base_unit_count: number;
  notes?: string;
  items: BatchDistributionTemplateItemInput[];
}

export interface BatchDistributionTemplateDetails {
  template: {
    template_id: number;
    template_name: string;
    distribution_type: DistributionType;
    distribution_type_label: string;
    base_unit_count: number;
    notes: string | null;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  items: Array<{
    item_id: number;
    item_code: string;
    item_description: string;
    measurement_unit: string | null;
    quantity_per_base: number;
    current_stock: number;
  }>;
}

export interface BatchDistributionCalculation {
  template: {
    template_id: number;
    template_name: string;
    distribution_type: DistributionType;
    distribution_type_label: string;
    base_unit_count: number;
    notes: string | null;
  };
  target_unit_count: number;
  multiplier: number;
  items: Array<{
    item_id: number;
    item_code: string;
    item_description: string;
    measurement_unit: string | null;
    quantity_per_base: number;
    required_quantity_exact: number;
    required_quantity_for_issuance: number;
    current_stock: number;
    shortage_quantity: number;
    has_shortage: boolean;
  }>;
  summary: {
    line_count: number;
    total_required_quantity_for_issuance: number;
    insufficient_items_count: number;
    can_issue: boolean;
  };
}

export interface BatchDistributionIssueResponse {
  reference_number: string;
  template_id: number;
  template_name: string;
  distribution_type: DistributionType;
  target_unit_count: number;
  destination: string;
  total_issued_quantity: number;
  issued_lines: Array<{
    item_id: number;
    item_code: string;
    item_description: string;
    required_quantity_for_issuance: number;
    issued_quantity: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class BatchDistributionService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api/inventory/batch-distribution';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    });
  }

  listTemplates(search?: string, distributionType?: DistributionType): Observable<{ success: boolean; message: string; data: BatchDistributionTemplateSummary[] }> {
    let params = new HttpParams();

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    if (distributionType) {
      params = params.set('distribution_type', distributionType);
    }

    return this.http.get<{ success: boolean; message: string; data: BatchDistributionTemplateSummary[] }>(
      `${this.baseUrl}/templates`,
      { headers: this.getHeaders(), params }
    );
  }

  listItemOptions(search?: string): Observable<{ success: boolean; message: string; data: BatchDistributionItemOption[] }> {
    let params = new HttpParams();
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<{ success: boolean; message: string; data: BatchDistributionItemOption[] }>(
      `${this.baseUrl}/items/options`,
      { headers: this.getHeaders(), params }
    );
  }

  getTemplate(templateId: number): Observable<{ success: boolean; message: string; data: BatchDistributionTemplateDetails }> {
    return this.http.get<{ success: boolean; message: string; data: BatchDistributionTemplateDetails }>(
      `${this.baseUrl}/templates/${templateId}`,
      { headers: this.getHeaders() }
    );
  }

  createTemplate(payload: BatchDistributionTemplatePayload): Observable<{ success: boolean; message: string; data: BatchDistributionTemplateDetails }> {
    return this.http.post<{ success: boolean; message: string; data: BatchDistributionTemplateDetails }>(
      `${this.baseUrl}/templates`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  updateTemplate(templateId: number, payload: BatchDistributionTemplatePayload): Observable<{ success: boolean; message: string; data: BatchDistributionTemplateDetails }> {
    return this.http.put<{ success: boolean; message: string; data: BatchDistributionTemplateDetails }>(
      `${this.baseUrl}/templates/${templateId}`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  calculate(templateId: number, targetUnitCount: number): Observable<{ success: boolean; message: string; data: BatchDistributionCalculation }> {
    return this.http.post<{ success: boolean; message: string; data: BatchDistributionCalculation }>(
      `${this.baseUrl}/calculate`,
      {
        template_id: templateId,
        target_unit_count: targetUnitCount
      },
      { headers: this.getHeaders() }
    );
  }

  issue(templateId: number, targetUnitCount: number, destination: string, reason?: string, notes?: string): Observable<{ success: boolean; message: string; data: BatchDistributionIssueResponse }> {
    return this.http.post<{ success: boolean; message: string; data: BatchDistributionIssueResponse }>(
      `${this.baseUrl}/issue`,
      {
        template_id: templateId,
        target_unit_count: targetUnitCount,
        destination,
        reason,
        notes
      },
      { headers: this.getHeaders() }
    );
  }
}
