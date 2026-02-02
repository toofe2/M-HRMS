// src/pages/admin/AdminPayroll.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  Play,
  ShieldCheck,
  HandCoins,
  Landmark,
  Users,
  ListChecks,
  XCircle,
  Search,
  Filter,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

type RunStatus =
  | 'draft'
  | 'processed'
  | 'approved'
  | 'ready_to_pay'
  | 'paid'
  | 'locked'
  | 'cancelled'
  | string;

type PaymentMethod = 'cash' | 'bank' | string;
type ItemType = 'addition' | 'deduction' | string;

interface Office {
  id: string;
  name: string;
  location: string | null;
  timezone: string | null;
  is_active: boolean | null;
}

interface PayrollRun {
  id: string;
  run_month: string; // stored as YYYY-MM-01
  office_id: string;
  status: RunStatus;
  currency: string;
  payment_method_default: PaymentMethod;
  notes: string | null;
  created_at: string;
  updated_at: string;
  offices?: Office | null;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  office_id: string | null;
  offices?: Office | null;
}

interface RunEmployee {
  id: string;
  run_id: string;
  employee_id: string;
  base_salary: number;
  total_additions: number;
  total_deductions: number;
  net_salary: number;
  calc_net_salary: number;
  variance: number;
  status: RunStatus;
  payment_method: PaymentMethod;
  payment_date: string | null;
  notes: string | null;
  payslip_file_path: string | null;
  payslip_generated_at: string | null;
  payslip_snapshot: any | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
}

interface RunItem {
  id: string;
  run_employee_id: string;
  type: ItemType;
  source: string;
  name: string;
  amount: number;
  reference_table: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

interface PaymentBatch {
  id: string;
  run_id: string;
  method: PaymentMethod;
  batch_number: string;
  paid_by: string | null;
  paid_at: string | null;
  attachment_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** ---------- Helpers ---------- */

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/** always returns YYYY-MM-01 (month key) بدون مشاكل timezone */
function monthKeyFromDateInput(value: string) {
  const ym = (value || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return monthKeyToday();
  return `${ym}-01`;
}

function monthKeyToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function formatMonthLabel(run_month: string) {
  const y = run_month.slice(0, 4);
  const m = run_month.slice(5, 7);
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return run_month;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNum(n));
}

function fullName(p?: Profile | null) {
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
  return name || 'Employee';
}

function badge(status: RunStatus) {
  const s = String(status);
  switch (s) {
    case 'draft':
      return { cls: 'bg-gray-100 text-gray-800', label: 'Draft', icon: Clock };
    case 'processed':
      return { cls: 'bg-blue-100 text-blue-800', label: 'Processed', icon: CheckCircle2 };
    case 'approved':
      return { cls: 'bg-indigo-100 text-indigo-800', label: 'Approved', icon: ShieldCheck };
    case 'ready_to_pay':
      return { cls: 'bg-yellow-100 text-yellow-900', label: 'Ready to pay', icon: HandCoins };
    case 'paid':
      return { cls: 'bg-green-100 text-green-800', label: 'Paid', icon: CheckCircle2 };
    case 'locked':
      return { cls: 'bg-black text-white', label: 'Locked', icon: ShieldCheck };
    default:
      return { cls: 'bg-gray-100 text-gray-800', label: s, icon: Clock };
  }
}

/** ---------- Page ---------- */

export default function AdminPayroll() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKeyToday());
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [runStatusFilter, setRunStatusFilter] = useState<string>('all');
  const [empSearch, setEmpSearch] = useState<string>('');

  const [offices, setOffices] = useState<Office[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');

  // Run details
  const [runEmployees, setRunEmployees] = useState<RunEmployee[]>([]);
  const [runItems, setRunItems] = useState<RunItem[]>([]);
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>([]);

  const [tab, setTab] = useState<'employees' | 'items' | 'payments'>('employees');

  // Modals
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [showPayModal, setShowPayModal] = useState<null | { method: PaymentMethod }>(null);
  const [batchNumber, setBatchNumber] = useState('');

  const [showEmpModal, setShowEmpModal] = useState<RunEmployee | null>(null);

  const [showAddItem, setShowAddItem] = useState<null | { re: RunEmployee }>(null);
  const [itemType, setItemType] = useState<ItemType>('addition');
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState<string>('');
  const [itemNote, setItemNote] = useState<string>('');

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) || null,
    [runs, selectedRunId]
  );

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return runEmployees.filter((re) => {
      const name = fullName(re.profiles).toLowerCase();
      const email = (re.profiles?.email || '').toLowerCase();
      const dep = (re.profiles?.department || '').toLowerCase();
      const pos = (re.profiles?.position || '').toLowerCase();
      return !q || name.includes(q) || email.includes(q) || dep.includes(q) || pos.includes(q);
    });
  }, [runEmployees, empSearch]);

  const runTotals = useMemo(() => {
    const totalNet = runEmployees.reduce((a, x) => a + safeNum(x.net_salary), 0);
    const totalAdd = runEmployees.reduce((a, x) => a + safeNum(x.total_additions), 0);
    const totalDed = runEmployees.reduce((a, x) => a + safeNum(x.total_deductions), 0);
    return { totalNet, totalAdd, totalDed, count: runEmployees.length };
  }, [runEmployees]);

  /** ---------- Effects ---------- */

  useEffect(() => {
    if (!user) return;
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || isAdmin !== true) return;
    if (!selectedOfficeId) return; // ✅ يمنع uuid error
    fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, selectedMonth, selectedOfficeId, runStatusFilter]);

  useEffect(() => {
    if (!selectedRunId) return;
    fetchRunDetails(selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId]);

  /** ---------- Data ---------- */

  const bootstrap = async () => {
    setLoading(true);
    setError(null);

    try {
      // ✅ admin_roles has only user_id
      const { data: ar, error: arErr } = await supabase
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', user!.id)
        .limit(1);

      if (arErr) throw arErr;
      const admin = !!(ar && ar.length);
      setIsAdmin(admin);

      // offices
      const { data: off, error: offErr } = await supabase
        .from('offices')
        .select('id, name, location, timezone, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (offErr) throw offErr;

      const officeList = (off as Office[]) || [];
      setOffices(officeList);

      // default office
      if (!selectedOfficeId && officeList.length) {
        setSelectedOfficeId(officeList[0].id);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load admin payroll.');
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async () => {
    setError(null);

    try {
      const q = supabase
        .from('payroll_runs')
        .select(
          `
          id, run_month, office_id, status, currency, payment_method_default, notes, created_at, updated_at,
          offices:office_id (id, name, location, timezone, is_active)
        `
        )
        .eq('run_month', selectedMonth)
        .order('created_at', { ascending: false });

      // ✅ لا فلتر uuid اذا office_id فارغ
      if (selectedOfficeId) q.eq('office_id', selectedOfficeId);
      if (runStatusFilter !== 'all') q.eq('status', runStatusFilter);

      const { data, error } = await q;
      if (error) throw error;

      const list = (data as PayrollRun[]) || [];
      setRuns(list);

      const first = list[0];
      if (first && !selectedRunId) setSelectedRunId(first.id);

      if (!first) {
        setSelectedRunId('');
        setRunEmployees([]);
        setRunItems([]);
        setPaymentBatches([]);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load runs.');
    }
  };

  const fetchRunDetails = async (runId: string) => {
    setBusy(true);
    setError(null);

    try {
      const empRes = await supabase
        .from('payroll_run_employees')
        .select(
          `
          id, run_id, employee_id, base_salary, total_additions, total_deductions, net_salary, calc_net_salary, variance,
          status, payment_method, payment_date, notes, payslip_file_path, payslip_generated_at, payslip_snapshot, created_at, updated_at,
          profiles:employee_id (
            id, first_name, last_name, email, department, position, office_id,
            offices:office_id (id, name, location, timezone, is_active)
          )
        `
        )
        .eq('run_id', runId)
        .order('updated_at', { ascending: false });

      if (empRes.error) throw empRes.error;

      const employees = (empRes.data as RunEmployee[]) || [];
      setRunEmployees(employees);

      // items by employee ids
      const ids = employees.map((x) => x.id);
      if (ids.length) {
        const itemsRes = await supabase
          .from('payroll_run_items')
          .select(`id, run_employee_id, type, source, name, amount, reference_table, reference_id, note, created_at`)
          .in('run_employee_id', ids)
          .order('created_at', { ascending: false });

        if (itemsRes.error) throw itemsRes.error;
        setRunItems((itemsRes.data as RunItem[]) || []);
      } else {
        setRunItems([]);
      }

      // payments
      const payRes = await supabase
        .from('payment_batches')
        .select(`id, run_id, method, batch_number, paid_by, paid_at, attachment_url, notes, created_at, updated_at`)
        .eq('run_id', runId)
        .order('created_at', { ascending: false });

      if (payRes.error) throw payRes.error;
      setPaymentBatches((payRes.data as PaymentBatch[]) || []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load run details.');
    } finally {
      setBusy(false);
    }
  };

  /** ---------- Actions ---------- */

  const onCreateRun = async () => {
    if (!selectedOfficeId) return;
    setBusy(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('create_payroll_run', {
        p_run_month: selectedMonth,
        p_office_id: selectedOfficeId,
      });
      if (error) throw error;

      await fetchRuns();
      if (data) setSelectedRunId(String(data));
      setShowCreateRun(false);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create run.');
    } finally {
      setBusy(false);
    }
  };

  const onProcessRun = async () => {
    if (!selectedRunId) return;
    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('process_payroll_run', { p_run_id: selectedRunId });
      if (error) throw error;
      await fetchRuns();
      await fetchRunDetails(selectedRunId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to process run.');
    } finally {
      setBusy(false);
    }
  };

  const onApproveRun = async () => {
    if (!selectedRunId) return;
    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('approve_payroll_run', { p_run_id: selectedRunId });
      if (error) throw error;
      await fetchRuns();
      await fetchRunDetails(selectedRunId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to approve run.');
    } finally {
      setBusy(false);
    }
  };

  const openPayModal = (method: PaymentMethod) => {
    setBatchNumber(`${String(method).toUpperCase()}-${selectedMonth.slice(0, 7)}-001`);
    setShowPayModal({ method });
  };

  const onPayRun = async () => {
    if (!selectedRunId || !showPayModal?.method) return;
    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('mark_payroll_run_paid', {
        p_run_id: selectedRunId,
        p_method: showPayModal.method,
        p_batch_number: batchNumber.trim(),
      });
      if (error) throw error;

      setShowPayModal(null);
      await fetchRuns();
      await fetchRunDetails(selectedRunId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to mark run paid.');
    } finally {
      setBusy(false);
    }
  };

  const updateEmployeePaymentMethod = async (re: RunEmployee, method: PaymentMethod) => {
    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('payroll_run_employees')
        .update({ payment_method: method })
        .eq('id', re.id);

      if (error) throw error;
      await fetchRunDetails(re.run_id);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update payment method.');
    } finally {
      setBusy(false);
    }
  };

  const addManualItem = async () => {
    if (!showAddItem) return;
    const re = showAddItem.re;

    const amt = safeNum(itemAmount);
    if (!itemName.trim() || amt <= 0) {
      setError('Please enter item name and amount > 0.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { error } = await supabase.from('payroll_run_items').insert({
        run_employee_id: re.id,
        type: itemType,
        source: 'manual',
        name: itemName.trim(),
        amount: amt,
        reference_table: null,
        reference_id: null,
        note: itemNote.trim() || null,
        created_by: user?.id || null,
      });

      if (error) throw error;

      setShowAddItem(null);
      setItemName('');
      setItemAmount('');
      setItemNote('');

      await fetchRunDetails(re.run_id);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to add item.');
    } finally {
      setBusy(false);
    }
  };

  /** ---------- UI States ---------- */

  if (loading) {
    return (
      <PageShell>
        <CenteredSpinner />
      </PageShell>
    );
  }

  if (isAdmin === false) {
    return (
      <PageShell>
        <TopRow
          left={
            <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </button>
          }
          right={null}
        />
        <Card>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Access denied</p>
              <p className="text-sm text-gray-600 mt-1">This page is available for admins/HR/Finance only.</p>
            </div>
          </div>
        </Card>
      </PageShell>
    );
  }

  const runBadge = selectedRun ? badge(selectedRun.status) : null;
  const RunBadgeIcon = runBadge?.icon || Clock;

  return (
    <PageShell>
      <TopRow
        left={
          <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </button>
        }
        right={
          <Button variant="ghost" onClick={() => fetchRuns()} disabled={busy || !selectedOfficeId}>
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Payroll Admin</h1>
            <p className="text-sm text-gray-500 mt-1">Runs by month & office • Process • Approve • Pay</p>
          </div>

          {selectedRun && runBadge ? (
            <span className={cn('inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full', runBadge.cls)}>
              <RunBadgeIcon className="h-4 w-4" />
              {runBadge.label}
            </span>
          ) : null}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-800 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <Label>Month</Label>
              <input
                type="date"
                value={`${selectedMonth.slice(0, 7)}-01`}
                onChange={(e) => setSelectedMonth(monthKeyFromDateInput(e.target.value))}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              <Hint icon={<CalendarDays className="h-3.5 w-3.5" />}>Stored as month start (YYYY-MM-01)</Hint>
            </div>

            <div className="lg:col-span-3">
              <Label>Office</Label>
              <select
                value={selectedOfficeId}
                onChange={(e) => setSelectedOfficeId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select office
                </option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <Hint icon={<Building2 className="h-3.5 w-3.5" />}>Run is per office</Hint>
            </div>

            <div className="lg:col-span-3">
              <Label>Run Status</Label>
              <select
                value={runStatusFilter}
                onChange={(e) => setRunStatusFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="processed">Processed</option>
                <option value="approved">Approved</option>
                <option value="ready_to_pay">Ready to pay</option>
                <option value="paid">Paid</option>
                <option value="locked">Locked</option>
              </select>
              <Hint icon={<Filter className="h-3.5 w-3.5" />}>Optional filter</Hint>
            </div>

            <div className="lg:col-span-3 flex flex-col gap-2">
              <Label>Actions</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button variant="primary" onClick={() => setShowCreateRun(true)} disabled={busy || !selectedOfficeId}>
                  <Plus className="h-4 w-4" />
                  Create
                </Button>

                <Button variant="outline" onClick={onProcessRun} disabled={busy || !selectedRunId}>
                  <Play className="h-4 w-4" />
                  Process
                </Button>

                <Button variant="indigo" onClick={onApproveRun} disabled={busy || !selectedRunId}>
                  <ShieldCheck className="h-4 w-4" />
                  Approve
                </Button>

                <Button variant="success" onClick={() => openPayModal('cash')} disabled={busy || !selectedRunId}>
                  <HandCoins className="h-4 w-4" />
                  Pay Cash
                </Button>

                <Button
                  variant="info"
                  onClick={() => openPayModal('bank')}
                  disabled={busy || !selectedRunId}
                  className="col-span-2"
                >
                  <Landmark className="h-4 w-4" />
                  Pay Bank
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Runs List */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Runs</h2>
          </div>
          <div className="text-xs text-gray-500">
            {formatMonthLabel(selectedMonth)} • {offices.find((o) => o.id === selectedOfficeId)?.name || '—'}
          </div>
        </div>

        <div className="p-6">
          {!selectedOfficeId ? (
            <EmptyState
              title="Select an office"
              subtitle="Choose an office to load runs."
              icon={<Building2 className="h-12 w-12 text-gray-300" />}
            />
          ) : runs.length === 0 ? (
            <EmptyState
              title="No runs found"
              subtitle="Create a run for this month and office."
              icon={<FileText className="h-12 w-12 text-gray-300" />}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {runs.map((r) => {
                const b = badge(r.status);
                const Icon = b.icon;
                const active = r.id === selectedRunId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={cn(
                      'text-left rounded-2xl border p-4 transition flex flex-col gap-3',
                      active ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatMonthLabel(r.run_month)}</p>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {r.offices?.name || 'Office'}
                        </p>
                      </div>

                      <span className={cn('inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full', b.cls)}>
                        <Icon className="h-3.5 w-3.5" />
                        {b.label}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500">
                      Currency: <span className="font-semibold text-gray-900">{r.currency || 'USD'}</span> • Default:{' '}
                      <span className="font-semibold text-gray-900">{String(r.payment_method_default)}</span>
                    </div>

                    <div className="text-xs text-gray-500 inline-flex items-center gap-1">
                      Open details <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Selected Run Details */}
      {selectedRun && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Run Details</h2>
            </div>
            <div className="text-xs text-gray-500">
              Employees: <span className="font-semibold text-gray-900">{runTotals.count}</span> • Net:{' '}
              <span className="font-semibold text-gray-900">{formatMoney(runTotals.totalNet, selectedRun.currency)}</span> • Add:{' '}
              <span className="font-semibold text-gray-900">{formatMoney(runTotals.totalAdd, selectedRun.currency)}</span> • Ded:{' '}
              <span className="font-semibold text-gray-900">{formatMoney(runTotals.totalDed, selectedRun.currency)}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="inline-flex rounded-xl bg-gray-100 p-1">
              <TabButton active={tab === 'employees'} onClick={() => setTab('employees')} label="Employees" />
              <TabButton active={tab === 'items'} onClick={() => setTab('items')} label="Items" />
              <TabButton active={tab === 'payments'} onClick={() => setTab('payments')} label="Payments" />
            </div>
          </div>

          <div className="p-6">
            {busy ? (
              <CenteredSpinner />
            ) : tab === 'employees' ? (
              <EmployeesTab
                currency={selectedRun.currency}
                employees={filteredEmployees}
                totalCount={runEmployees.length}
                search={empSearch}
                onSearch={setEmpSearch}
                onOpenDetails={(re) => setShowEmpModal(re)}
                onAddItem={(re) => setShowAddItem({ re })}
                onChangeMethod={updateEmployeePaymentMethod}
              />
            ) : tab === 'items' ? (
              <ItemsTab currency={selectedRun.currency} runEmployees={runEmployees} runItems={runItems} />
            ) : (
              <PaymentsTab currency={selectedRun.currency} runEmployees={runEmployees} paymentBatches={paymentBatches} />
            )}
          </div>
        </Card>
      )}

      {/* Create Run Modal */}
      {showCreateRun && (
        <Modal title="Create Payroll Run" onClose={() => setShowCreateRun(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will create (or reuse) the run for the selected <b>month</b> and <b>office</b>, and add all active employees from that office.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Month</Label>
                <input
                  type="date"
                  value={`${selectedMonth.slice(0, 7)}-01`}
                  onChange={(e) => setSelectedMonth(monthKeyFromDateInput(e.target.value))}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <Label>Office</Label>
                <select
                  value={selectedOfficeId}
                  onChange={(e) => setSelectedOfficeId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="w-1/2" onClick={() => setShowCreateRun(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" className="w-1/2" onClick={onCreateRun} disabled={busy || !selectedOfficeId}>
                {busy ? 'Working…' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pay Modal */}
      {showPayModal && (
        <Modal title={`Pay Run — ${String(showPayModal.method).toUpperCase()}`} onClose={() => setShowPayModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will mark employees with payment method <b>{String(showPayModal.method)}</b> as <b>paid</b>, create a payment batch, and store paid amounts.
            </p>

            <div>
              <Label>Batch Number</Label>
              <input
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="e.g. CASH-2026-01-001"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="w-1/2" onClick={() => setShowPayModal(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" className="w-1/2" onClick={onPayRun} disabled={busy || !batchNumber.trim()}>
                {busy ? 'Working…' : 'Confirm Pay'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Employee Details Modal */}
      {showEmpModal && (
        <Modal title="Employee Run Details" onClose={() => setShowEmpModal(null)} size="lg">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-900">{fullName(showEmpModal.profiles)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {showEmpModal.profiles?.email || '—'} • {showEmpModal.profiles?.department || '—'} • {showEmpModal.profiles?.position || '—'}
              </p>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <Mini label="Base" value={formatMoney(showEmpModal.base_salary, selectedRun?.currency || 'USD')} />
                <Mini label="Additions" value={formatMoney(showEmpModal.total_additions, selectedRun?.currency || 'USD')} />
                <Mini label="Deductions" value={formatMoney(showEmpModal.total_deductions, selectedRun?.currency || 'USD')} />
                <Mini label="Net" value={formatMoney(showEmpModal.net_salary, selectedRun?.currency || 'USD')} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Items</p>
              <div className="mt-3 space-y-2">
                {runItems
                  .filter((it) => it.run_employee_id === showEmpModal.id)
                  .slice()
                  .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
                  .map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-800">
                          <span
                            className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold mr-2',
                              it.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            )}
                          >
                            {it.type}
                          </span>
                          {it.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {it.source}
                          {it.note ? ` • ${it.note}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{formatMoney(it.amount, selectedRun?.currency || 'USD')}</p>
                    </div>
                  ))}

                {runItems.filter((it) => it.run_employee_id === showEmpModal.id).length === 0 && (
                  <p className="text-sm text-gray-500">No items found.</p>
                )}
              </div>
            </div>

            <Button variant="primary" className="w-full" onClick={() => setShowEmpModal(null)}>
              Close
            </Button>
          </div>
        </Modal>
      )}

      {/* Add Manual Item Modal */}
      {showAddItem && (
        <Modal title="Add Manual Item" onClose={() => setShowAddItem(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-900">{fullName(showAddItem.re.profiles)}</p>
              <p className="text-xs text-gray-500 mt-1">{showAddItem.re.profiles?.email || '—'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="addition">Addition</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>

              <div>
                <Label>Amount</Label>
                <input
                  value={itemAmount}
                  onChange={(e) => setItemAmount(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="e.g. 50"
                />
              </div>
            </div>

            <div>
              <Label>Name</Label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="e.g. Transportation Allowance"
              />
            </div>

            <div>
              <Label>Note (optional)</Label>
              <input
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Optional note"
              />
            </div>

            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-sm text-yellow-900">
              بعد إضافة البنود اليدوية، الأفضل تسوي <b>Process</b> مرة ثانية حتى تتحدث totals بشكل صحيح.
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="w-1/2" onClick={() => setShowAddItem(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" className="w-1/2" onClick={addManualItem} disabled={busy}>
                {busy ? 'Working…' : 'Add'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

/** ---------- Tabs ---------- */

function EmployeesTab({
  currency,
  employees,
  totalCount,
  search,
  onSearch,
  onOpenDetails,
  onAddItem,
  onChangeMethod,
}: {
  currency: string;
  employees: RunEmployee[];
  totalCount: number;
  search: string;
  onSearch: (v: string) => void;
  onOpenDetails: (re: RunEmployee) => void;
  onAddItem: (re: RunEmployee) => void;
  onChangeMethod: (re: RunEmployee, method: PaymentMethod) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search employee (name/email/department/position)…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Showing <span className="font-semibold text-gray-900">{employees.length}</span> / {totalCount}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th>Base</Th>
              <Th>Additions</Th>
              <Th>Deductions</Th>
              <Th>Net</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <ThRight>Actions</ThRight>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {employees.map((re) => {
              const b = badge(re.status);
              const Icon = b.icon;

              return (
                <tr key={re.id} className="hover:bg-gray-50">
                  <Td>
                    <div className="font-medium text-gray-900">{fullName(re.profiles)}</div>
                    <div className="text-xs text-gray-500">
                      {re.profiles?.email || '—'} • {re.profiles?.department || '—'} • {re.profiles?.position || '—'}
                    </div>
                  </Td>

                  <Td>{formatMoney(re.base_salary, currency)}</Td>
                  <Td>{formatMoney(re.total_additions, currency)}</Td>
                  <Td>{formatMoney(re.total_deductions, currency)}</Td>
                  <Td className="font-semibold">{formatMoney(re.net_salary, currency)}</Td>

                  <Td>
                    <select
                      value={String(re.payment_method)}
                      onChange={(e) => onChangeMethod(re, e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm"
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                    </select>
                  </Td>

                  <Td>
                    <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold', b.cls)}>
                      <Icon className="h-3.5 w-3.5" />
                      {b.label}
                    </span>
                  </Td>

                  <TdRight>
                    <div className="inline-flex gap-2">
                      <Button variant="ghost" onClick={() => onOpenDetails(re)}>
                        Details
                      </Button>
                      <Button variant="primary" onClick={() => onAddItem(re)}>
                        Add Item
                      </Button>
                    </div>
                  </TdRight>
                </tr>
              );
            })}

            {employees.length === 0 && (
              <tr>
                <Td className="text-gray-500" colSpan={8}>
                  No employees found.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet cards */}
      <div className="lg:hidden space-y-3">
        {employees.map((re) => {
          const b = badge(re.status);
          const Icon = b.icon;

          return (
            <div key={re.id} className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{fullName(re.profiles)}</p>
                  <p className="text-xs text-gray-500 mt-1">{re.profiles?.email || '—'}</p>
                </div>

                <span className={cn('inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold', b.cls)}>
                  <Icon className="h-3.5 w-3.5" />
                  {b.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini label="Base" value={formatMoney(re.base_salary, currency)} />
                <Mini label="Net" value={formatMoney(re.net_salary, currency)} />
                <Mini label="Add" value={formatMoney(re.total_additions, currency)} />
                <Mini label="Ded" value={formatMoney(re.total_deductions, currency)} />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <select
                  value={String(re.payment_method)}
                  onChange={(e) => onChangeMethod(re, e.target.value)}
                  className="w-1/2 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>

                <Button variant="ghost" className="w-1/4" onClick={() => onOpenDetails(re)}>
                  Details
                </Button>
                <Button variant="primary" className="w-1/4" onClick={() => onAddItem(re)}>
                  Add
                </Button>
              </div>
            </div>
          );
        })}

        {employees.length === 0 && (
          <div className="rounded-2xl border border-gray-200 p-6 bg-white text-sm text-gray-500">No employees found.</div>
        )}
      </div>
    </div>
  );
}

function ItemsTab({
  currency,
  runEmployees,
  runItems,
}: {
  currency: string;
  runEmployees: RunEmployee[];
  runItems: RunItem[];
}) {
  const empMap = useMemo(() => {
    const m = new Map<string, RunEmployee>();
    runEmployees.forEach((re) => m.set(re.id, re));
    return m;
  }, [runEmployees]);

  const totals = useMemo(() => {
    const add = runItems.filter((i) => i.type === 'addition').reduce((a, x) => a + safeNum(x.amount), 0);
    const ded = runItems.filter((i) => i.type === 'deduction').reduce((a, x) => a + safeNum(x.amount), 0);
    return { add, ded, count: runItems.length };
  }, [runItems]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
        <div className="text-xs text-gray-600">
          Items: <span className="font-semibold text-gray-900">{totals.count}</span> • Additions:{' '}
          <span className="font-semibold text-gray-900">{formatMoney(totals.add, currency)}</span> • Deductions:{' '}
          <span className="font-semibold text-gray-900">{formatMoney(totals.ded, currency)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th>Type</Th>
              <Th>Source</Th>
              <Th>Name</Th>
              <ThRight>Amount</ThRight>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {runItems.map((it) => {
              const re = empMap.get(it.run_employee_id);
              return (
                <tr key={it.id} className="hover:bg-gray-50">
                  <Td>
                    <div className="font-medium">{re ? fullName(re.profiles) : '—'}</div>
                    <div className="text-xs text-gray-500">{re?.profiles?.email || '—'}</div>
                  </Td>

                  <Td>
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                        it.type === 'addition' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}
                    >
                      {it.type}
                    </span>
                  </Td>

                  <Td className="text-gray-700">{it.source}</Td>

                  <Td>
                    <div className="text-gray-900">{it.name}</div>
                    {it.note ? <div className="text-xs text-gray-500 mt-1">{it.note}</div> : null}
                  </Td>

                  <TdRight>
                    <span className="font-semibold text-gray-900">{formatMoney(it.amount, currency)}</span>
                  </TdRight>
                </tr>
              );
            })}

            {runItems.length === 0 && (
              <tr>
                <Td className="text-gray-500" colSpan={5}>
                  No items found.
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsTab({
  currency,
  runEmployees,
  paymentBatches,
}: {
  currency: string;
  runEmployees: RunEmployee[];
  paymentBatches: PaymentBatch[];
}) {
  const paidCount = runEmployees.filter((e) => String(e.status) === 'paid').length;
  const cashCount = runEmployees.filter((e) => String(e.payment_method) === 'cash').length;
  const bankCount = runEmployees.filter((e) => String(e.payment_method) === 'bank').length;

  const paidTotal = runEmployees
    .filter((e) => String(e.status) === 'paid')
    .reduce((a, x) => a + safeNum(x.net_salary), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Mini label="Employees" value={`${runEmployees.length}`} />
        <Mini label="Paid" value={`${paidCount}`} />
        <Mini label="Cash / Bank" value={`${cashCount} / ${bankCount}`} />
        <Mini label="Paid Total" value={formatMoney(paidTotal, currency)} />
      </div>

      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <p className="text-sm font-semibold text-gray-900">Payment Batches</p>
        </div>

        <div className="p-6 bg-white">
          {paymentBatches.length === 0 ? (
            <p className="text-sm text-gray-500">No payment batches yet.</p>
          ) : (
            <div className="space-y-3">
              {paymentBatches.map((b) => (
                <div key={b.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.batch_number}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Method: <span className="font-semibold text-gray-900">{String(b.method)}</span> • Paid at:{' '}
                        <span className="font-semibold text-gray-900">{b.paid_at ? new Date(b.paid_at).toLocaleString() : '—'}</span>
                      </p>
                    </div>

                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
                        String(b.method) === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      )}
                    >
                      {String(b.method).toUpperCase()}
                    </span>
                  </div>

                  {b.notes ? <p className="text-sm text-gray-700 mt-2">{b.notes}</p> : null}
                  {b.attachment_url ? (
                    <p className="text-xs text-gray-500 mt-2">
                      Attachment: <span className="font-semibold text-gray-900">{b.attachment_url}</span>
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ---------- UI Components ---------- */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">{children}</div>
    </div>
  );
}

function TopRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">{left}</div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-white rounded-2xl shadow-sm border border-gray-100', className)}>{children}</div>;
}

function CenteredSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-400" />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center py-10">
      <div className="mx-auto mb-3 w-fit">{icon}</div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-gray-700">{children}</label>;
}

function Hint({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
      {icon}
      {children}
    </p>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-semibold rounded-lg transition',
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      )}
    >
      {label}
    </button>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'info' | 'indigo';

function Button({
  children,
  onClick,
  disabled,
  className,
  variant = 'outline',
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: ButtonVariant;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 disabled:opacity-60 disabled:cursor-not-allowed';

  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-gray-900 text-white hover:bg-gray-800',
    outline: 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50',
    ghost: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-300',
    info: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300',
    indigo: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-300',
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cn(base, styles[variant], className)} title={title}>
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</th>;
}

function ThRight({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 bg-gray-50 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</th>;
}

function Td({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('px-4 py-3 text-sm text-gray-900', className)}>
      {children}
    </td>
  );
}

function TdRight({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-right">{children}</td>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const maxW = size === 'lg' ? 'max-w-3xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={cn('bg-white rounded-2xl shadow-xl w-full overflow-hidden', maxW)}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
