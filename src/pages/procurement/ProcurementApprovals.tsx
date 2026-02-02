import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Receipt,
  PackageCheck,
  ExternalLink,
  Search,
  Filter,
  Eye,
  XCircle,
  CornerUpLeft,
} from 'lucide-react';

import { supabase } from '../../lib/supabase';

type ApprovalActionRow = {
  id: string;
  request_id: string;
  step_id: string | null;
  approver_id: string;
  action: string; // pending/approved/rejected/cancelled
  comments: string | null;
  created_at: string;
};

type ApprovalRequestRow = {
  id: string;
  request_number: string | null;
  page_id: string | null;
  workflow_id: string | null;
  requester_id: string | null;
  request_data: any; // json/jsonb
  current_step: number | null;
  status: string | null; // pending/approved/rejected...
  priority: string | null;
  created_at: string;
  updated_at: string;
};

type ApprovalPageRow = {
  id: string;
  page_name: string;
  is_active: boolean;
};

// Convenience view; keep flexible to avoid breaking when schema evolves.
type ApprovalDashboardRow = Record<string, any>;

// Backend RPC (process_approval_action) supports: approved / rejected / cancelled
type ActionType = 'approved' | 'rejected' | 'cancelled';

type ViewMode = 'pending' | 'history';

type UiItem = {
  approval_request_id: string;
  action_id: string;

  request_number: string;
  page_name: 'activity_plans' | 'procurement_summary' | 'po' | 'grn';

  status: string;
  current_step?: number | null;
  my_step?: number | null;
  can_act?: boolean;
  created_at: string;
  priority: 'low' | 'normal' | 'high';

  title: string;
  subtitle?: string;

  open_path: string | null;

  request_data: any;
};

const TABs = [
  { key: 'all', label: 'All', icon: ClipboardList },
  { key: 'activity_plans', label: 'Activity Plans', icon: ClipboardList },
  { key: 'procurement_summary', label: 'Summary', icon: FileText },
  { key: 'po', label: 'PO Approvals', icon: Receipt },
  { key: 'grn', label: 'GRN Approvals', icon: PackageCheck },
] as const;

const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  low: { label: 'Low', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  normal: { label: 'Normal', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  high: { label: 'High', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  submitted: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  approved: 'bg-green-50 text-green-800 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  returned: 'bg-amber-50 text-amber-800 border-amber-200',
  cancelled: 'bg-gray-50 text-gray-700 border-gray-200',
};

function safeStr(v: any, fallback = '—') {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s ? s : fallback;
}

function fmtDateTime(d: string) {
  try {
    return new Date(d).toLocaleString('en-GB');
  } catch {
    return d;
  }
}

function normalizePriority(v: any): 'low' | 'normal' | 'high' {
  const s = safeStr(v, 'normal').toLowerCase();
  if (s === 'low' || s === 'high' || s === 'normal') return s;
  return 'normal';
}

function normalizeProcurementPage(raw: string): UiItem['page_name'] | null {
  const s = String(raw || '').trim().toLowerCase();

  // the approval system can emit many variants (page_name, page_id, etc.)
  // so we normalize loosely to keep the dashboard useful.
  if (s === 'activity_plans' || s.includes('activity') || s.includes('plan')) return 'activity_plans';
  if (s === 'procurement_summary' || s.includes('summary')) return 'procurement_summary';
  if (s === 'po' || s.includes('purchase order')) return 'po';
  if (s === 'grn' || s.includes('goods') || s.includes('received')) return 'grn';
  return null; // not procurement
}

function buildTitle(page_name: UiItem['page_name'], reqNo: string, rd: any) {
  if (page_name === 'procurement_summary') return `PR Approval • ${safeStr(rd?.request_no || reqNo)}`;
  if (page_name === 'activity_plans') return `Activity Plan Approval • ${reqNo}`;
  if (page_name === 'po') return `PO Approval • ${reqNo}`;
  if (page_name === 'grn') return `GRN Approval • ${reqNo}`;
  return `Approval • ${reqNo}`;
}

function buildSubtitle(page_name: UiItem['page_name'], rd: any) {
  const short = (id: any) => (id ? String(id).slice(0, 8) : '');
  if (page_name === 'procurement_summary') {
    const prId = rd?.summary_request_id || rd?.pr_id;
    return prId ? `PR ID: ${short(prId)}` : '';
  }
  if (page_name === 'activity_plans') {
    const apId = rd?.activity_plan_id || rd?.draft_id;
    return apId ? `AP ID: ${short(apId)}` : '';
  }
  if (page_name === 'po') {
    const poId = rd?.po_id;
    return poId ? `PO ID: ${short(poId)}` : '';
  }
  if (page_name === 'grn') {
    const grnId = rd?.grn_id;
    return grnId ? `GRN ID: ${short(grnId)}` : '';
  }
  return '';
}

function buildOpenPath(page_name: UiItem['page_name'], rd: any): string | null {
  if (page_name === 'procurement_summary') {
    const srId = rd?.summary_request_id || rd?.sr_id || rd?.summary_id;
    return srId ? `/procurement/summary/${srId}` : null;
  }
  if (page_name === 'activity_plans') {
    const apId = rd?.activity_plan_id || rd?.draft_id;
    return apId ? `/procurement/activity-plans/${apId}` : null;
  }
  if (page_name === 'po') {
    const poId = rd?.po_id;
    return poId ? `/procurement/po/${poId}` : null;
  }
  if (page_name === 'grn') {
    const grnId = rd?.grn_id;
    return grnId ? `/procurement/grn/${grnId}` : null;
  }
  return null;
}

export default function ProcurementApprovals() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<UiItem[]>([]);

  const [tab, setTab] = useState<(typeof TABs)[number]['key']>('all');
  const [q, setQ] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'normal' | 'high'>('all');
  const [mode, setMode] = useState<ViewMode>('pending');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>(
    'all'
  );

  // modal
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<UiItem | null>(null);
  const [actionType, setActionType] = useState<ActionType>('approved');
  const [comment, setComment] = useState('');

  const closeModal = () => {
    setDetailsOpen(false);
    setSelected(null);
    setActionType('approved');
    setComment('');
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: authRes, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = authRes.user?.id;
      if (!uid) throw new Error('Not authenticated');

      // ✅ One query: approval_dashboard_for_approver already knows “what is pending for me”
      // and avoids missing items when approval_actions are not pre-generated.
      const dashRes = await supabase
        .from('approval_dashboard_for_approver')
        // Supabase v2: الـ filters (مثل eq) لازم تكون بعد select
        .select('*')
        .eq('approver_id', uid)
        .order('created_at', { ascending: false })
        .limit(800);

      if (dashRes.error) throw dashRes.error;
      const dash = (dashRes.data || []) as ApprovalDashboardRow[];

      const get = (r: any, keys: string[]) => {
        for (const k of keys) {
          const v = r?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return null;
      };

      const mapped: UiItem[] = dash
        .map((r) => {
          // Try to normalize various schemas
          const pageRaw = String(get(r, ['page_name', 'page_key', 'page']) || '').trim();
          const page_name = normalizeProcurementPage(pageRaw);
          if (!page_name) return null;

          const statusRaw = String(get(r, ['status', 'action', 'request_status']) || 'pending').toLowerCase();
          const isPending = statusRaw === 'pending' || statusRaw === 'submitted' || statusRaw === 'in_review';
          const isHistory = ['approved', 'rejected', 'cancelled', 'returned'].includes(statusRaw);

          if (mode === 'pending' && !isPending) return null;
          if (mode === 'history' && !isHistory) return null;

          const reqId = String(get(r, ['approval_request_id', 'request_id', 'id']) || '');
          const actionId = String(get(r, ['approval_action_id', 'action_id', 'latest_action_id', 'id']) || reqId);

          const request_number =
            String(get(r, ['request_number', 'request_no', 'doc_no']) || '').trim() || safeStr(reqId).slice(0, 8);

          const priority = normalizePriority(get(r, ['priority', 'request_priority']));

          const rd = (get(r, ['request_data', 'data', 'payload']) as any) || {};
          const title = buildTitle(page_name, request_number, rd);
          const subtitle = buildSubtitle(page_name, rd);
          const open_path = buildOpenPath(page_name, rd);

          return {
            approval_request_id: reqId,
            action_id: actionId,
            request_number,
            page_name,
            status: statusRaw,
            current_step: (() => {
              const v = get(r, ['current_step'], null);
              const n = Number(v);
              return Number.isFinite(n) ? n : null;
            })(),
            my_step: (() => {
              const v = get(
                r,
                ['step_no'],
                get(r, ['step_order'], get(r, ['step_index'], get(r, ['step'], null)))
              );
              const n = Number(v);
              return Number.isFinite(n) ? n : null;
            })(),
            // NOTE:
            // Previously we were blocking actions when `current_step !== my_step`, but the view can
            // expose rows for future steps or mismatched step numbers depending on how approvals are
            // pre-created/queried. This caused valid approvers to see: “waiting for previous steps”.
            //
            // We now only enable action buttons when:
            // - the request is pending
            // - the step itself is pending
            // - the current user is the assigned approver
            // The DB function `process_approval_action` enforces sequencing as the source of truth.
            can_act: (() => {
              const reqStatus = String(get(r, ['request_status', 'status'], 'pending') || 'pending');
              const stepStatus = String(get(r, ['step_status', 'action'], 'pending') || 'pending');
              const approverId = String(get(r, ['approver_id'], '') || '');
              const me = String(uid || '');
              return reqStatus === 'pending' && stepStatus === 'pending' && !!me && approverId === me;
            })(),
            created_at: String(get(r, ['created_at', 'request_created_at'], '') || new Date().toISOString()),
            priority,
            title,
            subtitle: subtitle || undefined,
            open_path,
            request_data: rd,
          } as UiItem;
        })
        .filter(Boolean) as UiItem[];

      setItems(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load procurement approvals');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return items.filter((it) => {
      if (tab !== 'all' && it.page_name !== tab) return false;
      if (priorityFilter !== 'all' && it.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && String(it.status || '').toLowerCase() !== statusFilter) return false;

      if (!needle) return true;

      return (
        it.title.toLowerCase().includes(needle) ||
        (it.subtitle || '').toLowerCase().includes(needle) ||
        it.request_number.toLowerCase().includes(needle) ||
        it.approval_request_id.toLowerCase().includes(needle)
      );
    });
  }, [items, tab, q, priorityFilter, statusFilter]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const TabButton = ({ k, label, icon: Icon }: any) => (
    <button
      onClick={() => setTab(k)}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${
        tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${tab === k ? 'bg-white/15' : 'bg-gray-100'}`}>
        {k === 'all' ? items.length : items.filter((x) => x.page_name === k).length}
      </span>
    </button>
  );

  const openDetails = (it: UiItem) => {
	    // نسمح بعرض التفاصيل دائماً.
	    // إذا ما يكدر يتخذ إجراء بسبب تسلسل الموافقات، نخلي ملاحظة بس ما نمنع العرض.
	    if (it.can_act === false) {
	      setError("This approval is waiting for previous steps. You can't act on it yet.");
	    }
	    setSelected(it);
	    setDetailsOpen(true);
	    setActionType('approved');
	    setComment('');
  };

  const performAction = async () => {
    if (!selected) return;
    // Note: we don't hard-block here. The DB function enforces sequence & permissions.

    try {
      setActing(true);
      setError(null);

      const { error: rpcErr } = await supabase.rpc('process_approval_action', {
        p_request_id: selected.approval_request_id,
        p_action: actionType, // approved/rejected/cancelled
        p_comments: comment.trim() || null,
        p_attachments: [],
      });

      if (rpcErr) throw rpcErr;

      closeModal();
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to process action');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/procurement')}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <div className="text-lg font-bold text-gray-900">Procurement Approvals</div>
                <div className="text-xs text-gray-500">
                  Only procurement pages • {mode === 'pending' ? 'pending items assigned to you' : 'your last actions'}
                </div>
              </div>
            </div>

            <button
              onClick={fetchAll}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="rounded-md border px-4 py-3 bg-red-50 border-red-200 text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Tabs + Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {TABs.map((t) => (
              <TabButton key={t.key} k={t.key} label={t.label} icon={t.icon} />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search request number, title..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              />
            </div>

            <div className="relative">
              <Filter className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('pending')}
                className={`px-3 py-2 rounded-md text-sm border ${
                  mode === 'pending'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                type="button"
              >
                Pending
              </button>
              <button
                onClick={() => setMode('history')}
                className={`px-3 py-2 rounded-md text-sm border ${
                  mode === 'history'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                type="button"
              >
                History
              </button>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="ml-auto px-3 py-2 rounded-md text-sm border border-gray-200 bg-white"
                title="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {mode === 'pending' ? 'Pending Procurement Approvals' : 'My Procurement Approval History'}
              </h3>
              <p className="text-sm text-gray-500">Activity Plans • Summary • PO • GRN</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-900 font-medium">
                {mode === 'pending' ? 'No pending approvals' : 'No history records'}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {mode === 'pending'
                  ? 'When an item is assigned to your user, it will appear here.'
                  : 'Switch back to Pending to see items waiting for your action.'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((it) => {
                const badge = PRIORITY_BADGE[it.priority] || PRIORITY_BADGE.normal;

                return (
                  <div key={it.action_id} className="p-5 hover:bg-gray-50">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-gray-900 font-medium truncate">{it.title}</div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${
                              STATUS_BADGE[String(it.status || '').toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {String(it.status || '—').toUpperCase()}
                          </span>

                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>

                        {it.subtitle ? <div className="text-sm text-gray-600 mt-0.5">{it.subtitle}</div> : null}

                        <div className="text-xs text-gray-500 mt-1">
                          Request: <span className="text-gray-800 font-medium">{it.request_number}</span>
                          <span className="mx-2">•</span>
                          Created: <span className="text-gray-800 font-medium">{fmtDateTime(it.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openDetails(it)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                          type="button"
                        >
                          <Eye className="h-4 w-4" />
                          Review
                        </button>

                        <button
                          disabled={!it.open_path}
                          onClick={() => it.open_path && navigate(it.open_path)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white disabled:opacity-50"
                          type="button"
                          title={it.open_path ? 'Open details' : 'Missing required id in request_data'}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </button>
                      </div>
                    </div>

                    {!it.open_path ? (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-3">
                        No details link found in request_data (missing id مثل summary_request_id / activity_plan_id / po_id / grn_id).
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {detailsOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">{selected.request_number} • {selected.page_name}</div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.title}</h3>
                {selected.subtitle ? <div className="text-sm text-gray-600">{selected.subtitle}</div> : null}
              </div>
              <button onClick={closeModal} className="text-gray-600 hover:text-gray-900" type="button">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-900">Request Data (JSON)</div>
                  <pre className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto text-xs">
{JSON.stringify(selected.request_data || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-900">Your Action</div>

	                  {selected.can_act === false && (
	                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
	                      This approval is waiting for previous steps. You can view details, but you can’t act yet.
	                    </div>
	                  )}

                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Action</label>
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value as ActionType)}
	                        disabled={selected.can_act === false}
                        className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="approved">Approve</option>
                        <option value="cancelled">Cancel</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Comment (optional)</label>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
	                        disabled={selected.can_act === false}
                        rows={4}
                        className="mt-1 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Add a comment..."
                      />
                    </div>

                    <button
                      onClick={performAction}
	                      disabled={acting || selected.can_act === false}
                      className={`w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-white text-sm disabled:opacity-60 ${
                        actionType === 'approved'
                          ? 'bg-green-600 hover:bg-green-700'
                          : actionType === 'rejected'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                      type="button"
                    >
                      {actionType === 'approved' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </>
                      ) : actionType === 'rejected' ? (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      ) : (
                        <>
                          <CornerUpLeft className="h-4 w-4 mr-2" />
                          Return
                        </>
                      )}
                    </button>

                    <button
                      onClick={closeModal}
                      className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                      type="button"
                    >
                      Close
                    </button>

                    {selected.open_path ? (
                      <button
                        onClick={() => selected.open_path && navigate(selected.open_path)}
                        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                        type="button"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Details Page
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 text-xs text-gray-500">
                    Approve/Reject/Return will advance the workflow via process_approval_action().
                  </div>
                </div>
              </div>
            </div>

            {!!error && (
              <div className="px-6 pb-6">
                <div className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
