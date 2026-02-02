/**
 * Advanced Approval System Service
 * Contains all required operations for managing approvals
 */
import { supabase } from '../lib/supabase';
import {
  ApprovalPage,
  ApprovalWorkflow,
  ApprovalRequest,
  ApprovalAction,
  ApprovalDelegation,
  ApprovalNotification,
  ApprovalStatistics,
  CreateApprovalRequestData,
  ProcessApprovalActionData,
  CreateDelegationData,
  ApprovalWorkflowConfig,
  ApprovalResponse,
  PaginatedApprovalResponse,
} from '../types/approval';

export class ApprovalService {
  /**
   * Create or Update a workflow using the existing auto-versioning RPC (YOUR SIGNATURE)
   * Existing signature (per PostgREST hint):
   * update_workflow_auto_version(p_is_default, p_steps, p_workflow_id, p_workflow_name, p_workflow_type)
   *
   * NOTE:
   * - This RPC does NOT accept p_page_id or p_conditions in your DB.
   * - For NEW workflows, the UI should first call ensure_current_workflow_for_page(p_page_id)
   *   to get a valid workflow_id, then call this method.
   */
  static async saveWorkflow(
    config: ApprovalWorkflowConfig & { id?: string }
  ): Promise<ApprovalResponse<string>> {
    try {
      const { data, error } = await supabase.rpc('update_workflow_auto_version', {
        p_workflow_id: config.id ?? null,
        p_workflow_name: config.workflow_name,
        p_workflow_type: config.workflow_type,
        p_is_default: config.is_default ?? false,
        p_steps: (config.steps || []).map((step: any) => ({
          step_order: step.step_order,
          step_name: step.step_name,
          approver_type: step.approver_type,
          approver_id: step.approver_id ?? null,
          approver_criteria: step.approver_criteria ?? {},
          required_approvals: step.required_approvals ?? 1,
          auto_approve_after_hours: step.auto_approve_after_hours ?? null,
          escalation_after_hours: step.escalation_after_hours ?? null,
          escalation_to: step.escalation_to ?? null,
          conditions: step.conditions ?? {},
        })),
      });

      if (error) throw error;

      return {
        success: true,
        data: data as string, // returns workflow ID
        message: config.id ? 'Workflow updated successfully' : 'Workflow created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to save workflow',
        data: null,
      };
    }
  }

  /**
   * Create a new approval request
   */
  static async createRequest(data: CreateApprovalRequestData): Promise<ApprovalResponse<string>> {
    try {
      const { data: result, error } = await supabase.rpc('create_approval_request', {
        p_page_name: data.page_name,
        p_request_data: data.request_data,
        p_priority: data.priority || 'normal',
        p_due_date: data.due_date || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: result as string,
        message: 'Approval request created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create approval request',
        data: null,
      };
    }
  }

  /**
   * Process an approval action (approve / reject / return)
   */
  static async processAction(
    data: ProcessApprovalActionData
  ): Promise<ApprovalResponse<boolean>> {
    try {
      const { data: result, error } = await supabase.rpc('process_approval_action', {
        p_request_id: data.request_id,
        p_action: data.action,
        p_comments: data.comments || null,
        p_attachments: data.attachments || [],
      });

      if (error) throw error;

      return {
        success: true,
        data: Boolean(result),
        message: `Request successfully ${
          data.action === 'approved'
            ? 'approved'
            : data.action === 'rejected'
            ? 'rejected'
            : 'processed'
        }`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to process approval action',
        data: null,
      };
    }
  }

  /**
   * Get a specific workflow with its steps
   * IMPORTANT FIXES:
   * - Do not force is_active=true on workflows here because older versions might be requested.
   * - Steps table in your schema is approval_workflow_steps (not approval_steps).
   */
  static async getWorkflow(
    workflowId: string
  ): Promise<ApprovalResponse<ApprovalWorkflow & { steps: any[] }>> {
    try {
      const resolvedId = workflowId;

      const { data: workflow, error: wfError } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('id', resolvedId)
        .single();

      if (wfError) throw wfError;
      if (!workflow) throw new Error('Workflow not found');

      const { data: steps, error: stepsError } = await supabase
        .from('approval_workflow_steps')
        .select('*')
        .eq('workflow_id', resolvedId)
        .order('step_order', { ascending: true });

      if (stepsError) throw stepsError;

      return {
        success: true,
        data: {
          ...(workflow as any),
          steps: steps || [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch workflow',
        data: null,
      };
    }
  }

  /**
   * Get approval requests with filtering and pagination
   */
  static async getRequests(
    filters: {
      status?: string;
      page_name?: string;
      requester_id?: string;
      priority?: string;
      is_overdue?: boolean;
    } = {},
    pagination: { page: number; limit: number } = { page: 1, limit: 20 }
  ): Promise<PaginatedApprovalResponse<ApprovalRequest>> {
    try {
      let query = supabase.from('approval_requests_view').select('*', { count: 'exact' });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.page_name) query = query.eq('page_name', filters.page_name);
      if (filters.requester_id) query = query.eq('requester_id', filters.requester_id);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.is_overdue !== undefined) query = query.eq('is_overdue', filters.is_overdue);

      const from = (pagination.page - 1) * pagination.limit;
      const to = from + pagination.limit - 1;

      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: (data || []) as ApprovalRequest[],
        total: count || 0,
        page: pagination.page,
        limit: pagination.limit,
        total_pages: Math.ceil((count || 0) / pagination.limit),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch approval requests',
        data: [],
        total: 0,
        page: pagination.page,
        limit: pagination.limit,
        total_pages: 0,
      };
    }
  }

  /**
   * ✅ Get pending approval requests assigned to the current user
   *
   * IMPORTANT (based on your DB):
   * - "pending" state is stored in approval_actions.action = 'pending'
   * - There is NO approval_actions.status column
   * - Inbox must filter by approval_actions.approver_id = auth.uid()
   *
   * Strategy:
   * 1) Get my pending action request_ids
   * 2) Fetch requests from approval_requests_view by those ids
   */
  static async getPendingRequestsForUser(): Promise<ApprovalResponse<ApprovalRequest[]>> {
    try {
      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const authUser = authRes.user;
      if (!authUser?.id) throw new Error('Not authenticated');

      // 1) pending actions assigned to me
      const actionsRes = await supabase
        .from('approval_actions')
        .select('request_id')
        .eq('approver_id', authUser.id)
        .eq('action', 'pending')
        .order('created_at', { ascending: false })
        .limit(500);

      if (actionsRes.error) throw actionsRes.error;

      const requestIds = Array.from(
        new Set((actionsRes.data || []).map((x: any) => x.request_id).filter(Boolean))
      );

      if (requestIds.length === 0) {
        return { success: true, data: [] as any };
      }

      // 2) fetch the actual requests (view)
      const reqRes = await supabase
        .from('approval_requests_view')
        .select('*')
        .in('id', requestIds)
        .order('created_at', { ascending: false });

      if (reqRes.error) throw reqRes.error;

      return {
        success: true,
        data: (reqRes.data || []) as ApprovalRequest[],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch pending requests',
        data: null,
      };
    }
  }

  /**
   * Get detailed information about a specific approval request
   */
  static async getRequestDetails(
    requestId: string
  ): Promise<ApprovalResponse<ApprovalRequest & { actions: ApprovalAction[] }>> {
    try {
      const { data: requestData, error: requestError } = await supabase
        .from('approval_requests_view')
        .select('*')
        .eq('id', requestId)
        .single();

      if (requestError) throw requestError;
      if (!requestData) throw new Error('Request not found');

      const { data: actionsData, error: actionsError } = await supabase
        .from('approval_actions')
        .select(`
          *,
          approver:profiles!approval_actions_approver_id_fkey(first_name, last_name, email),
          step:approval_workflow_steps!approval_actions_step_id_fkey(step_name, step_order)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (actionsError) throw actionsError;

      const actions =
        actionsData?.map((action: any) => ({
          ...action,
          approver_name: action.approver
            ? `${action.approver.first_name} ${action.approver.last_name}`
            : 'Unknown',
          step_name: action.step?.step_name || 'Unknown',
        })) || [];

      return {
        success: true,
        data: {
          ...(requestData as any),
          actions,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch request details',
        data: null,
      };
    }
  }

  /**
   * Check if current user can approve a request
   */
  static async canApproveRequest(requestId: string): Promise<ApprovalResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('can_approve_request', {
        p_request_id: requestId,
      });

      if (error) throw error;

      return {
        success: true,
        data: Boolean(data),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to check approval permission',
        data: null,
      };
    }
  }

  /**
   * Create a new approval delegation
   */
  static async createDelegation(data: CreateDelegationData): Promise<ApprovalResponse<string>> {
    try {
      const { data: result, error } = await supabase.rpc('create_approval_delegation', {
        p_delegate_id: data.delegate_id,
        p_page_id: data.page_id || null,
        p_workflow_id: data.workflow_id || null,
        p_start_date: data.start_date || new Date().toISOString(),
        p_end_date: data.end_date,
        p_reason: data.reason || null,
      });

      if (error) throw error;

      return {
        success: true,
        data: result as string,
        message: 'Delegation created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create delegation',
        data: null,
      };
    }
  }

  /**
   * Get active delegations for the current user
   */
  static async getActiveDelegations(): Promise<ApprovalResponse<ApprovalDelegation[]>> {
    try {
      const { data, error } = await supabase
        .from('approval_delegations')
        .select(`
          *,
          delegator:profiles!approval_delegations_delegator_id_fkey(first_name, last_name),
          delegate:profiles!approval_delegations_delegate_id_fkey(first_name, last_name),
          page:approval_pages(page_name, display_name),
          workflow:approval_workflows(workflow_name)
        `)
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const delegations =
        data?.map((d: any) => ({
          ...d,
          delegator_name: d.delegator
            ? `${d.delegator.first_name} ${d.delegator.last_name}`
            : 'Unknown',
          delegate_name: d.delegate
            ? `${d.delegate.first_name} ${d.delegate.last_name}`
            : 'Unknown',
          page_name: d.page?.display_name || 'All pages',
          workflow_name: d.workflow?.workflow_name || 'All workflows',
        })) || [];

      return {
        success: true,
        data: delegations as ApprovalDelegation[],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch delegations',
        data: null,
      };
    }
  }

  /**
   * Get unread notifications for the current user
   */
  static async getUnreadNotifications(): Promise<ApprovalResponse<ApprovalNotification[]>> {
    try {
      const { data, error } = await supabase
        .from('approval_notifications')
        .select(`
          *,
          request:approval_requests!approval_notifications_request_id_fkey(
            request_number,
            page:approval_pages(display_name)
          )
        `)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        success: true,
        data: (data || []) as ApprovalNotification[],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch notifications',
        data: null,
      };
    }
  }

  /**
   * Mark a notification as read
   */
  static async markNotificationAsRead(notificationId: string): Promise<ApprovalResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('approval_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;

      return {
        success: true,
        data: true,
        message: 'Notification marked as read',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update notification',
        data: null,
      };
    }
  }

  /**
   * Get approval statistics
   */
  static async getStatistics(): Promise<ApprovalResponse<ApprovalStatistics[]>> {
    try {
      const { data, error } = await supabase
        .from('approval_statistics')
        .select('*')
        .order('total_requests', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: (data || []) as ApprovalStatistics[],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch statistics',
        data: null,
      };
    }
  }

  /**
   * Get all active approval pages
   */
  static async getPages(): Promise<ApprovalResponse<ApprovalPage[]>> {
    try {
      const { data, error } = await supabase
        .from('approval_pages')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;

      return {
        success: true,
        data: (data || []) as ApprovalPage[],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch approval pages',
        data: null,
      };
    }
  }

  /**
   * Get active workflows for a specific page (ONLY CURRENT VERSIONS)
   */
  static async getWorkflowsForPage(pageId: string): Promise<ApprovalResponse<ApprovalWorkflow[]>> {
    try {
      const { data, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .eq('page_id', pageId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .is('replaced_by', null)
        .order('priority', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: (data || []) as ApprovalWorkflow[],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch workflows',
        data: null,
      };
    }
  }

  /**
   * Soft-delete (disable) a workflow
   */
  static async deleteWorkflow(workflowId: string): Promise<ApprovalResponse<boolean>> {
    try {
      const resolvedId = workflowId;

      const { error } = await supabase
        .from('approval_workflows')
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', resolvedId)
        .eq('is_active', true);

      if (error) throw error;

      return {
        success: true,
        data: true,
        message: 'Workflow disabled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to disable workflow',
        data: null,
      };
    }
  }
}
