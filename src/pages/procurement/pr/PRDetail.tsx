import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Hash,
  Building2,
  CalendarDays,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Send,
  Printer,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';
import { useAuthStore } from '../../../store/authStore';

type ProcDoc = {
  id: string;
  doc_no: string | null;
  doc_type: string;
  status: string | null;
  title?: string | null;
  subtitle?: string | null;
  project_name?: string | null;
  location?: string | null;
  request_date?: string | null;
  needed_by?: string | null;
  payload?: any;
  requested_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source_summary_request_id?: string | null;
};

type ProcLine = {
  id: string;
  doc_id: string;
  line_no: number;
  description: string;
  qty: string | number;
  unit: string | null;
  unit_price: string | number;
  tax_rate: string | number;
  currency: string | null;
  line_subtotal: string | number;
  line_tax: string | number;
  line_total: string | number;
  meta: any;
  created_at: string;
  updated_at: string;
};

type Employee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  position: string | null;
  department: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
};

type ApprovalRequest = {
  id: string;
  status: string | null;
  created_at: string;
  requester_id: string | null;
  workflow_id: string | null;
  page_id?: string | null;
  page_name?: string | null;
  request_data?: any;
};

type ApprovalAction = {
  id: string;
  request_id: string;
  approver_id: string;
  action: string | null; // approved/rejected/pending
  comment: string | null;
  created_at: string;
  updated_at: string;
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
  try {
    const dt = new Date(d);
    // if parsing fails, show raw
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toISOString().slice(0, 10);
  } catch {
    return d;
  }
}

function money(n: any, maxFraction = 2) {
  const v = Number(n || 0);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFraction }).format(v);
}

function statusBadge(s: string) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
  const v = (s || '').toLowerCase();
  if (v === 'draft') return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  if (v === 'submitted' || v === 'pending') return `${base} bg-yellow-50 text-yellow-800 border-yellow-200`;
  if (v === 'approved') return `${base} bg-green-50 text-green-800 border-green-200`;
  if (v === 'rejected') return `${base} bg-red-50 text-red-700 border-red-200`;
  if (v === 'locked') return `${base} bg-slate-50 text-slate-700 border-slate-200`;
  return `${base} bg-gray-50 text-gray-700 border-gray-200`;
}

function actionPill(a: string) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
  const v = (a || '').toLowerCase();
  if (v === 'approved') return `${base} bg-green-50 text-green-800 border-green-200`;
  if (v === 'rejected') return `${base} bg-red-50 text-red-700 border-red-200`;
  if (v === 'pending') return `${base} bg-yellow-50 text-yellow-800 border-yellow-200`;
  return `${base} bg-gray-50 text-gray-700 border-gray-200`;
}

export default function PRDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<ProcDoc | null>(null);
  const [lines, setLines] = useState<ProcLine[]>([]);
  const [requester, setRequester] = useState<Employee | null>(null);
  const [approvalReq, setApprovalReq] = useState<ApprovalRequest | null>(null);
  const [approvalActions, setApprovalActions] = useState<ApprovalAction[]>([]);
  const [approverEmployees, setApproverEmployees] = useState<Record<string, Employee>>({});
  const [error, setError] = useState<string | null>(null);

  // line editor
  const [showLineModal, setShowLineModal] = useState(false);
  const [editingLine, setEditingLine] = useState<ProcLine | null>(null);
  const [lineForm, setLineForm] = useState({
    description: '',
    unit: '',
    qty: '1',
    unit_price: '0',
    tax_rate: '0',
    currency: 'USD',
  });

  const payload = useMemo(() => safeJson<any>(doc?.payload) || (doc?.payload ?? null), [doc]);
  const meta = useMemo(() => safeJson<any>(undefined) || (undefined ?? null), [doc]);

  const header = useMemo(() => {
    // Support multiple shapes (payload/header, payload itself, meta)
    const h = payload?.header || payload || {};
    const m = meta || {};
    return {
      title: doc?.title || h?.title || m?.title || 'Purchase Request',
      subtitle: doc?.subtitle || h?.subtitle || m?.subtitle || null,
      project_name: doc?.project_name || h?.project?.name || h?.project_name || m?.project_name || null,
      location: doc?.location || h?.location || m?.location || null,
      request_date: doc?.request_date || h?.request_date || m?.request_date || doc?.created_at || null,
      needed_by: doc?.needed_by || h?.needed_by || m?.needed_by || null,
      requester_job: h?.requested_by?.position || m?.requester_position || null,
    };
  }, [doc, payload, meta]);

  const totals = useMemo(() => {
    const byCurrency: Record<string, { subtotal: number; tax: number; total: number }> = {};
    for (const l of lines) {
      const cur = (l.currency || 'USD').toUpperCase();
      const subtotal = Number(l.line_subtotal ?? 0);
      const tax = Number(l.line_tax ?? 0);
      const total = Number(l.line_total ?? 0);
      if (!byCurrency[cur]) byCurrency[cur] = { subtotal: 0, tax: 0, total: 0 };
      byCurrency[cur].subtotal += subtotal;
      byCurrency[cur].tax += tax;
      byCurrency[cur].total += total;
    }
    return byCurrency;
  }, [lines]);

  const canEdit = useMemo(() => {
    const st = String(doc?.status || '').toLowerCase();
    const isOwner = !!user?.id && !!doc?.requested_by_user_id && user.id === doc.requested_by_user_id;
    const isAdmin = !!user?.user_metadata?.is_admin;
    // allow admin edit too
    return (isOwner || isAdmin) && (st === 'draft' || st === 'rejected');
  }, [doc, user]);

  const canSubmit = useMemo(() => {
    const st = String(doc?.status || '').toLowerCase();
    return canEdit && st === 'draft';
  }, [doc, canEdit]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!id) throw new Error('Missing PR id');

      // PR doc
      const { data: d1, error: e1 } = await supabase
        .from('proc_docs')
        // NOTE: نخلي select على أعمدة مضمونة لتجنب 42703 اذا سكيمة proc_docs ما بيها أعمدة إضافية
        // تفاصيل العنوان/المشروع/التواريخ نخليها داخل payload/meta.
        .select('id,doc_no,doc_type,status,payload,source_summary_request_id,created_at,updated_at')
        .eq('id', id)
        .single();
      if (e1) throw e1;
      setDoc(d1 as ProcDoc);

      // lines
      const { data: l1, error: le } = await supabase
        .from('proc_doc_lines')
        .select('id,doc_id,line_no,description,qty,unit,unit_price,tax_rate,currency,line_subtotal,line_tax,line_total,meta,created_at,updated_at')
        .eq('doc_id', id)
        .order('line_no', { ascending: true });
      if (le) throw le;
      setLines((l1 || []) as ProcLine[]);

      // requester employee (best effort)
      const payload = safeJson<any>((d1 as any)?.payload) || (d1 as any)?.payload || null;
      const requesterId = payload?.header?.requested_by?.user_id || null;
      if (requesterId) {
        const { data: emp, error: ee } = await supabase
          .from('employees')
          .select('id,first_name,last_name,email,position,department,profile_image_url,avatar_url')
          .eq('id', requesterId)
          .maybeSingle();
        if (!ee) setRequester((emp as any) || null);
      } else {
        setRequester(null);
      }

      // approval request (best effort, supports multiple request_data key names)
      const tryKeys = async () => {
        // Prefer exact json key match if exists
        const keys = ['proc_doc_id', 'doc_id', 'pr_id', 'purchase_request_id'];
        for (const k of keys) {
          const { data, error } = await supabase
            .from('approval_requests')
            .select('id,status,created_at,requester_id,workflow_id,page_id,page_name,request_data')
            .eq(`request_data->>${k}`, id)
            .order('created_at', { ascending: false })
            .limit(1);
          if (!error && data && data.length) return data[0] as ApprovalRequest;
        }

        // fallback: match by requester + contains doc_no/id in JSON string
        const { data, error } = await supabase
          .from('approval_requests')
          .select('id,status,created_at,requester_id,workflow_id,page_id,page_name,request_data')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) return null;

        const docNo = String((d1 as any)?.doc_no || '').trim();
        const match = (data || []).find((r: any) => {
          const blob = JSON.stringify(r.request_data || {});
          return blob.includes(id) || (!!docNo && blob.includes(docNo));
        });
        return (match as ApprovalRequest) || null;
      };

      const ar = await tryKeys();
      setApprovalReq(ar);

      if (ar?.id) {
        const { data: acts, error: ae } = await supabase
          .from('approval_actions')
          .select('id,request_id,approver_id,action,comment,created_at,updated_at')
          .eq('request_id', ar.id)
          .order('created_at', { ascending: true });
        if (!ae) {
          const a = (acts || []) as ApprovalAction[];
          setApprovalActions(a);

          const ids = Array.from(new Set(a.map((x) => x.approver_id).filter(Boolean)));
          if (ids.length) {
            const { data: emps, error: emErr } = await supabase
              .from('employees')
              .select('id,first_name,last_name,email,position,department,profile_image_url,avatar_url')
              .in('id', ids);
            if (!emErr && emps) {
              const map: Record<string, Employee> = {};
              for (const e of emps as any[]) map[e.id] = e;
              setApproverEmployees(map);
            }
          }
        }
      } else {
        setApprovalActions([]);
        setApproverEmployees({});
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load PR');
      setDoc(null);
      setLines([]);
      setRequester(null);
      setApprovalReq(null);
      setApprovalActions([]);
      setApproverEmployees({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openNewLine = () => {
    setEditingLine(null);
    setLineForm({
      description: '',
      unit: '',
      qty: '1',
      unit_price: '0',
      tax_rate: '0',
      currency: 'USD',
    });
    setShowLineModal(true);
  };

  const openEditLine = (l: ProcLine) => {
    setEditingLine(l);
    setLineForm({
      description: l.description || '',
      unit: l.unit || '',
      qty: String(l.qty ?? ''),
      unit_price: String(l.unit_price ?? ''),
      tax_rate: String(l.tax_rate ?? ''),
      currency: (l.currency || 'USD').toUpperCase(),
    });
    setShowLineModal(true);
  };

  const saveLine = async () => {
    if (!doc) return;
    const description = lineForm.description.trim();
    if (!description) {
      setError('Item description is required.');
      return;
    }
    try {
      setError(null);
      const payload = {
        description,
        unit: lineForm.unit.trim() || null,
        qty: Number(lineForm.qty || 0) || 0,
        unit_price: Number(lineForm.unit_price || 0) || 0,
        tax_rate: Number(lineForm.tax_rate || 0) || 0,
        currency: (lineForm.currency || '').trim() || null,
      };

      if (editingLine) {
        const { error: ue } = await supabase
          .from('proc_doc_lines')
          .update(payload)
          .eq('id', editingLine.id);
        if (ue) throw ue;
      } else {
        const nextNo = (lines?.[lines.length - 1]?.line_no || 0) + 1;
        const { error: ie } = await supabase.from('proc_doc_lines').insert({ doc_id: doc.id, line_no: nextNo, ...payload });
        if (ie) throw ie;
      }

      setShowLineModal(false);
      setEditingLine(null);
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to save line');
    }
  };

  const deleteLine = async (l: ProcLine) => {
    if (!canEdit) return;
    if (!confirm('Delete this item line?')) return;
    try {
      setError(null);
      const { error: de } = await supabase.from('proc_doc_lines').delete().eq('id', l.id);
      if (de) throw de;
      await fetchAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete line');
    }
  };

  const submitForApproval = async () => {
    if (!doc) return;
    if (!confirm('Submit this PR for approval?')) return;
    try {
      setError(null);

      // Try RPCs in order (different deployments may have different naming)
      const attempts: Array<{ fn: string; args: any }> = [
        { fn: 'submit_pr_for_approval', args: { p_pr_id: doc.id } },
        { fn: 'submit_pr_for_approval', args: { pr_id: doc.id } },
        { fn: 'proc_submit_doc', args: { p_doc_id: doc.id } },
        { fn: 'proc_submit', args: { p_doc_id: doc.id } },
        { fn: 'proc_submit', args: { doc_id: doc.id } },
      ];

      let ok = false;
      for (const a of attempts) {
        // eslint-disable-next-line no-await-in-loop
        const { error: re } = await supabase.rpc(a.fn as any, a.args as any);
        if (!re) {
          ok = true;
          break;
        }
      }

      // Fallback: at least mark submitted
      if (!ok) {
        const { error: ue } = await supabase.from('proc_docs').update({ status: 'submitted' }).eq('id', doc.id);
        if (ue) throw ue;
      }

      await fetchAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to submit');
    }
  };

  const printNow = () => {
    // CSS hooks: hide interactive UI
    window.print();
  };

  const requesterName = useMemo(() => {
    if (!requester) return user?.email || '—';
    const n = `${requester.first_name || ''} ${requester.last_name || ''}`.trim();
    return n || requester.email || '—';
  }, [requester, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-700" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-5xl mx-auto py-10 px-4">
          <button onClick={() => navigate('/procurement/pr')} className="text-sm text-gray-700 underline" type="button">
            Back to list
          </button>
          <div className="mt-4 rounded-md border px-4 py-3 bg-red-50 border-red-200 text-red-700">{error || 'Not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print\:shadow-none { box-shadow: none !important; }
          .print\:border-none { border: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <nav className="bg-white shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => navigate('/procurement/pr')} className="flex items-center text-gray-600 hover:text-gray-900 mr-6" type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Purchase Request</h1>
                <p className="text-xs text-gray-500">PR document (header + items + approvals)</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={fetchAll}
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md no-print">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Header card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
                  <Hash className="h-4 w-4 text-gray-400" />
                  {doc.doc_no || `PR-${doc.id.slice(0, 8)}`}
                </span>
                <span className={statusBadge(String(doc.status || ''))}>{String(doc.status || '—').toUpperCase()}</span>
                {doc.source_summary_request_id ? (
                  <span className="text-xs text-gray-500">From SR: {doc.source_summary_request_id.slice(0, 8)}</span>
                ) : null}
              </div>

              <div className="mt-1 text-gray-900 font-semibold text-lg truncate">{header.title}</div>
              {header.subtitle ? <div className="mt-1 text-sm text-gray-600">{header.subtitle}</div> : null}

              <div className="mt-3 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  {header.project_name || 'No project'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {header.location || 'No location'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  Request: {fmtDate(header.request_date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-4 w-4 text-gray-400" />
                  Needed By: {fmtDate(header.needed_by)}
                </span>
              </div>

              <div className="mt-3 text-sm text-gray-700">
                <span className="text-gray-500">Requested by:</span>{' '}
                <span className="font-medium">{requesterName}</span>
                {requester?.position ? <span className="text-gray-500"> • {requester.position}</span> : header.requester_job ? <span className="text-gray-500"> • {header.requester_job}</span> : null}
              </div>
            </div>

            <div className="flex items-center gap-2 no-print">
              {canSubmit ? (
                <button
                  onClick={submitForApproval}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                  type="button"
                >
                  <Send className="h-4 w-4" />
                  Submit
                </button>
              ) : null}

              <button
                onClick={printNow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                type="button"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print:shadow-none">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Items</div>
            {canEdit ? (
              <button
                onClick={openNewLine}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 no-print"
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-600">No items yet.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">#</th>
                    <th className="px-5 py-3 text-left font-medium">Item</th>
                    <th className="px-5 py-3 text-left font-medium">Unit</th>
                    <th className="px-5 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 text-right font-medium">Unit Price</th>
                    <th className="px-5 py-3 text-right font-medium">Tax</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 text-left font-medium">Currency</th>
                    <th className="px-5 py-3 text-right font-medium no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{l.line_no}</td>
                      <td className="px-5 py-3 text-gray-900 font-medium">{l.description}</td>
                      <td className="px-5 py-3 text-gray-700">{l.unit || '—'}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{money(l.qty, 2)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{money(l.unit_price, 2)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{money(Number(l.tax_rate || 0) * 100, 2)}%</td>
                      <td className="px-5 py-3 text-right text-gray-900 font-semibold">{money(l.line_total, 2)}</td>
                      <td className="px-5 py-3 text-gray-700">{(l.currency || 'USD').toUpperCase()}</td>
                      <td className="px-5 py-3 text-right no-print">
                        {canEdit ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openEditLine(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs text-gray-700 hover:bg-white"
                              type="button"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => deleteLine(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs text-red-700 hover:bg-red-50"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 print:shadow-none">
          <div className="text-sm font-semibold text-gray-900">Totals</div>
          <div className="mt-4 space-y-3">
            {Object.keys(totals).length === 0 ? (
              <div className="text-sm text-gray-600">—</div>
            ) : (
              Object.entries(totals)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cur, t]) => (
                  <div key={cur} className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">{cur}</div>
                    <div className="text-right">
                      <div className="text-gray-700">Subtotal: {money(t.subtotal, 2)}</div>
                      <div className="text-gray-700">Tax: {money(t.tax, 2)}</div>
                      <div className="text-gray-900 font-semibold">Grand Total: {money(t.total, 2)}</div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Approvals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print:shadow-none">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Approvals</div>
            {approvalReq ? (
              <div className="text-xs text-gray-500">
                Request: <span className="font-medium">{approvalReq.id.slice(0, 8)}</span> • Status:{' '}
                <span className="font-medium">{String(approvalReq.status || '—').toUpperCase()}</span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">No approval request found yet</div>
            )}
          </div>

          {approvalActions.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              {approvalReq ? 'No approval actions yet.' : 'Once submitted, approvers will appear here with live status.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {approvalActions.map((a, idx) => {
                const emp = approverEmployees[a.approver_id];
                const name = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || a.approver_id : a.approver_id;
                const pos = emp?.position || null;
                const status = String(a.action || 'pending').toLowerCase();
                return (
                  <div key={a.id} className="p-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900">Step {idx + 1}</div>
                        <span className={actionPill(status)}>{status.toUpperCase()}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-700">
                        <span className="font-medium">{name}</span>
                        {pos ? <span className="text-gray-500"> • {pos}</span> : null}
                      </div>
                      {a.comment ? <div className="mt-1 text-xs text-gray-600">Comment: {a.comment}</div> : null}
                    </div>

                    <div className="text-sm text-gray-500">
                      {status === 'approved' ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          {fmtDate(a.updated_at || a.created_at)}
                        </span>
                      ) : status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-red-600" />
                          {fmtDate(a.updated_at || a.created_at)}
                        </span>
                      ) : (
                        <span className="text-xs">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Signatures (print-friendly) */}
          <div className="p-5 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md border border-gray-200 p-4">
                <div className="text-xs text-gray-500">Requester</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{requesterName}</div>
                <div className="text-xs text-gray-600">{requester?.position || header.requester_job || '—'}</div>
                <div className="mt-8 border-t border-dashed border-gray-300 pt-2 text-xs text-gray-500">Signature</div>
              </div>
              <div className="rounded-md border border-gray-200 p-4">
                <div className="text-xs text-gray-500">Final Approver</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">
                  {(() => {
                    const last = approvalActions[approvalActions.length - 1];
                    if (!last) return '—';
                    const emp = approverEmployees[last.approver_id];
                    return emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email || '—' : '—';
                  })()}
                </div>
                <div className="text-xs text-gray-600">
                  {(() => {
                    const last = approvalActions[approvalActions.length - 1];
                    if (!last) return '—';
                    return approverEmployees[last.approver_id]?.position || '—';
                  })()}
                </div>
                <div className="mt-8 border-t border-dashed border-gray-300 pt-2 text-xs text-gray-500">Signature</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Line modal */}
      {showLineModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">{editingLine ? 'Edit Item' : 'Add Item'}</div>
              <button
                onClick={() => {
                  setShowLineModal(false);
                  setEditingLine(null);
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Item description</label>
                <input
                  value={lineForm.description}
                  onChange={(e) => setLineForm((s) => ({ ...s, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  placeholder="e.g., Laptop"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit</label>
                  <input
                    value={lineForm.unit}
                    onChange={(e) => setLineForm((s) => ({ ...s, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                    placeholder="e.g., pcs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Currency</label>
                  <input
                    value={lineForm.currency}
                    onChange={(e) => setLineForm((s) => ({ ...s, currency: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                    placeholder="USD"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Qty</label>
                  <input
                    value={lineForm.qty}
                    onChange={(e) => setLineForm((s) => ({ ...s, qty: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit price</label>
                  <input
                    value={lineForm.unit_price}
                    onChange={(e) => setLineForm((s) => ({ ...s, unit_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tax rate (0.05 = 5%)</label>
                  <input
                    value={lineForm.tax_rate}
                    onChange={(e) => setLineForm((s) => ({ ...s, tax_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowLineModal(false);
                  setEditingLine(null);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={saveLine}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
