import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, RefreshCw, Hash, CalendarDays, ExternalLink, PackagePlus, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';
import { useAuthStore } from '../../../store/authStore';

type Row = {
  id: string;
  doc_no: string | null;
  doc_date: string | null;
  status: string | null;
  title: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
  requested_by_user_id?: string | null;
};

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

function getLinked(payload: any) {
  const p = payload || {};
  return {
    srId: p.source_sr_id || p.sr_id || p.source_summary_id || null,
    srNo: p.source_sr_no || p.sr_no || null,
    prId: p.source_pr_id || p.pr_id || p.linked_pr_id || null,
    prNo: p.source_pr_no || p.pr_no || null,
  };
}

export default function PODetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, isAdmin } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<Row | null>(null);
  const [creatingGrn, setCreatingGrn] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchOne = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!id) throw new Error('Missing id');

      const { data, error } = await supabase
        .from('proc_docs')
        .select('id,doc_no,doc_date,status,title,payload,created_at,updated_at,requested_by_user_id')
        .eq('id', id)
        .eq('doc_type', 'PO')
        .single();

      if (error) throw error;
      setRow(data as any);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load PO');
      setRow(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const linked = useMemo(() => getLinked(row?.payload), [row?.payload]);

  const canCreateGrn = useMemo(() => {
    const st = String(row?.status || '').toLowerCase();
    // GRN typically after approved PO; allow submitted too (depends on your process)
    return !!row && !!user?.id && (st === 'approved' || st === 'submitted');
  }, [row, user]);

  const canDelete = useMemo(() => {
    if (!row) return false;
    const st = String(row.status || '').toLowerCase();
    if (!['draft', 'rejected'].includes(st)) return false;
    return isAdmin || (!!user?.id && row.requested_by_user_id === user.id);
  }, [row, user, isAdmin]);

  const createGrn = async () => {
    if (!row || !user?.id) return;
    try {
      setCreatingGrn(true);
      setError(null);

      // 1) Prefer RPC if you created it
      const rpc = await supabase.rpc('create_grn_from_po', { p_po_id: row.id } as any);
      if (!rpc.error && rpc.data) {
        navigate(`/procurement/grn/${rpc.data}`);
        return;
      }

      // If function doesn't exist, fallback to direct insert
      const payload = row.payload || {};
      const insertPayload = {
        source_po_id: row.id,
        source_po_no: row.doc_no,
        source_sr_id: payload.source_sr_id || payload.sr_id || null,
        source_sr_no: payload.source_sr_no || payload.sr_no || null,
      };

      const { data, error } = await supabase
        .from('proc_docs')
        .insert({
          doc_type: 'GRN',
          status: 'draft',
          doc_date: new Date().toISOString().slice(0, 10),
          requested_by_user_id: user.id,
          title: `GRN for ${row.doc_no || row.id}`,
          payload: insertPayload,
        })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/procurement/grn/${(data as any).id}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create GRN');
    } finally {
      setCreatingGrn(false);
    }
  };

  const deleteDraft = async () => {
    if (!row) return;
    try {
      setDeleting(true);
      setError(null);

      const { error } = await supabase
        .from('proc_docs')
        .delete()
        .eq('id', row.id)
        .eq('doc_type', 'PO');

      if (error) throw error;
      navigate('/procurement/po');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete PO');
    } finally {
      setDeleting(false);
    }
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
          <button onClick={() => navigate('/procurement/po')} className="text-sm text-gray-700 underline" type="button">
            Back to list
          </button>
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="text-gray-900 font-semibold">Not found</div>
            {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/procurement/po')}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="h-6 w-px bg-gray-200" />
              <h1 className="text-lg font-bold text-gray-900">PO Details</h1>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              <SettingsButton />
              <OptimizedImage />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-gray-400" />
                <div className="text-xl font-bold text-gray-900">{row.doc_no || '—'}</div>
                <span className={statusBadge(String(row.status || ''))}>{String(row.status || '—')}</span>
              </div>

              <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-2">
                <div className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  <span>{row.doc_date || '—'}</span>
                </div>

                {linked.prId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/procurement/pr/${linked.prId}`)}
                    className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    PR: {linked.prNo || linked.prId}
                  </button>
                )}

                {linked.srId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/procurement/summary/${linked.srId}`)}
                    className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    SR: {linked.srNo || linked.srId}
                  </button>
                )}
              </div>

              {row.title && <div className="mt-3 text-sm text-gray-700">{row.title}</div>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchOne}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50"
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>

              <button
                onClick={createGrn}
                disabled={!canCreateGrn || creatingGrn}
                className={
                  'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ' +
                  (canCreateGrn && !creatingGrn
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed')
                }
                type="button"
              >
                <PackagePlus className="h-4 w-4" />
                {creatingGrn ? 'Creating GRN...' : 'Create GRN'}
              </button>

              {canDelete && (
                <button
                  onClick={deleteDraft}
                  disabled={deleting}
                  className={
                    'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border ' +
                    (deleting ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-white text-red-700 border-red-200 hover:bg-red-50')
                  }
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete draft'}
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="text-sm font-semibold text-gray-900">Payload</div>
            <pre className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto">
              {JSON.stringify(row.payload || {}, null, 2)}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
