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

export type ProgramPlanStatus = 'planned' | 'checked_pre' | 'ready' | 'completed' | 'cancelled';

export interface ProgramPlanSummary {
  plan_id: number;
  week_label: string;
  planned_date: string;
  target_unit_count: number;
  status: ProgramPlanStatus;
  precheck_at: string | null;
  final_check_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  template_id: number;
  template_name: string;
  distribution_type: DistributionType;
  base_unit_count: number;
}

export interface ProgramPlanCheckItem {
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
}

export interface ProgramPlanCheckResult {
  items: ProgramPlanCheckItem[];
  summary: {
    line_count: number;
    insufficient_items_count: number;
    can_proceed: boolean;
    error?: string;
  };
}

export interface ProgramPlanRemainingItem {
  remaining_id: number;
  item_id: number;
  item_code: string;
  item_description: string;
  measurement_unit: string | null;
  remaining_quantity: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgramPlanDetailsResponse {
  plan: ProgramPlanSummary;
  inventory_check: ProgramPlanCheckResult;
  remaining_items: ProgramPlanRemainingItem[];
  issuance?: {
    reference_number: string;
    plan_id: number;
    week_label: string;
    template_id: number;
    template_name: string;
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
  };
}

export interface ProgramPlanCreatePayload {
  template_id: number;
  week_label: string;
  planned_date: string;
  target_unit_count: number;
  notes?: string;
}

export interface ProgramPlanUpdatePayload {
  issue_destination: string;
  issue_reason?: string;
  issue_notes?: string;
}

export interface ProgramPlanFinalCheckPayload {
  procured_items?: Array<{
    item_id: number;
    quantity_brought: number;
    notes?: string;
  }>;
  issue_destination: string;
  issue_reason?: string;
  issue_notes?: string;
}

export interface ProgramPlanCompletePayload {
  remaining_items?: Array<{
    item_id: number;
    remaining_quantity: number;
    notes?: string;
  }>;
  status?: 'completed' | 'cancelled';
  issue_now?: boolean;
  issue_destination?: string;
  issue_reason?: string;
  issue_notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BatchDistributionService {
  private readonly baseUrl = '/api/inventory/batch-distribution';

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

  listProgramPlans(params?: {
    status?: ProgramPlanStatus;
    from_date?: string;
    to_date?: string;
  }): Observable<{ success: boolean; message: string; data: ProgramPlanSummary[] }> {
    let httpParams = new HttpParams();

    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.from_date) {
      httpParams = httpParams.set('from_date', params.from_date);
    }
    if (params?.to_date) {
      httpParams = httpParams.set('to_date', params.to_date);
    }

    return this.http.get<{ success: boolean; message: string; data: ProgramPlanSummary[] }>(
      `${this.baseUrl}/program-plans`,
      { headers: this.getHeaders(), params: httpParams }
    );
  }

  createProgramPlan(payload: ProgramPlanCreatePayload): Observable<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }> {
    return this.http.post<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }>(
      `${this.baseUrl}/program-plans`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  getProgramPlan(planId: number): Observable<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }> {
    return this.http.get<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }>(
      `${this.baseUrl}/program-plans/${planId}`,
      { headers: this.getHeaders() }
    );
  }

  runProgramPrecheck(planId: number): Observable<{ success: boolean; message: string; data: any }> {
    return this.http.post<{ success: boolean; message: string; data: any }>(
      `${this.baseUrl}/program-plans/${planId}/precheck`,
      {},
      { headers: this.getHeaders() }
    );
  }

  runProgramFinalCheck(planId: number, payload?: ProgramPlanFinalCheckPayload): Observable<{ success: boolean; message: string; data: any }> {
    return this.http.post<{ success: boolean; message: string; data: any }>(
      `${this.baseUrl}/program-plans/${planId}/final-check`,
      payload ?? {},
      { headers: this.getHeaders() }
    );
  }

  updateProgramPlan(planId: number, payload: ProgramPlanUpdatePayload): Observable<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }> {
    return this.http.post<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }>(
      `${this.baseUrl}/program-plans/${planId}/issue-only`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  completeProgramPlan(planId: number, payload: ProgramPlanCompletePayload): Observable<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }> {
    return this.http.post<{ success: boolean; message: string; data: ProgramPlanDetailsResponse }>(
      `${this.baseUrl}/program-plans/${planId}/complete`,
      payload,
      { headers: this.getHeaders() }
    );
  }
}
