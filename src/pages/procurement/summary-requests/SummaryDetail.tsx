import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  FileText,
  Hash,
  Building2,
  CalendarDays,
  MapPin,
  Pencil,
  Trash2,
  ExternalLink,
  Printer,
  Users,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';
import { useAuthStore } from '../../../store/authStore';

type Row = {
  id: string;
  request_no: string | null;
  request_date: string | null;
  requested_by_user_id: string | null;
  status: string | null;
  linked_draft_id: string | null;
  summary_payload: any;
  totals_by_currency: any;
  created_at: string;
  updated_at: string;
  fx_iqd_per_usd?: number | null;
};

type CostItem = {
  item?: string | null;
  unit?: string | null;
  qty?: number | string | null;
  currency?: string | null;
  unit_price?: number | string | null;
  total?: number | string | null;
  category?: string | null;
};

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
  return d;
}

function fmtNumber(n: any, maxFrac = 0) {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFrac }).format(num);
}

function fmtMoney(currency: string | null | undefined, amount: any) {
  const cur = (currency || '').toUpperCase();
  if (!cur) return fmtNumber(amount);
  return `${cur} ${fmtNumber(amount)}`;
}

function formatCurrencyLine(totals: Record<string, number> | null) {
  if (!totals || Object.keys(totals).length === 0) return '—';
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, val]) => `${cur} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(val || 0))}`)
    .join(' • ');
}

function displayName(p: any | null | undefined): string {
  if (!p) return '—';
  const fn = String(p.first_name || '').trim();
  const ln = String(p.last_name || '').trim();
  const full = `${fn} ${ln}`.trim();
  return full || p.email || p.id || '—';
}

function displayTitle(p: any | null | undefined): string {
  const pos = String(p?.position || '').trim();
  const dept = String(p?.department || '').trim();
  if (pos && dept) return `${pos} • ${dept}`;
  return pos || dept || '';
}

export default function SummaryDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalActions, setApprovalActions] = useState<any[]>([]);
  const [approvalReqStatus, setApprovalReqStatus] = useState<string | null>(null);
  const [peopleById, setPeopleById] = useState<Record<string, any>>({});

  const fetchOne = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!id) throw new Error('Missing id');

      const { data, error } = await supabase
        .from('procurement_summary_requests')
        .select(
          'id,request_no,request_date,requested_by_user_id,status,linked_draft_id,summary_payload,totals_by_currency,created_at,updated_at,fx_iqd_per_usd'
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      setRow(data as Row);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load summary');
      setRow(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalTrail = async (approvalRequestId: string | null | undefined) => {
    if (!approvalRequestId) {
      setApprovalActions([]);
      setApprovalReqStatus(null);
      return;
    }

    try {
      setApprovalLoading(true);
      // approval request status
      const r1 = await supabase
        .from('approval_requests')
        // many schemas use request_status (view shows request_status)
        .select('id,request_status,status')
        .eq('id', approvalRequestId)
        .maybeSingle();

      if (!r1.error) setApprovalReqStatus((r1.data as any)?.request_status ?? (r1.data as any)?.status ?? null);

      // audit trail
      const r2 = await supabase
        .from('approval_actions')
        .select('id,request_id,step_id,approver_id,action,comments,action_date,created_at')
        .eq('request_id', approvalRequestId)
        .order('created_at', { ascending: true });

      if (r2.error) throw r2.error;
      setApprovalActions(r2.data || []);

      // hydrate people (requester + approvers) for names/positions/signatures
      const requesterId = header?.requested_by?.user_id || row?.requested_by_user_id || null;
      const ids = Array.from(
        new Set(
          [
            ...((r2.data || []).map((a: any) => a.approver_id).filter(Boolean) as string[]),
            ...(requesterId ? [String(requesterId)] : []),
          ].filter(Boolean)
        )
      );
      if (ids.length) {
        const p = await supabase
          .from('profiles')
          .select('id,first_name,last_name,email,position,department,profile_image_url,avatar_url')
          .in('id', ids)
          .limit(200);
        if (!p.error && p.data) {
          const m: Record<string, any> = {};
          (p.data as any[]).forEach((x) => (m[x.id] = x));
          setPeopleById(m);
        }
      }
    } catch (e: any) {
      console.error(e);
      // don't block the page; just show what we have
      setApprovalActions([]);
    } finally {
      setApprovalLoading(false);
    }
  };

  useEffect(() => {
    fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const approvalRequestId = payload?.approval_request_id || payload?.approvalRequestId || null;
    fetchApprovalTrail(approvalRequestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  const payload = useMemo(() => safeJson<any>(row?.summary_payload) || (row?.summary_payload ?? null), [row]);
  const header = payload?.header || {};
  const overview = payload?.overview || {};
  const requester = header?.requested_by || {};
  const items: CostItem[] = useMemo(() => {
    const raw = Array.isArray(payload?.cost_items) ? payload.cost_items : [];
    return raw.map((x: any) => ({
      item: x?.item ?? '—',
      unit: x?.unit ?? '—',
      qty: x?.qty ?? x?.quantity ?? 0,
      currency: x?.currency ?? header?.base_currency ?? '—',
      unit_price: x?.unit_price ?? x?.unitPrice ?? 0,
      total: x?.total ?? 0,
      category: x?.category ?? null,
    }));
  }, [payload, header]);
  const totals = useMemo(() => {
    const fromCol = safeJson<Record<string, number>>(row?.totals_by_currency) || null;
    const fromPayload = payload?.totals_by_currency || null;
    return fromCol ?? fromPayload ?? null;
  }, [row, payload]);

  const canEdit = useMemo(() => {
    if (!row || !user?.id) return false;
    const st = String(row.status || '').toLowerCase();
    return row.requested_by_user_id === user.id && (st === 'draft' || st === 'rejected') && !!row.linked_draft_id;
  }, [row, user]);

  const canDelete = canEdit;

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      // noop
    }
  };

  const handleDelete = async () => {
    if (!row) return;
    if (!confirm('Delete this draft summary? This cannot be undone.')) return;
    try {
      const { error: e1 } = await supabase.from('procurement_summary_requests').delete().eq('id', row.id);
      if (e1) throw e1;

      // delete linked external draft (best effort)
      if (row.linked_draft_id) {
        await supabase.from('activity_plan_drafts').delete().eq('id', row.linked_draft_id);
      }

      navigate('/procurement/summary');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete');
    }
  };

  const badge = (s: string) => {
    const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
    const v = (s || '').toLowerCase();
    if (v === 'draft') return `${base} bg-gray-50 text-gray-700 border-gray-200`;
    if (v === 'submitted' || v === 'pending') return `${base} bg-yellow-50 text-yellow-800 border-yellow-200`;
    if (v === 'approved') return `${base} bg-green-50 text-green-800 border-green-200`;
    if (v === 'rejected') return `${base} bg-red-50 text-red-700 border-red-200`;
    return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-700" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto py-10 px-4">
          <button onClick={() => navigate('/procurement/summary')} className="text-sm text-gray-700 underline" type="button">
            Back to list
          </button>
          <div className="mt-4 rounded-md border px-4 py-3 bg-red-50 border-red-200 text-red-700">
            {error || 'Not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/procurement/summary')} className="flex items-center text-gray-600 hover:text-gray-900 mr-6" type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>

              <div>
                <h1 className="text-xl font-bold text-gray-900">Summary Request</h1>
                <p className="text-xs text-gray-500">Snapshot (SR) used for approvals</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={fetchOne}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
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

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
                  <Hash className="h-4 w-4 text-gray-400" />
                  {row.request_no || `SR-${row.id.slice(0, 8)}`}
                </span>
                <span className={badge(String(row.status || ''))}>{String(row.status || '—').toUpperCase()}</span>
              </div>
              <div className="mt-1 text-gray-900 font-semibold truncate">{header?.title || 'Untitled'}</div>
              {header?.subtitle ? <div className="mt-1 text-sm text-gray-600">{header.subtitle}</div> : null}
              <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {header?.project?.name || 'No project'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  {fmtDate(header?.activity_start)} → {fmtDate(header?.activity_end)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {header?.location || 'No location'}
                </span>
              </div>
              <div className="mt-3 text-sm text-gray-700">
                <span className="text-gray-500">Totals:</span> <span className="font-medium">{formatCurrencyLine(totals)}</span>
              </div>

              {typeof row.fx_iqd_per_usd === 'number' ? (
                <div className="mt-1 text-xs text-gray-500">FX IQD/USD: {row.fx_iqd_per_usd}</div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="print:hidden inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                type="button"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>

              {row.linked_draft_id ? (
                <button
                  onClick={() => navigate(`/procurement/activity-plans/${row.linked_draft_id}/edit`)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                  type="button"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Draft
                </button>
              ) : null}

              {canEdit ? (
                <button
                  onClick={() => navigate(`/procurement/activity-plans/${row.linked_draft_id}/edit`)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Draft
                </button>
              ) : null}

              {canDelete ? (
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-sm text-red-700 hover:bg-red-50"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Print styles */}
        <style>
          {`
            @media print {
              body { background: white !important; }
              .print\\:hidden { display: none !important; }
              .print\\:p-0 { padding: 0 !important; }
              .print\\:shadow-none { box-shadow: none !important; }
              .print\\:border-none { border: none !important; }
              .print\\:break-before { break-before: page; }
            }
          `}
        </style>

        {/* Summary Sheet */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 print:p-0 print:shadow-none print:border-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-gray-500">Summary Request (SR)</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{row.request_no || `SR-${row.id.slice(0, 8)}`}</div>
              <div className="mt-1 text-sm text-gray-700">Request Date: <span className="font-medium">{fmtDate(row.request_date)}</span></div>
            </div>

            <div className="text-right">
              <div className={badge(String(row.status || ''))}>{String(row.status || '—').toUpperCase()}</div>
              {typeof row.fx_iqd_per_usd === 'number' ? (
                <div className="mt-2 text-xs text-gray-500">FX IQD/USD: {row.fx_iqd_per_usd}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Activity</div>
              <div className="mt-2 text-sm text-gray-700">
                <div className="font-medium text-gray-900">{header?.title || 'Untitled'}</div>
                {header?.subtitle ? <div className="text-gray-600">{header.subtitle}</div> : null}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2 text-gray-700"><Building2 className="h-4 w-4 text-gray-400" /> {header?.project?.name || 'No project'}</div>
                  <div className="flex items-center gap-2 text-gray-700"><MapPin className="h-4 w-4 text-gray-400" /> {header?.location || 'No location'}</div>
                  <div className="flex items-center gap-2 text-gray-700"><CalendarDays className="h-4 w-4 text-gray-400" /> {fmtDate(header?.activity_start)} → {fmtDate(header?.activity_end)}</div>
                  <div className="flex items-center gap-2 text-gray-700"><Users className="h-4 w-4 text-gray-400" /> Participants: {overview?.total_participants ?? '—'} • Days: {overview?.days ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Requester</div>
              <div className="mt-2 text-sm text-gray-700 space-y-1">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{requester?.name || '—'}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{requester?.email || '—'}</span></div>
                <div className="pt-2">
                  <span className="text-gray-500">Totals:</span> <span className="font-medium">{formatCurrencyLine(totals)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Items</div>
              <div className="text-xs text-gray-500">{items.length} item(s)</div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No items</td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{it.item || '—'}</div>
                          {it.category ? <div className="text-xs text-gray-500">{it.category}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{it.unit || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNumber(it.qty, 2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{it.currency || '—'} {fmtNumber(it.unit_price, 2)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{it.currency || '—'} {fmtNumber(it.total, 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Approval trail */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Approval Status</div>
              <div className="text-xs text-gray-500">
                {approvalLoading ? 'Loading...' : approvalReqStatus ? `Request: ${String(approvalReqStatus).toUpperCase()}` : '—'}
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Step</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Approver</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {approvalLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Loading approval trail...</td>
                    </tr>
                  ) : approvalActions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No approval actions found for this request.
                      </td>
                    </tr>
                  ) : (
                    approvalActions.map((a, idx) => (
                      <tr key={a.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{a.action_date || a.created_at || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{a.step_id || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{String(a.action || '—').toUpperCase()}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {displayName(peopleById?.[a.approver_id])}
                          {peopleById?.[a.approver_id]?.position ? (
                            <div className="text-xs text-gray-500">{peopleById[a.approver_id].position}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{a.comments || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature blocks (print-friendly) */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Requester Signature</div>
              <div className="mt-2 text-sm text-gray-700">
                {(() => {
                  const rid = header?.requested_by?.user_id || row?.requested_by_user_id;
                  const rp = rid ? peopleById?.[rid] : null;
                  return (
                    <>
                      <div>
                        <span className="text-gray-500">Name:</span> <span className="font-medium">{displayName(rp) || requester?.name || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Position:</span> <span className="font-medium">{rp?.position || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Email:</span> <span className="font-medium">{rp?.email || requester?.email || '—'}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="mt-6 h-16 border-b border-dashed border-gray-300" />
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-900">Approver Signature(s)</div>
              <div className="mt-2 text-sm text-gray-700">
                {approvalActions.length === 0 ? (
                  <div className="text-gray-500">—</div>
                ) : (
                  <ul className="space-y-2">
                    {approvalActions
                      .filter((a) => {
                        const act = String(a.action || '').toLowerCase();
                        return act === 'approved' || act === 'rejected' || act === 'cancelled';
                      })
                      .map((a, idx) => (
                        <li key={a.id || idx} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900">{displayName(peopleById?.[a.approver_id])}</div>
                            {peopleById?.[a.approver_id]?.position ? (
                              <div className="text-xs text-gray-500">{peopleById[a.approver_id].position}</div>
                            ) : null}
                            <div className="text-xs text-gray-500">{String(a.action || '').toUpperCase()} • {a.action_date || a.created_at || ''}</div>
                          </div>
                          <div className="h-10 w-40 border-b border-dashed border-gray-300" />
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Raw payload (for debugging) */}
          <details className="print:hidden mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">Raw Payload (debug)</summary>
            <pre className="mt-3 p-4 text-xs overflow-auto bg-gray-50 rounded-md border border-gray-200">{JSON.stringify(payload, null, 2)}</pre>
          </details>
        </div>
      </main>
    </div>
  );
}
