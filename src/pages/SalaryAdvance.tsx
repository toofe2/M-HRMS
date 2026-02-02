import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  HandCoins,
  FileText,
  Plus,
  Save,
  Send,
  Trash2,
  Pencil,
  Eye,
  XCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CalendarDays,
  Users,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

type AdvanceType = 'salary_advance' | 'installment_advance' | 'internal_loan';

type AdvanceStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'returned'
  | 'approved'
  | 'ready_to_pay'
  | 'paid'
  | 'rejected'
  | 'cancelled';

type TabKey = 'create' | 'list' | 'approvals';

interface SalaryAdvanceRequest {
  id: string;
  employee_id: string;
  office_id: string | null;

  request_number: string | null;
  advance_type: AdvanceType;

  amount: number;
  reason: string;

  installments: number;
  first_deduction_month: string; // YYYY-MM (or YYYY-MM-01)
  last_deduction_month: string; // YYYY-MM (or YYYY-MM-01)

  status: AdvanceStatus;

  pledge_accepted: boolean;

  created_at: string;
  updated_at: string;
}

interface ApprovalActionRow {
  id: string;
  action: string;
  comments: string | null;
  action_date: string | null;
  step_id: string | null;
  approver_id: string | null;
  created_at: string;

  approver?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;

  step?: {
    step_name: string | null;
    step_order?: number | null;
  } | null;
}

interface ApprovalActionUI {
  id: string;
  status: string;
  step_name: string | null;
  approver_name: string | null;
  approver_email: string | null;
  comment: string | null;
  acted_at: string | null;
  created_at: string;
}

interface PendingAdvanceApprovalItem {
  action_id: string;
  salary_advance_request_id: string;

  step_id: string | null;
  step_name: string | null;

  requester_id: string | null;
  requester_name: string | null;
  requester_email: string | null;

  created_at: string;

  advance: SalaryAdvanceRequest | null;
}

const ADVANCE_TYPE_LABEL: Record<AdvanceType, string> = {
  salary_advance: 'Salary Advance (From Salary)',
  installment_advance: 'Installment Advance',
  internal_loan: 'Internal Loan',
};

const STATUS_BADGE: Record<AdvanceStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pending', cls: 'bg-yellow-100 text-yellow-700' },
  returned: { label: 'Returned', cls: 'bg-orange-100 text-orange-700' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
  ready_to_pay: { label: 'Ready to Pay', cls: 'bg-teal-100 text-teal-700' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-200 text-gray-700' },
};

function toMonthInputValue(v: string) {
  if (!v) return '';
  return v.length >= 7 ? v.slice(0, 7) : v;
}

function monthToStoreValue(month: string) {
  if (!month) return '';
  return `${month}-01`;
}

function clampInt(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function formatApproverName(first?: string | null, last?: string | null) {
  const f = (first || '').trim();
  const l = (last || '').trim();
  const full = `${f} ${l}`.trim();
  return full || null;
}

export default function SalaryAdvance() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<TabKey>('create');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [requests, setRequests] = useState<SalaryAdvanceRequest[]>([]);
  const [selected, setSelected] = useState<SalaryAdvanceRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [approvalActions, setApprovalActions] = useState<ApprovalActionUI[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Approvals panel
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingAdvanceApprovalItem[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionItem, setDecisionItem] = useState<PendingAdvanceApprovalItem | null>(null);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject'>('approve');
  const [decisionComment, setDecisionComment] = useState<string>('');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [advanceType, setAdvanceType] = useState<AdvanceType>('salary_advance');
  const [amount, setAmount] = useState<string>(''); // input text
  const [reason, setReason] = useState<string>('');
  const [installments, setInstallments] = useState<number>(1);
  const [firstMonth, setFirstMonth] = useState<string>(''); // YYYY-MM
  const [lastMonth, setLastMonth] = useState<string>(''); // YYYY-MM
  const [pledgeAccepted, setPledgeAccepted] = useState(false);

  const employeeId = user?.id;
  const canUse = Boolean(employeeId);

  const computedLastMonth = useMemo(() => {
    if (!firstMonth || !installments) return '';
    const [y, m] = firstMonth.split('-').map(Number);
    if (!y || !m) return '';
    const start = new Date(y, m - 1, 1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + (installments - 1));
    const yy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    return `${yy}-${mm}`;
  }, [firstMonth, installments]);

  const effectiveLastMonth = lastMonth || computedLastMonth;

  const resetForm = () => {
    setEditingId(null);
    setAdvanceType('salary_advance');
    setAmount('');
    setReason('');
    setInstallments(1);
    setFirstMonth('');
    setLastMonth('');
    setPledgeAccepted(false);
  };

  const validateForm = () => {
    const amt = Number(amount);
    if (!advanceType) return 'Advance type is required.';
    if (!amount || Number.isNaN(amt) || amt <= 0) return 'Amount must be a valid number > 0.';
    if (!reason.trim()) return 'Reason is required.';
    if (!installments || installments < 1) return 'Installments must be >= 1.';
    if (!firstMonth) return 'First deduction month is required.';
    if (!effectiveLastMonth) return 'Last deduction month is required.';
    if (effectiveLastMonth < firstMonth) return 'Last deduction month must be >= First month.';
    if (!pledgeAccepted) return 'You must accept the pledge.';
    return null;
  };

  const loadRequests = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salary_advance_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as SalaryAdvanceRequest[]);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Cache page_id for salary advance
  const [salaryAdvancePageId, setSalaryAdvancePageId] = useState<string | null>(null);

  const getSalaryAdvancePageId = async () => {
    if (salaryAdvancePageId) return salaryAdvancePageId;

    const { data, error } = await supabase
      .from('approval_pages')
      .select('id')
      .eq('page_key', 'salary_advance_requests')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.warn('getSalaryAdvancePageId failed:', error.message);
      return null;
    }

    const pid = (data as any)?.id || null;
    setSalaryAdvancePageId(pid);
    return pid;
  };

  const getApprovalRequestForSalaryAdvance = async (salaryAdvanceRequestId: string) => {
    const pageId = await getSalaryAdvancePageId();

    // approval_requests.request_data.salary_advance_request_id = <salaryAdvanceRequestId>
    // We query by request_data field; page filter is best-effort (if null we still try).
    let q = supabase
      .from('approval_requests')
      .select('id, requester_id, status, current_step, created_at')
      .eq('request_data->>salary_advance_request_id', salaryAdvanceRequestId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (pageId) q = q.eq('page_id', pageId);

    const { data, error } = await q.maybeSingle();
    if (error) {
      console.warn('getApprovalRequestForSalaryAdvance failed:', error.message);
      return null;
    }
    return data || null;
  };

  const fetchApprovalActionsForAdvance = async (salaryAdvanceRequestId: string) => {
    // ✅ Correct link:
    // approval_actions.request_id = approval_requests.id
    const ar = await getApprovalRequestForSalaryAdvance(salaryAdvanceRequestId);
    const approvalRequestId = (ar as any)?.id as string | undefined;

    if (!approvalRequestId) return [];

    const { data, error } = await supabase
      .from('approval_actions')
      .select(
        `
        id,
        action,
        comments,
        action_date,
        step_id,
        approver_id,
        created_at,
        approver:profiles!approval_actions_approver_id_fkey(first_name, last_name, email),
        step:approval_steps!approval_actions_step_id_fkey(step_name, step_order)
      `
      )
      .eq('request_id', approvalRequestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('approval_actions query failed:', error.message);
      return [];
    }

    const rows = (data || []) as ApprovalActionRow[];
    const mapped: ApprovalActionUI[] = rows.map((a) => ({
      id: a.id,
      status: a.action,
      step_name: a.step?.step_name || null,
      approver_name: formatApproverName(a.approver?.first_name, a.approver?.last_name),
      approver_email: a.approver?.email || null,
      comment: a.comments || null,
      acted_at: a.action_date || null,
      created_at: a.created_at,
    }));

    return mapped;
  };

  const openDetails = async (req: SalaryAdvanceRequest) => {
    setSelected(req);
    setDetailsOpen(true);
    setApprovalActions([]);
    setLoadingDetails(true);

    try {
      const actions = await fetchApprovalActionsForAdvance(req.id);
      setApprovalActions(actions);
    } catch (e) {
      console.error(e);
      setApprovalActions([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const startEdit = (req: SalaryAdvanceRequest) => {
    setTab('create');
    setEditingId(req.id);
    setAdvanceType(req.advance_type);
    setAmount(String(req.amount));
    setReason(req.reason || '');
    setInstallments(req.installments || 1);
    setFirstMonth(toMonthInputValue(req.first_deduction_month));
    setLastMonth(toMonthInputValue(req.last_deduction_month));
    setPledgeAccepted(Boolean(req.pledge_accepted));
  };

  const saveDraft = async () => {
    if (!employeeId) return;

    const amt = Number(amount);
    if (!amount || Number.isNaN(amt) || amt <= 0) return alert('Enter a valid amount.');
    if (!reason.trim()) return alert('Reason is required (even for draft).');
    if (!firstMonth) return alert('First deduction month is required.');
    if (!effectiveLastMonth) return alert('Last deduction month is required.');

    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        advance_type: advanceType,
        amount: amt,
        reason: reason.trim(),
        installments: clampInt(Number(installments), 1, 60),
        first_deduction_month: monthToStoreValue(firstMonth),
        last_deduction_month: monthToStoreValue(effectiveLastMonth),
        pledge_accepted: pledgeAccepted,
        status: 'draft' as AdvanceStatus,
      };

      if (editingId) {
        const { error } = await supabase
          .from('salary_advance_requests')
          .update(payload)
          .eq('id', editingId)
          .eq('employee_id', employeeId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('salary_advance_requests').insert(payload);
        if (error) throw error;
      }

      await loadRequests();
      alert('Draft saved.');
      resetForm();
      setTab('list');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async () => {
    if (!employeeId) return;

    const err = validateForm();
    if (err) return alert(err);

    setSaving(true);
    try {
      const amt = Number(amount);

      // On submit: pending
      const payload = {
        employee_id: employeeId,
        advance_type: advanceType,
        amount: amt,
        reason: reason.trim(),
        installments: clampInt(Number(installments), 1, 60),
        first_deduction_month: monthToStoreValue(firstMonth),
        last_deduction_month: monthToStoreValue(effectiveLastMonth),
        pledge_accepted: true,
        status: 'pending' as AdvanceStatus,
      };

      let requestId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('salary_advance_requests')
          .update(payload)
          .eq('id', editingId)
          .eq('employee_id', employeeId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('salary_advance_requests').insert(payload).select('id').single();
        if (error) throw error;
        requestId = (data as any)?.id;
      }

      if (!requestId) throw new Error('Missing request id after submit.');

      // Create approval actions from workflow
      const { error: wfErr } = await supabase.rpc('create_salary_advance_actions_from_workflow', {
        p_salary_advance_request_id: requestId,
      });

      if (wfErr) {
        console.warn('create_salary_advance_actions_from_workflow failed:', wfErr.message);
        alert(`Submitted, but workflow actions failed: ${wfErr.message}`);
      }

      await loadApprovals();
      await loadRequests();

      alert('Request submitted.');
      resetForm();
      setTab('list');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to submit request');
    } finally {
      setSaving(false);
    }
  };

  const withdrawRequest = async (req: SalaryAdvanceRequest) => {
    if (!employeeId) return;
    if (!['pending', 'submitted'].includes(req.status)) {
      return alert('Only submitted/pending requests can be withdrawn.');
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('salary_advance_requests')
        .update({ status: 'cancelled' as AdvanceStatus })
        .eq('id', req.id)
        .eq('employee_id', employeeId);

      if (error) throw error;

      await loadRequests();
      await loadApprovals();
      alert('Request withdrawn.');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to withdraw');
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async (req: SalaryAdvanceRequest) => {
    if (!employeeId) return;
    if (req.status !== 'draft') return alert('Only draft requests can be deleted.');

    setSaving(true);
    try {
      const { error } = await supabase.from('salary_advance_requests').delete().eq('id', req.id).eq('employee_id', employeeId);

      if (error) throw error;

      await loadRequests();
      alert('Draft deleted.');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to delete draft');
    } finally {
      setSaving(false);
    }
  };

  const statusIcon = (s: AdvanceStatus) => {
    if (s === 'approved' || s === 'paid') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (s === 'rejected' || s === 'cancelled') return <XCircle className="h-4 w-4 text-red-600" />;
    if (s === 'returned') return <AlertCircle className="h-4 w-4 text-orange-600" />;
    return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  };

  // -------------------------
  // Approvals (for approvers)
  // -------------------------
  const loadApprovals = async () => {
    if (!user?.id) return;

    setApprovalsLoading(true);
    try {
      await getSalaryAdvancePageId(); // best effort

      // ✅ Only pending actions assigned to me
      const { data: actions, error: aErr } = await supabase
        .from('approval_actions')
        .select(
          `
          id,
          request_id,
          step_id,
          approver_id,
          action,
          created_at,
          step:approval_steps!approval_actions_step_id_fkey(step_name, step_order)
        `
        )
        .eq('approver_id', user.id)
        .eq('action', 'pending')
        .order('created_at', { ascending: true });

      if (aErr) throw aErr;

      const approvalRequestIds = (actions || []).map((x: any) => x.request_id).filter(Boolean) as string[];

      if (approvalRequestIds.length === 0) {
        setPendingApprovals([]);
        return;
      }

      // ✅ Load approval_requests to get salary_advance_request_id & requester
      const { data: reqs, error: rErr } = await supabase
        .from('approval_requests')
        .select('id, requester_id, request_data, created_at, status, current_step')
        .in('id', approvalRequestIds);

      if (rErr) throw rErr;

      const reqMap = new Map<string, any>();
      (reqs || []).forEach((r: any) => reqMap.set(r.id, r));

      const advanceIds = (reqs || [])
        .map((r: any) => r?.request_data?.salary_advance_request_id)
        .filter(Boolean) as string[];

      if (advanceIds.length === 0) {
        setPendingApprovals([]);
        return;
      }

      // ✅ Load salary advances
      const { data: advances, error: sErr } = await supabase.from('salary_advance_requests').select('*').in('id', advanceIds);

      if (sErr) throw sErr;

      const advMap = new Map<string, SalaryAdvanceRequest>();
      (advances || []).forEach((r: any) => advMap.set(r.id, r as SalaryAdvanceRequest));

      // ✅ Load requester profiles (from approval_requests.requester_id)
      const requesterIds = Array.from(new Set((reqs || []).map((r: any) => r.requester_id).filter(Boolean))) as string[];

      const profMap = new Map<string, { name: string | null; email: string | null }>();
      if (requesterIds.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', requesterIds);

        if (!pErr) {
          (profs || []).forEach((p: any) => {
            const name = formatApproverName(p.first_name, p.last_name);
            profMap.set(p.id, { name, email: p.email || null });
          });
        }
      }

      const mapped: PendingAdvanceApprovalItem[] = (actions || [])
        .map((x: any) => {
          const req = reqMap.get(x.request_id);
          const salary_advance_request_id = req?.request_data?.salary_advance_request_id as string | undefined;
          if (!salary_advance_request_id) return null;

          const advance = advMap.get(salary_advance_request_id) || null;
          if (!advance) return null;

          const requester = profMap.get(req.requester_id);

          return {
            action_id: x.id,
            salary_advance_request_id,
            step_id: x.step_id || null,
            step_name: x.step?.step_name || null,
            requester_id: req.requester_id || null,
            requester_name: requester?.name || null,
            requester_email: requester?.email || null,
            created_at: x.created_at,
            advance,
          } as PendingAdvanceApprovalItem;
        })
        .filter(Boolean) as PendingAdvanceApprovalItem[];

      // Only show still pending advances (status stays pending until final step; trigger will set approved at the end)
      const onlyPending = mapped.filter((m) => m.advance?.status === 'pending');

      setPendingApprovals(onlyPending);
    } catch (e: any) {
      console.error(e);
      setPendingApprovals([]);
      alert(e?.message || 'Failed to load approvals');
    } finally {
      setApprovalsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openDecision = (item: PendingAdvanceApprovalItem, type: 'approve' | 'reject') => {
    setDecisionItem(item);
    setDecisionType(type);
    setDecisionComment('');
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    if (!decisionItem || !user?.id) return;

    setActingId(decisionItem.action_id);
    try {
      // ✅ must match DB check constraint: pending/approved/rejected/delegated/escalated
      const newActionValue = decisionType === 'approve' ? 'approved' : 'rejected';

      // 1) update approval action ONLY
      // Server-side trigger advance_approval_step_on_action() will:
      // - move current_step
      // - activate next step (pending)
      // - set approval_requests status
      // - (and should update salary_advance_requests status on final step)
      const { error: uErr } = await supabase
        .from('approval_actions')
        .update({
          action: newActionValue,
          comments: decisionComment?.trim() || null,
          action_date: new Date().toISOString(),
        })
        .eq('id', decisionItem.action_id)
        .eq('approver_id', user.id);

      if (uErr) throw uErr;

      setDecisionOpen(false);
      setDecisionItem(null);

      // refresh
      await loadApprovals();
      await loadRequests();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to submit decision');
    } finally {
      setActingId(null);
    }
  };

  const canApprove = pendingApprovals.length > 0;

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>

          <button
            onClick={async () => {
              await loadRequests();
              await loadApprovals();
            }}
            className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50"
            disabled={loading || approvalsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(loading || approvalsLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Top Card */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Salary Advance</h2>
              <p className="mt-1 text-sm text-gray-500">Request an advance/loan linked to payroll deductions & approvals</p>
            </div>

            <div className="inline-flex p-3 rounded-lg bg-yellow-500">
              <HandCoins className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setTab('create')}
                className={`px-4 py-2 text-sm rounded-md ${tab === 'create' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Create Request
              </button>

              <button
                onClick={() => setTab('list')}
                className={`px-4 py-2 text-sm rounded-md ${tab === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                My Requests
              </button>

              {(canApprove || pendingApprovals.length > 0) && (
                <button
                  onClick={() => setTab('approvals')}
                  className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 ${
                    tab === 'approvals' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Approvals
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs px-2 py-0.5">
                    {pendingApprovals.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {!canUse ? (
              <div className="text-sm text-gray-600">You must be logged in.</div>
            ) : tab === 'create' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <div className="lg:col-span-2">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-gray-700" />
                        <h3 className="text-lg font-medium text-gray-900">{editingId ? 'Edit Request' : 'New Request'}</h3>
                      </div>

                      {editingId && (
                        <button onClick={resetForm} className="text-sm text-gray-600 hover:text-gray-900">
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Advance Type</label>
                        <select
                          value={advanceType}
                          onChange={(e) => setAdvanceType(e.target.value as AdvanceType)}
                          className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="salary_advance">{ADVANCE_TYPE_LABEL.salary_advance}</option>
                          <option value="installment_advance">{ADVANCE_TYPE_LABEL.installment_advance}</option>
                          <option value="internal_loan">{ADVANCE_TYPE_LABEL.internal_loan}</option>
                        </select>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Amount</label>
                        <input
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          type="number"
                          min="0"
                          step="0.01"
                          className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          placeholder="$500"
                        />
                      </div>

                      {/* Reason */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Reason (Required)</label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          rows={4}
                          placeholder="Write the reason for requesting the advance..."
                        />
                      </div>

                      {/* Installments + Months */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Installments</label>
                          <input
                            value={installments}
                            onChange={(e) => setInstallments(clampInt(Number(e.target.value), 1, 60))}
                            type="number"
                            min={1}
                            max={60}
                            className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">Max 60</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">First Deduction Month</label>
                          <div className="mt-1 relative">
                            <CalendarDays className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                            <input
                              value={firstMonth}
                              onChange={(e) => setFirstMonth(e.target.value)}
                              type="month"
                              className="pl-9 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Last Deduction Month</label>
                          <div className="mt-1 relative">
                            <CalendarDays className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                            <input
                              value={lastMonth}
                              onChange={(e) => setLastMonth(e.target.value)}
                              type="month"
                              className="pl-9 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            />
                          </div>
                          {!lastMonth && computedLastMonth && (
                            <p className="mt-1 text-xs text-gray-500">Auto: {computedLastMonth} (based on installments)</p>
                          )}
                        </div>
                      </div>

                      {/* Pledge */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={pledgeAccepted}
                            onChange={(e) => setPledgeAccepted(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-800">Pledge</div>
                            <div className="text-sm text-gray-600">
                              I acknowledge that this advance/loan will be deducted from my salary according to the agreed plan, and it must be settled before
                              contract end.
                            </div>
                          </div>
                        </label>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={saveDraft}
                          disabled={saving}
                          className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Draft
                        </button>

                        <button
                          onClick={submitRequest}
                          disabled={saving}
                          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Submit
                        </button>

                        <button
                          onClick={() => {
                            resetForm();
                            setTab('list');
                          }}
                          className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Side Panel */}
                <div className="lg:col-span-1">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900">Notes</h3>
                      <p className="mt-1 text-sm text-gray-500">How it works</p>
                    </div>
                    <div className="p-5 space-y-3 text-sm text-gray-700">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                        <span>Your request will go through the approval workflow.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                        <span>Once approved and paid, deductions will be applied automatically in payroll.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                        <span>You can withdraw a request while it is pending.</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">Tip: If you leave Last Deduction Month empty, the system will calculate it automatically.</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : tab === 'list' ? (
              <div>
                {/* List */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">My Requests</h3>
                  <button
                    onClick={() => {
                      resetForm();
                      setTab('create');
                    }}
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New
                  </button>
                </div>

                {loading ? (
                  <div className="text-sm text-gray-600">Loading...</div>
                ) : requests.length === 0 ? (
                  <div className="text-sm text-gray-600">No requests yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm text-gray-500">{r.request_number ? `#${r.request_number}` : 'Request'}</div>
                              <div className="mt-1 text-lg font-medium text-gray-900">{ADVANCE_TYPE_LABEL[r.advance_type]}</div>
                              <div className="mt-1 text-sm text-gray-600">
                                Amount: <span className="font-medium">{r.amount}</span>
                              </div>
                            </div>

                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${STATUS_BADGE[r.status].cls}`}>
                              {statusIcon(r.status)}
                              {STATUS_BADGE[r.status].label}
                            </span>
                          </div>

                          <div className="mt-4 text-xs text-gray-500">
                            Installments: {r.installments} • {toMonthInputValue(r.first_deduction_month)} → {toMonthInputValue(r.last_deduction_month)}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => openDetails(r)}
                              className="inline-flex items-center px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Details
                            </button>

                            {r.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => startEdit(r)}
                                  className="inline-flex items-center px-3 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 text-sm"
                                  disabled={saving}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteDraft(r)}
                                  className="inline-flex items-center px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
                                  disabled={saving}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </button>
                              </>
                            )}

                            {r.status === 'pending' && (
                              <button
                                onClick={() => withdrawRequest(r)}
                                className="inline-flex items-center px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
                                disabled={saving}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Withdraw
                              </button>
                            )}

                            {r.status === 'returned' && (
                              <button
                                onClick={() => startEdit(r)}
                                className="inline-flex items-center px-3 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-sm"
                                disabled={saving}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit & Resubmit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Approvals tab
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Pending Salary Advance Approvals</h3>
                    <p className="text-sm text-gray-500">Only requests assigned to you will appear here.</p>
                  </div>

                  <button
                    onClick={loadApprovals}
                    className="inline-flex items-center px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50"
                    disabled={approvalsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${approvalsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {approvalsLoading ? (
                  <div className="text-sm text-gray-600">Loading approvals...</div>
                ) : pendingApprovals.length === 0 ? (
                  <div className="text-sm text-gray-600">No pending approvals assigned to you.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingApprovals.map((it) => (
                      <div
                        key={it.action_id}
                        className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-gray-500">Step</div>
                              <div className="text-sm font-medium text-gray-900">{it.step_name || 'Approval Step'}</div>

                              <div className="mt-2 text-xs text-gray-500">Requester</div>
                              <div className="text-sm text-gray-900">{it.requester_name || it.requester_email || it.requester_id || 'Unknown'}</div>

                              <div className="mt-3 text-xs text-gray-500">Amount</div>
                              <div className="text-lg font-semibold text-gray-900">{it.advance?.amount ?? '-'}</div>

                              <div className="mt-1 text-xs text-gray-500">
                                {it.advance?.advance_type ? ADVANCE_TYPE_LABEL[it.advance.advance_type] : ''}
                              </div>
                            </div>

                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Pending</span>
                          </div>

                          <div className="mt-4 text-xs text-gray-500">Created: {it.created_at}</div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => it.advance && openDetails(it.advance)}
                              className="inline-flex items-center px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                              disabled={!it.advance}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </button>

                            <button
                              onClick={() => openDecision(it, 'approve')}
                              className="inline-flex items-center px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm disabled:opacity-60"
                              disabled={actingId === it.action_id}
                            >
                              <ThumbsUp className="h-4 w-4 mr-2" />
                              Approve
                            </button>

                            <button
                              onClick={() => openDecision(it, 'reject')}
                              className="inline-flex items-center px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm disabled:opacity-60"
                              disabled={actingId === it.action_id}
                            >
                              <ThumbsDown className="h-4 w-4 mr-2" />
                              Reject
                            </button>
                          </div>

                          {it.advance?.reason && (
                            <div className="mt-4 text-sm text-gray-700">
                              <div className="text-xs text-gray-500 mb-1">Reason</div>
                              <div className="line-clamp-3 whitespace-pre-wrap">{it.advance.reason}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Details Modal */}
        {detailsOpen && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">{selected.request_number ? `#${selected.request_number}` : 'Request Details'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">{ADVANCE_TYPE_LABEL[selected.advance_type]}</h3>
                </div>
                <button onClick={() => setDetailsOpen(false)} className="text-gray-600 hover:text-gray-900">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">Summary</div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${STATUS_BADGE[selected.status].cls}`}>
                        {STATUS_BADGE[selected.status].label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="text-gray-600">
                        Amount: <span className="font-medium text-gray-900">{selected.amount}</span>
                      </div>
                      <div className="text-gray-600">
                        Installments: <span className="font-medium text-gray-900">{selected.installments}</span>
                      </div>
                      <div className="text-gray-600">
                        First month: <span className="font-medium text-gray-900">{toMonthInputValue(selected.first_deduction_month)}</span>
                      </div>
                      <div className="text-gray-600">
                        Last month: <span className="font-medium text-gray-900">{toMonthInputValue(selected.last_deduction_month)}</span>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-gray-600">
                      Reason:
                      <div className="mt-1 text-gray-900 whitespace-pre-wrap">{selected.reason}</div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-900">Approval Timeline</div>
                    {loadingDetails ? (
                      <div className="mt-2 text-sm text-gray-600">Loading approvals...</div>
                    ) : approvalActions.length === 0 ? (
                      <div className="mt-2 text-sm text-gray-600">No approval actions found (not created yet or not linked).</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {approvalActions.map((a) => (
                          <div key={a.id} className="flex items-start gap-3">
                            <div className="h-2 w-2 rounded-full bg-gray-400 mt-2" />
                            <div className="flex-1">
                              <div className="text-sm text-gray-900">
                                <span className="font-medium">{a.step_name || 'Step'}</span> {' • '}
                                <span className="text-gray-600">{a.status}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {a.approver_name || a.approver_email || 'Approver'} • {a.acted_at || a.created_at}
                              </div>
                              {a.comment && <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{a.comment}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-900">Actions</div>
                    <div className="mt-3 space-y-2">
                      {selected.status === 'draft' && (
                        <button
                          onClick={() => {
                            setDetailsOpen(false);
                            startEdit(selected);
                          }}
                          className="w-full inline-flex items-center justify-center px-3 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700 text-sm"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Draft
                        </button>
                      )}

                      {selected.status === 'pending' && (
                        <button
                          onClick={async () => {
                            await withdrawRequest(selected);
                            setDetailsOpen(false);
                          }}
                          className="w-full inline-flex items-center justify-center px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
                          disabled={saving}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Withdraw
                        </button>
                      )}

                      <button
                        onClick={() => setDetailsOpen(false)}
                        className="w-full inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                      >
                        Close
                      </button>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">Deductions will be applied automatically in payroll once Admin marks it as Paid.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decision Modal */}
        {decisionOpen && decisionItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-gray-700" />
                  <div>
                    <div className="text-sm text-gray-500">Decision</div>
                    <div className="text-lg font-semibold text-gray-900">{decisionType === 'approve' ? 'Approve Request' : 'Reject Request'}</div>
                  </div>
                </div>

                <button onClick={() => setDecisionOpen(false)} className="text-gray-600 hover:text-gray-900">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-sm text-gray-700">
                  <div className="text-xs text-gray-500">Requester</div>
                  <div className="font-medium">{decisionItem.requester_name || decisionItem.requester_email || 'Unknown'}</div>
                </div>

                <div className="text-sm text-gray-700">
                  <div className="text-xs text-gray-500">Step</div>
                  <div className="font-medium">{decisionItem.step_name || 'Approval Step'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Comment (optional)</label>
                  <textarea
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Write a comment..."
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDecisionOpen(false)}
                    className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={submitDecision}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-white ${
                      decisionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                    disabled={actingId === decisionItem.action_id}
                  >
                    {decisionType === 'approve' ? (
                      <>
                        <ThumbsUp className="h-4 w-4 mr-2" /> Approve
                      </>
                    ) : (
                      <>
                        <ThumbsDown className="h-4 w-4 mr-2" /> Reject
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
