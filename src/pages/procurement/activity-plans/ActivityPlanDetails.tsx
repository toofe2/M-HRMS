// src/pages/procurement/activity-plans/ActivityPlanDetails.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
  FileText,
  Users,
  Building2,
  MapPin,
  CalendarDays,
  DollarSign,
  Send,
  Pencil,
  Trash2,
  RefreshCw,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';

type PRStatus = string;

type Row = {
  id: string;
  request_no: string | null;
  request_date: string | null;
  requested_by_user_id: string | null;
  status: PRStatus | null;
  linked_draft_id: string | null;
  summary_payload: any;
  totals_by_currency: any;
  created_at: string;
  updated_at: string;
};

type ApprovalRequest = {
  id: string;
  request_number: string | null;
  page_id: string | null;
  workflow_id: string | null;
  requester_id: string | null;
  request_data: any;
  current_step: number | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApprovalAction = {
  id: string;
  request_id: string;
  step_id: string | null;
  approver_id: string;
  action: string; // pending | approved | rejected
  comments: string | null;
  action_date: string | null;
  created_at: string;
};

type CityRow = { id: string; name: string | null };

function safeJson<T = any>(v: any): T | null {
  try {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') return v as T;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return null;
      return JSON.parse(s) as T;
    }
    return null;
  } catch {
    return null;
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try {
    // if already YYYY-MM-DD keep it
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return d;
  }
}

function moneyLine(totals: Record<string, number> | null) {
  if (!totals || Object.keys(totals).length === 0) return '—';
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, val]) => `${cur} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(val || 0))}`)
    .join(' • ');
}

function badgeClass(s: string) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
  const v = (s || '').toLowerCase();
  if (v === 'draft') return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  if (v === 'submitted' || v === 'pending') return `${base} bg-yellow-50 text-yellow-800 border-yellow-200`;
  if (v === 'approved') return `${base} bg-green-50 text-green-800 border-green-200`;
  if (v === 'rejected') return `${base} bg-red-50 text-red-700 border-red-200`;
  return `${base} bg-gray-50 text-gray-700 border-gray-200`;
}

export default function ActivityPlanDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'summary' | 'approvals'>('summary');

  const [cities, setCities] = useState<Record<string, string>>({});
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [approvalActions, setApprovalActions] = useState<ApprovalAction[]>([]);
  const [myPendingAction, setMyPendingAction] = useState<ApprovalAction | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [comment, setComment] = useState('');

  const canEdit = useMemo(() => {
    if (!row || !user) return false;
    const st = String(row.status || '').toLowerCase();
    // requester can edit only if draft or rejected
    return row.requested_by_user_id === user.id && (st === 'draft' || st === 'rejected');
  }, [row, user]);

  const canDelete = canEdit; // نفس شرط التعديل (Draft / Rejected)
  const canSend = canEdit;   // نفس شرط التعديل

  useEffect(() => {
    if (!user || !id) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const fetchAll = async () => {
    await Promise.all([fetchRow(), fetchCities()]);
    // approvals depend on row.request_no sometimes, so fetch after row
    await fetchApprovals();
  };

  const fetchRow = async () => {
    try {
      setLoading(true);
      setError(null);

      const baseSelect = `
        id,
        request_no,
        request_date,
        requested_by_user_id,
        status,
        linked_draft_id,
        summary_payload,
        totals_by_currency,
        created_at,
        updated_at
      `;

      // ✅ treat :id as procurement_summary_requests.id (this is the right link for details)
      const r1 = await supabase
        .from('procurement_summary_requests')
        .select(baseSelect)
        .eq('id', id)
        .maybeSingle();

      if (r1.error) throw r1.error;

      // fallback: if someone passed draft id by mistake
      if (!r1.data) {
        const r2 = await supabase
          .from('procurement_summary_requests')
          .select(baseSelect)
          .eq('linked_draft_id', id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (r2.error) throw r2.error;
        const found = (r2.data || [])[0] as any;
        if (!found) {
          setRow(null);
          setError('No PR Summary found for this id.');
          return;
        }
        setRow(found as Row);
        return;
      }

      setRow(r1.data as Row);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load PR summary request');
    } finally {
      setLoading(false);
    }
  };

  const fetchCities = async () => {
    try {
      // إذا ما عدكم جدول cities بهذا الاسم، غيره لاسم جدول المدن عندك
      const { data, error } = await supabase.from('cities').select('id,name');
      if (error) return; // مو قاتل
      const map: Record<string, string> = {};
      (data as CityRow[]).forEach((c) => (map[c.id] = c.name || c.id));
      setCities(map);
    } catch {
      // ignore
    }
  };

  const fetchApprovals = async () => {
    try {
      if (!row || !user) return;

      // IMPORTANT:
      // request_data عندك مثل: {"summary_request_id":"..."} أو مثل اللي عرضته salary_advance_request_id
      // احنا نفلتر بطريقة آمنة: ناخذ آخر approval_request لنفس requester وبه request_data contains row.id
      // لأن jsonb ما يدعم ilike مباشرة (هذا سبب خطأ 42883 عندك سابقاً)

      const { data: reqs, error: reqErr } = await supabase
        .from('approval_requests')
        .select(
          'id,request_number,page_id,workflow_id,requester_id,request_data,current_step,status,priority,due_date,completed_at,created_at,updated_at'
        )
        .eq('requester_id', row.requested_by_user_id || '')
        .order('created_at', { ascending: false })
        .limit(20);

      if (reqErr) throw reqErr;

      const foundReq =
        (reqs || []).find((r: any) => {
          const rd = safeJson<any>(r.request_data);
          const asText = typeof r.request_data === 'string' ? r.request_data : JSON.stringify(r.request_data || {});
          return rd?.summary_request_id === row.id || asText.includes(row.id);
        }) || null;

      setApprovalReq(foundReq as any);

      if (!foundReq?.id) {
        setApprovalActions([]);
        setMyPendingAction(null);
        return;
      }

      const { data: acts, error: actErr } = await supabase
        .from('approval_actions')
        .select('id,request_id,step_id,approver_id,action,comments,action_date,created_at')
        .eq('request_id', foundReq.id)
        .order('created_at', { ascending: true });

      if (actErr) throw actErr;

      const list = (acts || []) as ApprovalAction[];
      setApprovalActions(list);

      const mine = list.find((a) => a.approver_id === user.id && String(a.action).toLowerCase() === 'pending') || null;
      setMyPendingAction(mine);
    } catch (e: any) {
      console.error(e);
      // لا تخلي approvals تكسر الصفحة
    }
  };

  const setStatusesAfterAction = async (requestId: string) => {
    // بعد approve/reject نحدث approval_requests + procurement_summary_requests.status
    const { data: acts, error } = await supabase
      .from('approval_actions')
      .select('action')
      .eq('request_id', requestId);

    if (error) return;

    const actions = (acts || []).map((x: any) => String(x.action || '').toLowerCase());
    const anyRejected = actions.includes('rejected');
    const allApproved = actions.length > 0 && actions.every((a) => a === 'approved');

    if (anyRejected) {
      await supabase.from('approval_requests').update({ status: 'rejected', completed_at: new Date().toISOString() }).eq('id', requestId);
      if (row?.id) await supabase.from('procurement_summary_requests').update({ status: 'rejected' }).eq('id', row.id);
      return;
    }

    if (allApproved) {
      await supabase.from('approval_requests').update({ status: 'approved', completed_at: new Date().toISOString() }).eq('id', requestId);
      if (row?.id) await supabase.from('procurement_summary_requests').update({ status: 'approved' }).eq('id', row.id);
      return;
    }

    // otherwise keep pending
    await supabase.from('approval_requests').update({ status: 'pending' }).eq('id', requestId);
    if (row?.id) await supabase.from('procurement_summary_requests').update({ status: 'submitted' }).eq('id', row.id);
  };

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!myPendingAction || !approvalReq) return;
    try {
      setActionBusy(true);

      const { error } = await supabase
        .from('approval_actions')
        .update({
          action: decision,
          comments: comment?.trim() || null,
          action_date: new Date().toISOString(),
        })
        .eq('id', myPendingAction.id);

      if (error) throw error;

      await setStatusesAfterAction(approvalReq.id);

      // refresh
      await fetchRow();
      await fetchApprovals();
      setComment('');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to submit approval action');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!row?.linked_draft_id) return;
    if (!confirm('Delete this draft? This cannot be undone.')) return;

    try {
      setActionBusy(true);

      // delete related summary row first (optional)
      await supabase.from('procurement_summary_requests').delete().eq('id', row.id);

      // delete draft
      const { error } = await supabase.from('activity_plan_drafts').delete().eq('id', row.linked_draft_id);
      if (error) throw error;

      navigate('/procurement/activity-plans');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete');
    } finally {
      setActionBusy(false);
    }
  };

  const payload = useMemo(() => safeJson<any>(row?.summary_payload), [row?.summary_payload]);
  const header = payload?.header || {};
  const overview = payload?.overview || {};
  const costItems = Array.isArray(payload?.cost_items) ? payload.cost_items : [];
  const participants = Array.isArray(payload?.participants) ? payload.participants : [];

  const totals =
    safeJson<Record<string, number>>(row?.totals_by_currency) ??
    (payload?.totals_by_currency as Record<string, number> | null) ??
    null;

  const cityName = (id: string | null | undefined) => {
    if (!id) return '—';
    return cities[id] || id;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/procurement/activity-plans')}
                className="flex items-center text-gray-600 hover:text-gray-900"
                type="button"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">
                    {row?.request_no || 'PR Summary'}
                  </h1>
                  <span className={badgeClass(String(row?.status || ''))}>
                    {String(row?.status || '—').toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {header?.project?.name ? `Project: ${header.project.name}` : 'Procurement Summary'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={fetchAll}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>

              <NotificationBell />
              <SettingsButton />

              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100">
                  {user?.user_metadata?.profile_image_url || user?.user_metadata?.avatar_url ? (
                    <OptimizedImage
                      src={user.user_metadata.profile_image_url || user.user_metadata.avatar_url}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="h-8 w-8 object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-700 text-sm font-medium">{user?.email?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <span className="text-gray-700 text-sm">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-sm text-gray-700">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                {fmtDate(header?.activity_start)} → {fmtDate(header?.activity_end)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                {header?.location || '—'}
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                {overview?.total_participants ?? participants.length ?? '—'} participants
              </span>
              <span className="inline-flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                {moneyLine(totals)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {canSend && row?.linked_draft_id && (
                <button
                  onClick={() => navigate(`/procurement/activity-plans/${row.linked_draft_id}/edit`)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}

              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-sm text-red-700 hover:bg-red-50"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}

              {canSend && row?.linked_draft_id && (
                <button
                  onClick={() => navigate(`/procurement/activity-plans/${row.linked_draft_id}/edit`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                  type="button"
                >
                  <Send className="h-4 w-4" />
                  Send (from draft)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 pt-3 border-b border-gray-200 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-2 text-sm rounded-md ${
                activeTab === 'summary' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
              type="button"
            >
              Summary
            </button>

            {/* Approvals tab يظهر فقط اذا هذا المستخدم عنده pending */}
            {myPendingAction && (
              <button
                onClick={() => setActiveTab('approvals')}
                className={`px-3 py-2 text-sm rounded-md ${
                  activeTab === 'approvals' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
                }`}
                type="button"
              >
                Approvals
              </button>
            )}
          </div>

          {activeTab === 'summary' ? (
            <div className="p-5">
              {/* Overview cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 mb-1">Title</div>
                  <div className="text-gray-900 font-semibold">{header?.title || '—'}</div>
                  <div className="text-sm text-gray-600 mt-1">{header?.subtitle || ''}</div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 mb-1">Project</div>
                  <div className="text-gray-900 font-semibold inline-flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {header?.project?.name || '—'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Request date: <span className="font-medium">{fmtDate(row?.request_date)}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 mb-1">Totals</div>
                  <div className="text-gray-900 font-semibold">{moneyLine(totals)}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Days: <span className="font-medium">{overview?.days ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Cost items */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-900 font-semibold">Cost Items</div>
                  <div className="text-sm text-gray-500">{costItems.length} item(s)</div>
                </div>

                {costItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg">
                    <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <div className="text-gray-900 font-medium">No cost items</div>
                  </div>
                ) : (
                  <div className="overflow-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="text-left px-4 py-3">Item</th>
                          <th className="text-left px-4 py-3">Category</th>
                          <th className="text-right px-4 py-3">Qty</th>
                          <th className="text-right px-4 py-3">Unit</th>
                          <th className="text-right px-4 py-3">Unit Price</th>
                          <th className="text-right px-4 py-3">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {costItems.map((c: any) => (
                          <tr key={c.key || c.id}>
                            <td className="px-4 py-3 text-gray-900 font-medium">{c.item || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{c.category || '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{c.qty ?? '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{c.unit ?? '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {c.currency ? `${c.currency} ` : ''}
                              {c.unit_price ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 font-semibold">
                              {c.currency ? `${c.currency} ` : ''}
                              {c.total ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Participants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-900 font-semibold">Participants</div>
                  <div className="text-sm text-gray-500">{participants.length} participant(s)</div>
                </div>

                {participants.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg">
                    <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <div className="text-gray-900 font-medium">No participants</div>
                  </div>
                ) : (
                  <div className="overflow-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="text-left px-4 py-3">Name</th>
                          <th className="text-left px-4 py-3">Type</th>
                          <th className="text-left px-4 py-3">City</th>
                          <th className="text-center px-4 py-3">Hotel</th>
                          <th className="text-center px-4 py-3">Transport</th>
                          <th className="text-center px-4 py-3">Flight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {participants.map((p: any) => (
                          <tr key={p.id}>
                            <td className="px-4 py-3 text-gray-900 font-medium">{p.full_name || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{p.participant_type || '—'}</td>
                            <td className="px-4 py-3 text-gray-700">{cityName(p.city_id)}</td>
                            <td className="px-4 py-3 text-center">
                              {p.needs_hotel ? <CheckCircle2 className="h-4 w-4 inline text-green-600" /> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.needs_transport ? <CheckCircle2 className="h-4 w-4 inline text-green-600" /> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.needs_flight ? <CheckCircle2 className="h-4 w-4 inline text-green-600" /> : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5">
              {/* Approvals */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-gray-900 font-semibold">Approval Actions</div>
                  <div className="text-sm text-gray-500">
                    {approvalReq?.request_number ? `Request: ${approvalReq.request_number}` : '—'}
                  </div>
                </div>

                {myPendingAction ? (
                  <span className="inline-flex items-center gap-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-md">
                    <Clock3 className="h-4 w-4" />
                    Waiting your action
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">No pending action for you</span>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="text-left px-4 py-3">Approver</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Comment</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {approvalActions.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 text-gray-700">{a.approver_id}</td>
                        <td className="px-4 py-3">
                          <span className={badgeClass(String(a.action || ''))}>{String(a.action || '—').toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{a.comments || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{fmtDate(a.action_date || a.created_at)}</td>
                      </tr>
                    ))}
                    {approvalActions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No approval actions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Approve / Reject only for approver */}
              {myPendingAction && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-700 mb-2">Your comment (optional)</div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full border border-gray-200 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                    rows={3}
                    placeholder="Add a comment..."
                  />

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleDecision('approved')}
                      disabled={actionBusy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                      type="button"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>

                    <button
                      onClick={() => handleDecision('rejected')}
                      disabled={actionBusy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                      type="button"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </div>

                  <div className="text-xs text-gray-500 mt-2">
                    Approve/Reject يظهر فقط إذا إنت عليك pending approval.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
