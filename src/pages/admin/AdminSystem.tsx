import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Save,
  Image as ImageIcon,
  PenLine,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shield,
  LayoutGrid,
  Search,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type PdfBrandingSettings = {
  company_name: string;

  logo_url: string | null;
  logo_path: string | null; // ✅ for deletion
  logo_x: number;
  logo_y: number;
  logo_w: number;

  pdf_footer_text: string;
  voucher_prefix: string;

  signer_name: string;
  signer_title: string;

  signature_url: string | null;
  signature_path: string | null; // ✅ for deletion
  signature_x: number;
  signature_y: number;
  signature_w: number;
};

const DEFAULT_SETTINGS: PdfBrandingSettings = {
  company_name: 'Company Payroll System',

  logo_url: null,
  logo_path: null,
  logo_x: 48,
  logo_y: 40,
  logo_w: 90,

  pdf_footer_text: 'This document is system-generated. If you have questions, contact HR.',
  voucher_prefix: 'PAY',

  signer_name: 'HR',
  signer_title: 'Human Resources',

  signature_url: null,
  signature_path: null,
  signature_x: 420,
  signature_y: 470,
  signature_w: 140,
};

function safeInt(v: any, fallback: number) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}
function safeStr(v: any, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

/**
 * ✅ Signed Upload (token usage correct)
 * bucket: system-assets
 */
async function uploadToSystemAssets(file: File, folder: 'logos' | 'signatures') {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  if (!sess?.session) throw new Error('No session found. Please login again.');

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const filePath = `${folder}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  // @ts-ignore
  const { data: signed, error: signedErr } = await supabase.storage
    .from('system-assets')
    // @ts-ignore
    .createSignedUploadUrl(filePath);

  if (signedErr) throw signedErr;
  if (!signed?.token) throw new Error('Signed upload token missing');

  // @ts-ignore
  const { error: upErr } = await supabase.storage
    .from('system-assets')
    // ✅ IMPORTANT: pass token (not signedUrl)
    // @ts-ignore
    .uploadToSignedUrl(filePath, signed.token, file);

  if (upErr) throw upErr;

  const { data } = supabase.storage.from('system-assets').getPublicUrl(filePath);
  return { publicUrl: data.publicUrl, path: filePath };
}

/** ───────────────────────────────
 * Access Control Models
 * profiles columns: first_name, last_name, email
 * page_permissions: user_id, page_key, can_view
 * ─────────────────────────────── */
type Employee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type PageDef = {
  key: string;
  label: string;
  path: string;
  group: 'Admin' | 'Procurement' | 'HR' | 'Finance' | 'General';
};

const PAGES: PageDef[] = [
  // Admin
  { key: 'admin.settings', label: 'Admin Settings', path: '/admin/settings', group: 'Admin' },
  { key: 'admin.system', label: 'System (PDF Branding)', path: '/admin/settings/system', group: 'Admin' },
  { key: 'admin.users', label: 'Users & Roles', path: '/admin/users', group: 'Admin' },

  // Procurement (عدّلها حسب نظامك)
  { key: 'proc.dashboard', label: 'Procurement Dashboard', path: '/procurement', group: 'Procurement' },
  { key: 'proc.approvals', label: 'Approvals', path: '/procurement/approvals', group: 'Procurement' },
  { key: 'proc.activity_plans', label: 'Activity Plans', path: '/procurement/activity-plans', group: 'Procurement' },
  { key: 'proc.summary_requests', label: 'Summary Requests (SR)', path: '/procurement/summary', group: 'Procurement' },
  { key: 'proc.purchase_requests', label: 'Purchase Requests (PR)', path: '/procurement/pr', group: 'Procurement' },

  // HR
  { key: 'hr.timesheets', label: 'Timesheets', path: '/timesheets', group: 'HR' },
  { key: 'hr.payslips', label: 'Payslips', path: '/payroll/payslips', group: 'HR' },

  // Finance
  { key: 'fin.vouchers', label: 'Vouchers', path: '/finance/vouchers', group: 'Finance' },

  // General
  { key: 'general.profile', label: 'My Profile', path: '/profile', group: 'General' },
];

function groupPages(pages: PageDef[]) {
  return pages.reduce<Record<string, PageDef[]>>((acc, p) => {
    acc[p.group] = acc[p.group] || [];
    acc[p.group].push(p);
    return acc;
  }, {});
}

export default function AdminSystem() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'system' | 'access'>('system');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const [settings, setSettings] = useState<PdfBrandingSettings>(DEFAULT_SETTINGS);

  // Access control
  const [empLoading, setEmpLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empQuery, setEmpQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const showError = (msg: string) => setToast({ type: 'err', msg });
  const showOk = (msg: string) => setToast({ type: 'ok', msg });

  /** ───────── System Settings ───────── */
  const loadSettings = async () => {
    setLoading(true);
    setToast(null);

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'pdf_branding')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data?.setting_value) {
        setSettings(DEFAULT_SETTINGS);
      } else {
        const raw = data.setting_value;

        let parsed: any = {};
        try {
          parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          parsed = {};
        }

        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,

          company_name: safeStr(parsed.company_name, DEFAULT_SETTINGS.company_name),

          logo_url: parsed.logo_url ?? null,
          logo_path: parsed.logo_path ?? null,
          logo_x: safeInt(parsed.logo_x, DEFAULT_SETTINGS.logo_x),
          logo_y: safeInt(parsed.logo_y, DEFAULT_SETTINGS.logo_y),
          logo_w: safeInt(parsed.logo_w, DEFAULT_SETTINGS.logo_w),

          pdf_footer_text: safeStr(parsed.pdf_footer_text, DEFAULT_SETTINGS.pdf_footer_text),
          voucher_prefix: safeStr(parsed.voucher_prefix, DEFAULT_SETTINGS.voucher_prefix),

          signer_name: safeStr(parsed.signer_name, DEFAULT_SETTINGS.signer_name),
          signer_title: safeStr(parsed.signer_title, DEFAULT_SETTINGS.signer_title),

          signature_url: parsed.signature_url ?? null,
          signature_path: parsed.signature_path ?? null,
          signature_x: safeInt(parsed.signature_x, DEFAULT_SETTINGS.signature_x),
          signature_y: safeInt(parsed.signature_y, DEFAULT_SETTINGS.signature_y),
          signature_w: safeInt(parsed.signature_w, DEFAULT_SETTINGS.signature_w),
        });
      }
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setToast(null);

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { setting_key: 'pdf_branding', setting_value: JSON.stringify(settings) },
          { onConflict: 'setting_key' }
        );

      if (error) throw error;

      showOk('Settings saved successfully');
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const onUploadLogo = async (file: File) => {
    setToast(null);
    try {
      const res = await uploadToSystemAssets(file, 'logos');
      setSettings((s) => ({ ...s, logo_url: res.publicUrl, logo_path: res.path }));
      showOk('Logo uploaded');
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Logo upload failed');
    }
  };

  const onUploadSignature = async (file: File) => {
    setToast(null);
    try {
      const res = await uploadToSystemAssets(file, 'signatures');
      setSettings((s) => ({ ...s, signature_url: res.publicUrl, signature_path: res.path }));
      showOk('Signature uploaded');
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Signature upload failed');
    }
  };

  const removeLogo = async () => {
    setToast(null);
    try {
      if (settings.logo_path) {
        const { error } = await supabase.storage.from('system-assets').remove([settings.logo_path]);
        if (error) throw error;
      }
      setSettings((s) => ({ ...s, logo_url: null, logo_path: null }));
      showOk('Logo removed');
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to remove logo');
    }
  };

  const removeSignature = async () => {
    setToast(null);
    try {
      if (settings.signature_path) {
        const { error } = await supabase.storage
          .from('system-assets')
          .remove([settings.signature_path]);
        if (error) throw error;
      }
      setSettings((s) => ({ ...s, signature_url: null, signature_path: null }));
      showOk('Signature removed');
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to remove signature');
    }
  };

  /** ───────── Access Control ───────── */
  const fullName = (e: Employee) =>
    [e.first_name, e.last_name].filter(Boolean).join(' ') || e.email || e.id;

  const loadEmployees = async () => {
    setEmpLoading(true);
    setToast(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name', { ascending: true })
        .order('last_name', { ascending: true });

      if (error) throw error;
      setEmployees((data as Employee[]) || []);
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to load employees');
    } finally {
      setEmpLoading(false);
    }
  };

  const loadEmployeePermissions = async (userId: string) => {
    setPermLoading(true);
    setToast(null);

    try {
      const { data, error } = await supabase
        .from('page_permissions')
        .select('page_key, can_view')
        .eq('user_id', userId);

      if (error) throw error;

      const map: Record<string, boolean> = {};
      for (const p of PAGES) map[p.key] = false; // default: not allowed
      for (const row of (data || []) as any[]) map[row.page_key] = !!row.can_view;

      setPermissions(map);
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to load permissions');
    } finally {
      setPermLoading(false);
    }
  };

  const saveEmployeePermissions = async () => {
    if (!selectedEmpId) return;

    setPermSaving(true);
    setToast(null);

    try {
      const allowed = Object.entries(permissions)
        .filter(([, can]) => can)
        .map(([page_key]) => ({ user_id: selectedEmpId, page_key, can_view: true }));

      const { error: delErr } = await supabase.from('page_permissions').delete().eq('user_id', selectedEmpId);
      if (delErr) throw delErr;

      if (allowed.length > 0) {
        const { error: insErr } = await supabase.from('page_permissions').insert(allowed);
        if (insErr) throw insErr;
      }

      showOk('Permissions saved');
    } catch (e: any) {
      console.error(e);
      showError(e?.message || 'Failed to save permissions');
    } finally {
      setPermSaving(false);
    }
  };

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const p of PAGES) next[p.key] = value;
    setPermissions(next);
  };

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    if (!q) return employees;

    return employees.filter((e) => {
      const n = `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase();
      const em = (e.email || '').toLowerCase();
      return n.includes(q) || em.includes(q);
    });
  }, [employees, empQuery]);

  /** initial load */
  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'access') loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (selectedEmpId) loadEmployeePermissions(selectedEmpId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmpId]);

  /** preview styles */
  const logoPreviewStyle = useMemo(
    () => ({ left: settings.logo_x, top: settings.logo_y, width: settings.logo_w }),
    [settings.logo_x, settings.logo_y, settings.logo_w]
  );

  const signaturePreviewStyle = useMemo(
    () => ({ left: settings.signature_x, top: settings.signature_y, width: settings.signature_w }),
    [settings.signature_x, settings.signature_y, settings.signature_w]
  );

  const pagesByGroup = useMemo(() => groupPages(PAGES), []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Admin Settings
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (activeTab === 'system') loadSettings();
                if (activeTab === 'access') loadEmployees();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              disabled={loading || empLoading || permLoading}
            >
              <RefreshCw className={`h-4 w-4 ${(loading || empLoading || permLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {activeTab === 'system' ? (
              <button
                onClick={saveSettings}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                disabled={saving || loading}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            ) : (
              <button
                onClick={saveEmployeePermissions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                disabled={permSaving || permLoading || !selectedEmpId}
              >
                <Save className="h-4 w-4" />
                {permSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
          {/* Header + Tabs */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Admin Control Panel</h2>
                <p className="mt-1 text-sm text-gray-500">
                  System branding + access control (who can view which pages)
                </p>
              </div>

              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('system')}
                  className={`px-3 py-2 rounded-lg text-sm inline-flex items-center gap-2 ${
                    activeTab === 'system'
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  System
                </button>
                <button
                  onClick={() => setActiveTab('access')}
                  className={`px-3 py-2 rounded-lg text-sm inline-flex items-center gap-2 ${
                    activeTab === 'access'
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  Access Control
                </button>
              </div>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className={`p-4 ${toast.type === 'ok' ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-start gap-3">
                {toast.type === 'ok' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <p className={`text-sm ${toast.type === 'ok' ? 'text-green-800' : 'text-red-800'}`}>
                  {toast.msg}
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          {activeTab === 'system' ? (
            loading ? (
              <div className="p-10 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: settings */}
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-3">General</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Company Name</label>
                        <input
                          value={settings.company_name}
                          onChange={(e) => setSettings((s) => ({ ...s, company_name: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700">Voucher Prefix</label>
                        <input
                          value={settings.voucher_prefix}
                          onChange={(e) => setSettings((s) => ({ ...s, voucher_prefix: e.target.value }))}
                          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Logo */}
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                        Company Logo
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={removeLogo}
                          disabled={!settings.logo_url}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm disabled:opacity-60"
                        >
                          Remove
                        </button>

                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 cursor-pointer text-sm">
                          <Upload className="h-4 w-4" />
                          Upload
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onUploadLogo(f);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">X</label>
                        <input
                          type="number"
                          value={settings.logo_x}
                          onChange={(e) => setSettings((s) => ({ ...s, logo_x: safeInt(e.target.value, 48) }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Y</label>
                        <input
                          type="number"
                          value={settings.logo_y}
                          onChange={(e) => setSettings((s) => ({ ...s, logo_y: safeInt(e.target.value, 40) }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Width</label>
                        <input
                          type="number"
                          value={settings.logo_w}
                          onChange={(e) => setSettings((s) => ({ ...s, logo_w: safeInt(e.target.value, 90) }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 break-all">
                      {settings.logo_url || 'No logo uploaded'}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">PDF Footer Text</p>
                    <textarea
                      value={settings.pdf_footer_text}
                      onChange={(e) => setSettings((s) => ({ ...s, pdf_footer_text: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[90px]"
                    />
                  </div>

                  {/* Signature */}
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <PenLine className="h-4 w-4 text-gray-400" />
                        Signature (Text + Image)
                      </p>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={removeSignature}
                          disabled={!settings.signature_url}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm disabled:opacity-60"
                        >
                          Remove
                        </button>

                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 cursor-pointer text-sm">
                          <Upload className="h-4 w-4" />
                          Upload Signature
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onUploadSignature(f);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Signer Name</label>
                        <input
                          value={settings.signer_name}
                          onChange={(e) => setSettings((s) => ({ ...s, signer_name: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Signer Title</label>
                        <input
                          value={settings.signer_title}
                          onChange={(e) => setSettings((s) => ({ ...s, signer_title: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">X</label>
                        <input
                          type="number"
                          value={settings.signature_x}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              signature_x: safeInt(e.target.value, DEFAULT_SETTINGS.signature_x),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Y</label>
                        <input
                          type="number"
                          value={settings.signature_y}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              signature_y: safeInt(e.target.value, DEFAULT_SETTINGS.signature_y),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Width</label>
                        <input
                          type="number"
                          value={settings.signature_w}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              signature_w: safeInt(e.target.value, DEFAULT_SETTINGS.signature_w),
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 break-all">
                      {settings.signature_url || 'No signature uploaded'}
                    </div>
                  </div>
                </div>

                {/* Right: preview */}
                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">PDF Preview (Approx.)</p>

                  <div className="relative bg-gray-50 rounded-xl border border-gray-100 overflow-hidden h-[640px]">
                    <div className="absolute left-4 top-4 right-4">
                      <p className="text-xs text-gray-500">
                        {settings.company_name} • Voucher Prefix: {settings.voucher_prefix}
                      </p>
                    </div>

                    {settings.logo_url ? (
                      <img
                        src={settings.logo_url}
                        alt="logo"
                        className="absolute object-contain"
                        style={logoPreviewStyle as any}
                      />
                    ) : (
                      <div className="absolute left-10 top-14 text-xs text-gray-400">No logo</div>
                    )}

                    <div className="absolute left-8 right-8 top-44 bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-sm font-semibold text-gray-900">Payslip Table (Preview)</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div className="bg-gray-50 rounded-lg p-2">Base Salary</div>
                        <div className="bg-gray-50 rounded-lg p-2 text-right">$0.00</div>
                        <div className="bg-gray-50 rounded-lg p-2">Additions</div>
                        <div className="bg-gray-50 rounded-lg p-2 text-right">$0.00</div>
                        <div className="bg-gray-50 rounded-lg p-2">Deductions</div>
                        <div className="bg-gray-50 rounded-lg p-2 text-right">$0.00</div>
                        <div className="bg-gray-50 rounded-lg p-2 font-semibold">Net Salary</div>
                        <div className="bg-gray-50 rounded-lg p-2 text-right font-semibold">$0.00</div>
                      </div>
                    </div>

                    {settings.signature_url ? (
                      <img
                        src={settings.signature_url}
                        alt="signature"
                        className="absolute object-contain opacity-90"
                        style={signaturePreviewStyle as any}
                      />
                    ) : (
                      <div className="absolute left-10 bottom-40 text-xs text-gray-400">No signature image</div>
                    )}

                    <div
                      className="absolute text-xs text-gray-700"
                      style={{ left: settings.signature_x, top: settings.signature_y + 52 }}
                    >
                      <div className="font-semibold">{settings.signer_name}</div>
                      <div className="text-gray-500">{settings.signer_title}</div>
                    </div>

                    <div className="absolute left-8 right-8 bottom-16">
                      <div className="h-px bg-gray-200 mb-2" />
                      <div className="text-xs text-gray-600 whitespace-pre-wrap">{settings.pdf_footer_text}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    Preview تقريبي. X/Y/W نقاط (pt) للـ PDF الحقيقي.
                  </p>
                </div>
              </div>
            )
          ) : (
            // ───────── Access Control Tab ─────────
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Employees list */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-900">Employees</p>
                  </div>
                  <span className="text-xs text-gray-500">{employees.length}</span>
                </div>

                <div className="p-4 border-b border-gray-100">
                  <div className="relative">
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={empQuery}
                      onChange={(e) => setEmpQuery(e.target.value)}
                      placeholder="Search name or email..."
                      className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {empLoading ? (
                  <div className="p-6 text-sm text-gray-500">Loading employees...</div>
                ) : (
                  <div className="max-h-[520px] overflow-auto">
                    {filteredEmployees.map((e) => {
                      const active = selectedEmpId === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEmpId(e.id)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                            active ? 'bg-gray-50' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-900">{fullName(e)}</div>
                          <div className="text-xs text-gray-500">{e.email || e.id}</div>
                        </button>
                      );
                    })}
                    {filteredEmployees.length === 0 && (
                      <div className="p-6 text-sm text-gray-500">No employees found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Permissions editor */}
              <div className="lg:col-span-2 rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Page Permissions</p>
                    <p className="text-xs text-gray-500">
                      Select an employee, then enable only the pages they can view.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAll(true)}
                      disabled={!selectedEmpId || permLoading}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm disabled:opacity-60"
                    >
                      Allow All
                    </button>
                    <button
                      onClick={() => toggleAll(false)}
                      disabled={!selectedEmpId || permLoading}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm disabled:opacity-60"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {!selectedEmpId ? (
                  <div className="p-10 text-center text-gray-500">Select an employee to manage permissions.</div>
                ) : permLoading ? (
                  <div className="p-10 text-center text-gray-500">Loading permissions...</div>
                ) : (
                  <div className="p-4 space-y-4">
                    {Object.entries(pagesByGroup).map(([group, pages]) => (
                      <div key={group} className="rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-900">{group}</p>
                        </div>

                        <div className="divide-y divide-gray-100">
                          {pages.map((p) => {
                            const checked = !!permissions[p.key];
                            return (
                              <label
                                key={p.key}
                                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                              >
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{p.label}</div>
                                  <div className="text-xs text-gray-500">{p.path}</div>
                                </div>

                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setPermissions((prev) => ({ ...prev, [p.key]: e.target.checked }))
                                  }
                                  className="h-4 w-4"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="text-xs text-gray-500">
                      ملاحظة: لازم تطبق هالصلاحيات بالـ Route Guard (frontend) و/أو RLS (backend) حتى تصير حماية حقيقية.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
