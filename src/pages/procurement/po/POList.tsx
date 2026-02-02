import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, AlertCircle, Hash, CalendarDays, Eye, Filter, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';

type Row = {
  id: string;
  doc_no: string | null;
  doc_date: string | null;
  status: string | null;
  title: string | null;
  payload: any;
  created_at: string;
};

type TabKey = 'pending' | 'drafts' | 'history';

function statusBadge(st: string) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
  const v = (st || '').toLowerCase();
  if (v === 'draft') return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  if (v === 'submitted' || v === 'in_review' || v === 'pending') return `${base} bg-yellow-50 text-yellow-800 border-yellow-200`;
  if (v === 'approved') return `${base} bg-green-50 text-green-800 border-green-200`;
  if (v === 'rejected') return `${base} bg-red-50 text-red-700 border-red-200`;
  if (v === 'cancelled' || v === 'closed') return `${base} bg-slate-50 text-slate-700 border-slate-200`;
  return `${base} bg-gray-50 text-gray-700 border-gray-200`;
}

function tabStatuses(tab: TabKey): string[] {
  if (tab === 'pending') return ['submitted', 'in_review'];
  if (tab === 'drafts') return ['draft', 'rejected'];
  return ['approved', 'cancelled', 'closed'];
}

function getLinked(payload: any) {
  const p = payload || {};
  return {
    srId: p.source_sr_id || p.sr_id || p.source_summary_id || null,
    srNo: p.source_sr_no || p.sr_no || null,
    prId: p.source_pr_id || p.pr_id || p.linked_pr_id || null,
    prNo: p.source_pr_no || p.pr_no || null,
  };
}

export default function POList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('pending');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(''); // optional

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);

      const statuses = tabStatuses(tab);

      let q = supabase
        .from('proc_docs')
        .select('id,doc_no,doc_date,status,title,payload,created_at')
        .eq('doc_type', 'PO')
        .in('status', statuses)
        .order('created_at', { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load POs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && String(r.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (!q) return true;
      const linked = getLinked(r.payload);
      return (
        String(r.doc_no || '').toLowerCase().includes(q) ||
        String(r.title || '').toLowerCase().includes(q) ||
        String(linked.srNo || '').toLowerCase().includes(q) ||
        String(linked.prNo || '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('');
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
              <h1 className="text-lg font-bold text-gray-900">Purchase Orders (PO)</h1>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              <SettingsButton />
              <OptimizedImage />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Tabs + Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              {(
                [
                  { key: 'pending', label: 'Pending' },
                  { key: 'drafts', label: 'Drafts' },
                  { key: 'history', label: 'History' },
                ] as { key: TabKey; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    'px-4 py-2 text-sm font-medium ' +
                    (tab === t.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search PO / PR / SR..."
                  className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="relative">
                <Filter className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 rounded-lg border border-gray-300 text-sm w-full sm:w-44 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">All status</option>
                  <option value="draft">draft</option>
                  <option value="submitted">submitted</option>
                  <option value="in_review">in_review</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="cancelled">cancelled</option>
                  <option value="closed">closed</option>
                </select>
              </div>

              {(query || statusFilter) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}

              <button
                onClick={fetchRows}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
                type="button"
              >
                <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-100 text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">PO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Linked</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const linked = getLinked(r.payload);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-gray-400" />
                            <div className="text-sm font-medium text-gray-900">{r.doc_no || '—'}</div>
                          </div>
                          {r.title && <div className="text-xs text-gray-500 mt-0.5">{r.title}</div>}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex flex-col gap-1">
                            <div>
                              <span className="text-xs text-gray-500">PR:</span>{' '}
                              <span className="font-medium">{linked.prNo || (linked.prId ? 'Linked' : '—')}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">SR:</span>{' '}
                              <span className="font-medium">{linked.srNo || (linked.srId ? 'Linked' : '—')}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-gray-400" />
                            {r.doc_date || '—'}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={statusBadge(String(r.status || ''))}>{String(r.status || '—')}</span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(`/procurement/po/${r.id}`)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
                            type="button"
                          >
                            <Eye className="h-4 w-4" />
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
