// src/pages/procurement/summary-requests/ProcurementSummaryRequests.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  CalendarDays,
  Building2,
  AlertCircle,
  FileText,
  Eye,
  MapPin,
  Hash,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';
import { useAuthStore } from '../../../store/authStore';

type PRStatus = string;

type SummaryHeader = {
  title?: string | null;
  subtitle?: string | null;
  location?: string | null;
  activity_start?: string | null;
  activity_end?: string | null;
  request_date?: string | null;
  base_currency?: string | null;
  project?: { id?: string; name?: string | null } | null;
  requested_by?: { name?: string | null; email?: string | null; user_id?: string | null } | null;
};

type SummaryPayload = {
  version?: number;
  header?: SummaryHeader;
  overview?: { days?: number; total_participants?: number } | null;
  cost_items?: any[];
  participants?: any[];
  totals_by_currency?: Record<string, number>;
};

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

  title?: string | null;
  subtitle?: string | null;
  location?: string | null;
  project_name?: string | null;
  activity_start?: string | null;
  activity_end?: string | null;
  total_participants?: number | null;
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

function formatCurrencyLine(totals: Record<string, number> | null) {
  if (!totals || Object.keys(totals).length === 0) return '—';
  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cur, val]) => `${cur} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(val || 0))}`)
    .join(' • ');
}

export default function ProcurementSummaryRequests() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | string>('all');
  const [tab, setTab] = useState<'pending' | 'drafts' | 'history'>('pending');

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('procurement_summary_requests')
        .select(
          `
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
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: Row[] = (data || []).map((r: any) => {
        const payload = safeJson<SummaryPayload>(r.summary_payload);
        const header = payload?.header || {};
        const totalsFromCol = safeJson<Record<string, number>>(r.totals_by_currency);
        const totalsFromPayload = payload?.totals_by_currency || null;

        const overviewParticipants =
          typeof payload?.overview?.total_participants === 'number'
            ? payload!.overview!.total_participants!
            : null;

        return {
          ...r,
          title: header?.title ?? null,
          subtitle: header?.subtitle ?? null,
          location: header?.location ?? null,
          project_name: header?.project?.name ?? null,
          activity_start: header?.activity_start ?? null,
          activity_end: header?.activity_end ?? null,
          total_participants: overviewParticipants,
          totals_by_currency: totalsFromCol ?? totalsFromPayload ?? null,
        } as Row;
      });

      setRows(mapped);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load PR summary requests');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ =
        !needle ||
        (r.request_no || '').toLowerCase().includes(needle) ||
        (r.title || '').toLowerCase().includes(needle) ||
        (r.subtitle || '').toLowerCase().includes(needle) ||
        (r.location || '').toLowerCase().includes(needle) ||
        (r.project_name || '').toLowerCase().includes(needle);

      const st = String(r.status || '').toLowerCase();
      const matchTab =
        tab === 'pending'
          ? st === 'submitted' || st === 'in_review' || st === 'pending'
          : tab === 'drafts'
            ? st === 'draft' || st === 'rejected'
            : st === 'approved' || st === 'cancelled' || st === 'closed';

      const matchStatus = status === 'all' ? true : st === String(status || '').toLowerCase();
      return matchQ && matchTab && matchStatus;
    });
  }, [rows, q, status, tab]);

  const counts = useMemo(() => {
    const c = { pending: 0, drafts: 0, history: 0 };
    rows.forEach((r) => {
      const st = String(r.status || '').toLowerCase();
      if (st === 'submitted' || st === 'in_review' || st === 'pending') c.pending += 1;
      else if (st === 'draft' || st === 'rejected') c.drafts += 1;
      else if (st === 'approved' || st === 'cancelled' || st === 'closed') c.history += 1;
    });
    return c;
  }, [rows]);

  const canEdit = (r: Row) => {
    const st = String(r.status || '').toLowerCase();
    return user?.id && r.requested_by_user_id === user.id && (st === 'draft' || st === 'rejected');
  };

  const canDelete = canEdit;

  const handleDelete = async (r: Row) => {
    if (!r.linked_draft_id) return;
    if (!confirm('Delete this draft? This cannot be undone.')) return;

    try {
      const { error: e1 } = await supabase.from('procurement_summary_requests').delete().eq('id', r.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('activity_plan_drafts').delete().eq('id', r.linked_draft_id);
      if (e2) throw e2;

      fetchData();
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

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/procurement')} className="flex items-center text-gray-600 hover:text-gray-900 mr-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Summary Requests (SR)</h1>
                <p className="text-xs text-gray-500">Activity Plan snapshots for approvals</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
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

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'pending', label: 'Pending / In Review', count: counts.pending },
                  { key: 'drafts', label: 'Drafts / Rejected', count: counts.drafts },
                  { key: 'history', label: 'History', count: counts.history },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    type="button"
                    className={
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border transition ' +
                      (active
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                    }
                  >
                    <span>{t.label}</span>
                    <span
                      className={
                        'min-w-[2rem] text-center rounded-full px-2 py-0.5 text-xs ' +
                        (active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700')
                      }
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search request no, project, title, location..."
                  className="w-full md:w-96 pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                />
              </div>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full md:w-56 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <button
                onClick={fetchData}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <button
              onClick={() => navigate('/procurement/activity-plans/new')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              New Activity Plan
            </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All Summary Requests</h3>
              <p className="text-sm text-gray-500">{filtered.length} record(s)</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-900 font-medium">No requests found</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const totals = safeJson<Record<string, number>>(r.totals_by_currency) ?? (r.totals_by_currency || null);
                const st = String(r.status || '').toLowerCase();
                const left =
                  st === 'approved'
                    ? 'border-l-green-400'
                    : st === 'rejected'
                      ? 'border-l-red-400'
                      : st === 'submitted' || st === 'pending'
                        ? 'border-l-yellow-400'
                        : 'border-l-gray-300';

                return (
                  <div key={r.id} className={`p-5 hover:bg-gray-50 border-l-4 ${left}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
                            <Hash className="h-4 w-4 text-gray-400" />
                            {r.request_no || `PR-${r.id.slice(0, 8)}`}
                          </span>
                          <span className={badge(String(r.status || ''))}>{String(r.status || '—').toUpperCase()}</span>
                        </div>

                        <div className="mt-1 text-gray-900 font-medium truncate">{r.title || 'Untitled'}</div>

                        <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {r.project_name || 'No project'}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4 text-gray-400" />
                            {fmtDate(r.activity_start)} → {fmtDate(r.activity_end)}
                          </span>

                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {r.location || 'No location'}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
                          <span>
                            <span className="text-gray-500">Totals:</span>{' '}
                            <span className="font-medium">{formatCurrencyLine(totals)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* ✅ Open goes to SR detail (snapshot) */}
                        <button
                          onClick={() => navigate(`/procurement/summary/${r.id}`)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                        >
                          <Eye className="h-4 w-4" />
                          Open
                        </button>

                        {canEdit(r) && r.linked_draft_id && (
                          <button
                            onClick={() => navigate(`/procurement/activity-plans/${r.linked_draft_id}/edit`)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                        )}

                        {canDelete(r) && (
                          <button
                            onClick={() => handleDelete(r)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-sm text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
