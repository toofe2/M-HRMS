/**
 * أنواع البيانات لنظام الموافقات المتقدم
 */

export interface ApprovalPage {
  id: string;
  page_name: string;
  display_name: string;
  description?: string;
  module_name: string;
  requires_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflow {
  id: string;
  page_id: string;
  workflow_name: string;
  workflow_type: 'sequential' | 'parallel' | 'conditional';
  conditions: Record<string, any>;
  is_default: boolean;
  is_active: boolean;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  steps?: ApprovalStep[];
}

export interface ApprovalStep {
  id: string;
  workflow_id: string;
  step_order: number;
  step_name: string;
  approver_type: 'user' | 'role' | 'department' | 'position' | 'dynamic';
  approver_id?: string;
  approver_criteria: Record<string, any>;
  required_approvals: number;
  auto_approve_after_hours?: number;
  escalation_after_hours?: number;
  escalation_to?: string;
  conditions: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  request_number: string;
  page_id: string;
  workflow_id: string;
  requester_id: string;
  request_data: Record<string, any>;
  current_step: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  
  // معلومات إضافية من الـ view
  page_name?: string;
  page_display_name?: string;
  workflow_name?: string;
  workflow_type?: string;
  requester_name?: string;
  requester_email?: string;
  current_step_name?: string;
  current_approver_type?: string;
  required_approvals?: number;
  current_approvals_count?: number;
  is_overdue?: boolean;
}

export interface ApprovalAction {
  id: string;
  request_id: string;
  step_id: string;
  approver_id: string;
  action: 'approved' | 'rejected' | 'delegated' | 'escalated';
  comments?: string;
  attachments: any[];
  action_date: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  
  // معلومات إضافية
  approver_name?: string;
  step_name?: string;
}

export interface ApprovalDelegation {
  id: string;
  delegator_id: string;
  delegate_id: string;
  page_id?: string;
  workflow_id?: string;
  start_date: string;
  end_date: string;
  reason?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // معلومات إضافية
  delegator_name?: string;
  delegate_name?: string;
  page_name?: string;
  workflow_name?: string;
}

export interface ApprovalNotification {
  id: string;
  request_id: string;
  recipient_id: string;
  notification_type: 'new_request' | 'approved' | 'rejected' | 'escalated' | 'reminder' | 'expired';
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string;
  sent_via: Record<string, any>;
  created_at: string;
}

export interface ApprovalLog {
  id: string;
  request_id?: string;
  user_id?: string;
  action: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ApprovalStatistics {
  page_name: string;
  display_name: string;
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  overdue_requests: number;
  avg_completion_hours: number;
}

// أنواع البيانات للعمليات
export interface CreateApprovalRequestData {
  page_name: string;
  request_data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string;
}

export interface ProcessApprovalActionData {
  request_id: string;
  action: 'approved' | 'rejected';
  comments?: string;
  attachments?: any[];
}

export interface CreateDelegationData {
  delegate_id: string;
  page_id?: string;
  workflow_id?: string;
  start_date?: string;
  end_date: string;
  reason?: string;
}

export interface ApprovalWorkflowConfig {
  page_id: string;
  workflow_name: string;
  workflow_type: 'sequential' | 'parallel' | 'conditional';
  conditions?: Record<string, any>;
  is_default?: boolean;
  steps: {
    step_order: number;
    step_name: string;
    approver_type: 'user' | 'role' | 'department' | 'position' | 'dynamic';
    approver_id?: string;
    approver_criteria?: Record<string, any>;
    required_approvals?: number;
    auto_approve_after_hours?: number;
    escalation_after_hours?: number;
    escalation_to?: string;
    conditions?: Record<string, any>;
  }[];
}

// أنواع البيانات للاستجابات
export interface ApprovalResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedApprovalResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}