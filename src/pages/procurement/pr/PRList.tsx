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
  Wand2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';
import { useAuthStore } from '../../../store/authStore';

type DocStatus = string;

type ProcDoc = {
  id: string;
  doc_no: string | null;
  doc_type: 'PR' | string;
  status: DocStatus | null;
  created_at: string;
  payload: any;
  source_summary_request_id: string | null;
};

type HeaderPayload = {
  title?: string | null;
  subtitle?: string | null;
  location?: string | null;
  request_date?: string | null;
  need_by_date?: string | null;
  project?: { id?: string; name?: string | null } | null;
  requested_by?: { name?: string | null; email?: string | null; user_id?: string | null; position?: string | null } | null;
};

type ProcPayload = {
  version?: number;
  header?: HeaderPayload;
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

export default function PRList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Minimal profile info (used for permission checks / UI labels)
  const [profile, setProfile] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProcDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | string>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('proc_docs')
        .select('id,doc_no,doc_type,status,created_at,payload,source_summary_request_id')
        .eq('doc_type', 'PR')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data || []) as ProcDoc[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load PR list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Load minimal profile fields needed for permissions.
    // (Prevents runtime crashes when `profile` was referenced but not defined.)
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,is_admin,department,position,department_id,position_id')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Failed to load profile:', error.message);
          setProfile(null);
          return;
        }
        setProfile(data);
      } catch (e: any) {
        console.warn('Failed to load profile:', e?.message || e);
        setProfile(null);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mapped = useMemo(() => {
    return rows.map((r) => {
      const payload = safeJson<ProcPayload>(r.payload) || (r.payload ?? {});
      const header = payload?.header || {};
      return {
        ...r,
        _payload: payload,
        _header: header,
      } as any;
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return mapped.filter((r: any) => {
      const header: HeaderPayload = r._header || {};
      const requesterName = (header?.requested_by?.name || header?.requested_by?.email || '').toLowerCase();
      const projectName = (header?.project?.name || '').toLowerCase();
      const loc = (header?.location || '').toLowerCase();
      const title = (header?.title || '').toLowerCase();
      const docNo = (r.doc_no || '').toLowerCase();

      const matchQ =
        !needle ||
        docNo.includes(needle) ||
        title.includes(needle) ||
        projectName.includes(needle) ||
        loc.includes(needle) ||
        requesterName.includes(needle);

      const st = String(r.status || '');
      const matchStatus = status === 'all' ? true : st === status;
      return matchQ && matchStatus;
    });
  }, [mapped, q, status]);

  // ✅ حسب متطلباتك: كل الموظفين يگدرون ينشؤون PR مستقل
  const canManualCreate = !!user?.id;

  const createPRFromSR = async () => {
    const srId = prompt('Paste SR Doc ID (from proc_docs where doc_type = SR):');
    if (!srId) return;

    try {
      setLoading(true);
      setError(null);

      // 1) Load SR
      const { data: srDoc, error: e1 } = await supabase
        .from('proc_docs')
        .select('id,doc_no,doc_type,status,payload')
        .eq('id', srId)
        .single();
      if (e1) throw e1;

      if (!srDoc || String(srDoc.doc_type).toUpperCase() !== 'SR') {
        throw new Error('This ID is not an SR doc');
      }

      const srPayload = safeJson<any>(srDoc.payload) || (srDoc.payload ?? {});
      const srHeader: any = srPayload?.header || {};

      // 2) Create PR doc (payload-only; no proc_docs.meta column in your schema)
      const prPayload = {
        version: 1,
        header: {
          title: srHeader?.title || 'Purchase Request',
          subtitle: srHeader?.subtitle || null,
          location: srHeader?.location || null,
          request_date: new Date().toISOString().slice(0, 10),
          need_by_date: srHeader?.need_by_date || null,
          project: srHeader?.project || null,
          requested_by: srHeader?.requested_by || {
            name: user?.email || 'Requester',
            email: user?.email || null,
            user_id: user?.id || null,
            position: user?.user_metadata?.position || null,
          },
          source: { from: 'SR', sr_id: srId, sr_no: srDoc.doc_no },
        },
      };

      const { data: prInserted, error: e2 } = await supabase
        .from('proc_docs')
        .insert({
          doc_type: 'PR',
          status: 'draft',
          source_summary_request_id: srId,
          payload: prPayload,
        })
        .select('id')
        .single();
      if (e2) throw e2;

      const prId = prInserted?.id;
      if (!prId) throw new Error('Failed to create PR');

      // 3) Copy lines from SR -> PR
      const { data: srLines, error: e3 } = await supabase
        .from('proc_doc_lines')
        .select('line_no,description,qty,unit,unit_price,tax_rate,currency,meta')
        .eq('doc_id', srId)
        .order('line_no', { ascending: true });
      if (e3) throw e3;

      if (srLines && srLines.length > 0) {
        const payloadLines = srLines.map((l: any, idx: number) => ({
          doc_id: prId,
          line_no: l.line_no ?? idx + 1,
          description: l.description,
          qty: l.qty ?? 1,
          unit: l.unit ?? null,
          unit_price: l.unit_price ?? 0,
          tax_rate: l.tax_rate ?? 0,
          currency: l.currency ?? null,
          meta: l.meta ?? {},
        }));

        const { error: e4 } = await supabase.from('proc_doc_lines').insert(payloadLines);
        if (e4) throw e4;
      }

      // 4) Navigate to PR details
      navigate(`/procurement/pr/${prId}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create PR from SR');
    } finally {
      setLoading(false);
    }
  };

  const createManualPR = async () => {
    if (!canManualCreate) return;

    try {
      setLoading(true);
      setError(null);

      const payload = {
        version: 1,
        header: {
          title: 'Purchase Request',
          request_date: new Date().toISOString().slice(0, 10),
          requested_by: {
            name: user?.email || 'Requester',
            email: user?.email || null,
            user_id: user?.id || null,
            position: user?.user_metadata?.position || null,
          },
        },
      };

      const { data, error } = await supabase
        .from('proc_docs')
        .insert({ doc_type: 'PR', status: 'draft', payload })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/procurement/pr/${data.id}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create PR');
    } finally {
      setLoading(false);
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
              <button onClick={() => navigate('/procurement')} className="flex items-center text-gray-600 hover:text-gray-900 mr-6" type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Purchase Requests (PR)</h1>
                <p className="text-xs text-gray-500">Create & track PRs (independent or derived from SR)</p>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search PR no, title, project, location, requester..."
                  className="w-full md:w-96 pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                />
              </div>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full md:w-56 px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <button onClick={fetchData} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50" type="button">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={createPRFromSR}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-700 text-white text-sm font-medium hover:bg-indigo-800"
                type="button"
              >
                <Wand2 className="h-4 w-4" />
                Create PR from SR
              </button>

              <button
                onClick={createManualPR}
                disabled={!canManualCreate}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium border ${
                  canManualCreate ? 'bg-gray-900 text-white hover:bg-gray-800 border-gray-900' : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                }`}
                type="button"
                title={canManualCreate ? 'Create a PR manually' : 'Only admins can create manual PRs'}
              >
                <Plus className="h-4 w-4" />
                New PR
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All PRs</h3>
              <p className="text-sm text-gray-500">{filtered.length} record(s)</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-900 font-medium">No PRs found</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((r: any) => {
                const header: HeaderPayload = r._header || {};
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
                            {r.doc_no || `PR-${r.id.slice(0, 8)}`}
                          </span>
                          <span className={badge(String(r.status || ''))}>{String(r.status || '—').toUpperCase()}</span>
                          {r.source_summary_request_id ? (
                            <span className="text-xs text-gray-500">Derived from SR</span>
                          ) : (
                            <span className="text-xs text-gray-500">Manual</span>
                          )}
                        </div>

                        <div className="mt-1 text-gray-900 font-medium truncate">{header?.title || 'Purchase Request'}</div>

                        <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {header?.project?.name || 'No project'}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4 text-gray-400" />
                            {fmtDate(header?.request_date)}
                          </span>

                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {header?.location || 'No location'}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Requested by: {header?.requested_by?.name || header?.requested_by?.email || '—'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/procurement/pr/${r.id}`)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                          type="button"
                        >
                          <Eye className="h-4 w-4" />
                          Open
                        </button>
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
