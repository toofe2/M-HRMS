import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  User,
  Users,
  Eye,
  MessageSquare,
  XCircle,
  CalendarDays,
  Hourglass,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

// ────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
}

interface TimesheetEntry {
  id?: string;
  monthly_timesheet_id?: string;
  date: string;
  hours_worked: number;
  description: string;
  project_id: string | null;
  projects?: { name: string } | null;
}

interface MonthlyTimesheet {
  id: string;
  employee_id: string;
  workflow_id: string | null;
  month: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  total_hours: number;
  comments?: string;
  timesheet_entries: TimesheetEntry[];
  employee?: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  employee_name?: string;
  employee_email?: string;
  current_step?: number | null;
  current_step_action_id?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
}

interface PendingApproval {
  approval_action_id: string;
  request_id: string;
  timesheet_id: string;
  approver_id: string;
  employee_name: string;
  month: string;
  total_hours: number;
  current_step: number;
  approval_action_created_at?: string;
}

// ────────────────────────────────────────────────
// RTL / iPhone date render helper
// ────────────────────────────────────────────────
const LTR = ({ children }: { children: React.ReactNode }) => (
  <span dir="ltr" style={{ unicodeBidi: 'isolate' as any }}>
    {children}
  </span>
);

// ────────────────────────────────────────────────
// Date helpers for mobile selects
// ────────────────────────────────────────────────
function parseISODateParts(iso: string): { yyyy: string; mm: string; dd: string } | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { yyyy: m[1], mm: m[2], dd: m[3] };
}

function toISODate(p: { yyyy: string; mm: string; dd: string }) {
  return `${p.yyyy}-${String(p.mm).padStart(2, '0')}-${String(p.dd).padStart(2, '0')}`;
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function monthLabel(m: number) {
  const dt = new Date(2020, m - 1, 1);
  return dt.toLocaleString('en-US', { month: 'short' });
}

function isMobileUA() {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function clampToValid(p: { yyyy: string; mm: string; dd: string }) {
  const y = Number(p.yyyy);
  const m = Number(p.mm);
  const max = daysInMonth(y, m);
  const d = Math.min(Math.max(1, Number(p.dd)), max);
  return { yyyy: String(y), mm: String(m).padStart(2, '0'), dd: String(d).padStart(2, '0') };
}

/**
 * ResponsiveDateInput
 * - Desktop: native <input type="date">
 * - Mobile: 3 selects (Day / Month / Year)
 *
 * ✅ Important per your request:
 * - NO min restriction (user can pick ANY date)
 * - All days shown (nice/ordered), month/year changes are effective
 */
function ResponsiveDateInput({
  label,
  value,
  onChange,
  isMobile,
  yearFrom,
  yearTo,
}: {
  label: string;
  value: string;
  onChange: (nextISO: string) => void;
  isMobile: boolean;
  yearFrom: number;
  yearTo: number;
}) {
  // Desktop
  if (!isMobile) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-red-600">*</span>
        </label>
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          dir="ltr"
          lang="en"
          style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
        />
      </div>
    );
  }

  // Mobile
  const today = new Date();
  const fallback = {
    yyyy: String(today.getFullYear()),
    mm: String(today.getMonth() + 1).padStart(2, '0'),
    dd: String(today.getDate()).padStart(2, '0'),
  };

  const raw = parseISODateParts(value) || fallback;
  const safe = clampToValid(raw);

  const y = Number(safe.yyyy);
  const m = Number(safe.mm);
  const d = Number(safe.dd);

  const maxDay = daysInMonth(y, m);

  const years: number[] = [];
  for (let yy = yearFrom; yy <= yearTo; yy++) years.push(yy);

  const commit = (next: { yyyy: string; mm: string; dd: string }) => {
    const clamped = clampToValid(next);
    onChange(toISODate(clamped));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-600">*</span>
      </label>

      <div className="grid grid-cols-3 gap-2" dir="ltr" style={{ unicodeBidi: 'isolate' as any }}>
        {/* Day */}
        <select
          aria-label={`${label} Day`}
          value={d}
          onChange={(e) =>
            commit({
              ...safe,
              dd: String(Number(e.target.value)).padStart(2, '0'),
            })
          }
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
        >
          {range(maxDay).map((dd) => (
            <option key={dd} value={dd}>
              {String(dd).padStart(2, '0')}
            </option>
          ))}
        </select>

        {/* Month */}
        <select
          aria-label={`${label} Month`}
          value={m}
          onChange={(e) => {
            const nextM = Number(e.target.value);
            const nextMax = daysInMonth(y, nextM);
            const nextD = Math.min(d, nextMax);
            commit({
              ...safe,
              mm: String(nextM).padStart(2, '0'),
              dd: String(nextD).padStart(2, '0'),
            });
          }}
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
        >
          {range(12).map((mm) => (
            <option key={mm} value={mm}>
              {monthLabel(mm)}
            </option>
          ))}
        </select>

        {/* Year */}
        <select
          aria-label={`${label} Year`}
          value={y}
          onChange={(e) => {
            const nextY = Number(e.target.value);
            const nextMax = daysInMonth(nextY, m);
            const nextD = Math.min(d, nextMax);
            commit({
              ...safe,
              yyyy: String(nextY),
              dd: String(nextD).padStart(2, '0'),
            });
          }}
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
        >
          {years.map((yy) => (
            <option key={yy} value={yy}>
              {yy}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        <LTR>Selected: {value || toISODate(safe)}</LTR>
      </p>
    </div>
  );
}

function defaultDateForMonth(currentDate: Date) {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth() + 1; // 1..12
  const today = new Date();
  const day = y === today.getFullYear() && m === today.getMonth() + 1 ? today.getDate() : 1;
  const max = daysInMonth(y, m);
  const dd = Math.min(day, max);
  return `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────
const TimeSheet: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [monthlyTimesheet, setMonthlyTimesheet] = useState<MonthlyTimesheet | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [pendingTeamCount, setPendingTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'my-timesheets' | 'team-timesheets'>('my-timesheets');

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<TimesheetEntry | null>(null);
  const [isEditingEntry, setIsEditingEntry] = useState(false);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<MonthlyTimesheet | null>(null);

  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectingApproval, setRejectingApproval] = useState<PendingApproval | null>(null);
  const [rejectionComments, setRejectionComments] = useState('');

  const firstDayOfMonth = useMemo(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
    [currentDate]
  );

  const canEditTimesheet =
    monthlyTimesheet?.status === 'draft' || monthlyTimesheet?.status === 'rejected';

  const isMobile = useMemo(() => isMobileUA(), []);

  // years range for picker: allow wide selection (any date)
  const yearFrom = useMemo(() => new Date().getFullYear() - 5, []);
  const yearTo = useMemo(() => new Date().getFullYear() + 5, []);

  // ────────────────────────────────────────────────
  // Data Fetching
  // ────────────────────────────────────────────────
  const fetchPendingApprovals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('team_timesheets_pending_approval_v2')
        .select(`
          approval_action_id,
          request_id,
          timesheet_id,
          approver_id,
          employee_name,
          month,
          total_hours,
          current_step,
          approval_action_created_at
        `)
        .eq('approver_id', user.id)
        .order('approval_action_created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as PendingApproval[];
      setPendingApprovals(rows);
      setPendingTeamCount(rows.length);
    } catch (err: any) {
      console.error('Error fetching pending approvals:', err);
    }
  }, [user?.id]);

  const updateTotalHours = async (timesheetId: string, entries: TimesheetEntry[]) => {
    const total = entries.reduce((sum, e) => sum + (Number(e.hours_worked) || 0), 0);
    const { error } = await supabase
      .from('monthly_timesheets')
      .update({ total_hours: total })
      .eq('id', timesheetId);
    if (error) console.error('Failed to update total_hours:', error);
    return total;
  };

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    const monthStr = `${firstDayOfMonth.getFullYear()}-${String(
      firstDayOfMonth.getMonth() + 1
    ).padStart(2, '0')}-01`;

    try {
      const { data: projectsData, error: pErr } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (pErr) throw pErr;
      setProjects((projectsData || []) as Project[]);

      const { data: tsData, error: tsErr } = await supabase.rpc(
        'get_monthly_timesheets_with_details_safe',
        {
          p_user_id: user.id,
          p_year: firstDayOfMonth.getFullYear(),
          p_month: firstDayOfMonth.getMonth() + 1,
        }
      );
      if (tsErr) throw tsErr;

      let currentTs: MonthlyTimesheet | null = null;
      if (Array.isArray(tsData)) {
        if (tsData.length > 1) console.warn('Multiple timesheets found — using first');
        currentTs = (tsData[0] ?? null) as any;
      } else if (tsData) {
        currentTs = tsData as any;
      }

      if (!currentTs) {
        const { data: existing } = await supabase
          .from('monthly_timesheets')
          .select('*')
          .eq('employee_id', user.id)
          .eq('month', monthStr)
          .maybeSingle();

        if (existing) {
          currentTs = { ...(existing as any), timesheet_entries: [] };
        } else {
          const { data: newTs, error: createErr } = await supabase
            .from('monthly_timesheets')
            .insert({
              employee_id: user.id,
              month: monthStr,
              status: 'draft',
              total_hours: 0,
            })
            .select()
            .single();
          if (createErr) throw createErr;
          currentTs = { ...(newTs as any), timesheet_entries: [] };
        }
      }

      setMonthlyTimesheet(currentTs);

      if (currentTs?.id) {
        const { data: entries, error: eErr } = await supabase
          .from('timesheet_entries')
          .select('*, projects(name)')
          .eq('monthly_timesheet_id', currentTs.id)
          .order('date', { ascending: true });

        if (eErr) throw eErr;
        setTimesheetEntries((entries || []) as TimesheetEntry[]);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, firstDayOfMonth]);

  useEffect(() => {
    if (user) {
      fetchPendingApprovals();
      fetchData();
    }
  }, [user, fetchData, fetchPendingApprovals]);

  // ────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────
  const handleOpenAddEntryModal = () => {
    // ✅ Default date matches the currently selected month (e.g., if you are on December, it defaults to December)
    const base = defaultDateForMonth(currentDate);
    setCurrentEntry({
      date: base,
      hours_worked: 0,
      description: '',
      project_id: null,
    });
    setIsEditingEntry(false);
    setShowEntryModal(true);
  };

  const handleOpenEditEntryModal = (entry: TimesheetEntry) => {
    setCurrentEntry({ ...entry });

    // ✅ If user edits an entry from another month, jump to that month automatically
    const p = parseISODateParts(entry.date);
    if (p) setCurrentDate(new Date(Number(p.yyyy), Number(p.mm) - 1, 1));

    setIsEditingEntry(true);
    setShowEntryModal(true);
  };

  const handleSaveEntry = async () => {
    if (!monthlyTimesheet || !currentEntry) return;

    const date = currentEntry.date?.trim();
    const hours = Number(currentEntry.hours_worked) || 0;
    const description = currentEntry.description?.trim();

    if (!date || hours <= 0 || !description) {
      setError('Date, hours (>0), and description are required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let updatedEntry: TimesheetEntry;

      if (isEditingEntry && currentEntry.id) {
        const { data, error } = await supabase
          .from('timesheet_entries')
          .update({
            date,
            hours_worked: hours,
            description,
            project_id: currentEntry.project_id || null,
          })
          .eq('id', currentEntry.id)
          .select('*, projects(name)')
          .single();
        if (error) throw error;
        updatedEntry = data as any;
      } else {
        const { data, error } = await supabase
          .from('timesheet_entries')
          .insert({
            monthly_timesheet_id: monthlyTimesheet.id,
            date,
            hours_worked: hours,
            description,
            project_id: currentEntry.project_id || null,
          })
          .select('*, projects(name)')
          .single();
        if (error) throw error;
        updatedEntry = data as any;
      }

      const newEntries =
        isEditingEntry && currentEntry.id
          ? timesheetEntries.map((e) => (e.id === currentEntry.id ? updatedEntry : e))
          : [...timesheetEntries, updatedEntry];

      setTimesheetEntries(newEntries);
      await updateTotalHours(monthlyTimesheet.id, newEntries);

      await fetchData();
      setSuccess('Entry saved successfully');
      setShowEntryModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('Delete this time entry?')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.from('timesheet_entries').delete().eq('id', entryId);
      if (error) throw error;

      const newEntries = timesheetEntries.filter((e) => e.id !== entryId);
      setTimesheetEntries(newEntries);

      if (monthlyTimesheet?.id) {
        await updateTotalHours(monthlyTimesheet.id, newEntries);
      }

      await fetchData();
      setSuccess('Entry deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete entry');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!monthlyTimesheet?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.rpc('submit_monthly_timesheet', {
        p_timesheet_id: monthlyTimesheet.id,
      });
      if (error) throw error;

      setSuccess('Timesheet submitted for approval');
      await fetchData();
      await fetchPendingApprovals();
    } catch (err: any) {
      setError(err.message || 'Failed to submit timesheet');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (req: PendingApproval) => {
    if (req.approver_id !== user?.id) return;
    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('approve_monthly_timesheet', {
        p_approval_action_id: req.approval_action_id,
        p_approver_id: user.id,
        p_comments: 'Approved',
      });
      if (error) throw error;

      setSuccess('Approved successfully');
      await fetchData();
      await fetchPendingApprovals();
      setShowViewModal(false);
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (req: PendingApproval | null, comments: string) => {
    if (!req || req.approver_id !== user?.id || !comments.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.rpc('reject_monthly_timesheet', {
        p_approval_action_id: req.approval_action_id,
        p_approver_id: user.id,
        p_comments: comments.trim(),
      });
      if (error) throw error;

      setSuccess('Rejected successfully');
      setShowRejectionModal(false);
      setRejectionComments('');
      setRejectingApproval(null);
      await fetchData();
      await fetchPendingApprovals();
      setShowViewModal(false);
    } catch (err: any) {
      setError(err.message || 'Rejection failed');
    } finally {
      setSaving(false);
    }
  };

  const handleViewPendingTimesheet = async (req: PendingApproval) => {
    if (req.approver_id !== user?.id) {
      setError('You are not authorized to view this timesheet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('approver_timesheet_view', {
        p_approval_action_id: req.approval_action_id,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        setError('Timesheet not found or access denied');
        return;
      }

      const ts = data[0];

      const { data: entries, error: entriesErr } = await supabase
        .from('timesheet_entries')
        .select('*, projects(name)')
        .eq('monthly_timesheet_id', req.timesheet_id)
        .order('date');

      if (entriesErr) throw entriesErr;

      const employeeName = `${ts.first_name ?? ''} ${ts.last_name ?? ''}`.trim() || 'Unknown';

      setSelectedTimesheet({
        ...(ts as any),
        employee_name: employeeName,
        employee_email: ts.email,
        current_step_action_id: req.approval_action_id,
        timesheet_entries: (entries || []) as any,
      });

      setShowViewModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load timesheet details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReject = async (req: PendingApproval) => {
    await handleViewPendingTimesheet(req);
    setRejectingApproval(req);
    setShowRejectionModal(true);
  };

  const changeMonth = (delta: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // ────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────
  const getStatusBadgeColor = (status: string = 'draft') => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status?: string) =>
    status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  const formatDate = (dateStr: string) => {
    const dt = new Date(dateStr);
    return dt.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  if (!user) {
    return <div className="p-8 text-center">Please sign in to view timesheets</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition"
          type="button"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white shadow rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Timesheet Management</h2>
            <p className="mt-1 text-gray-500">Track your time or review pending approvals</p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <p>{success}</p>
              </div>
            )}

            <div className="mb-8">
              <div className="flex flex-wrap gap-3 mb-6 border-b border-gray-200 pb-4">
                <TabButton
                  tab="my-timesheets"
                  current={activeTab}
                  icon={User}
                  label="My Timesheet"
                  onClick={() => setActiveTab('my-timesheets')}
                />
                <TabButton
                  tab="team-timesheets"
                  current={activeTab}
                  icon={Users}
                  label="Team Timesheets"
                  count={pendingTeamCount}
                  onClick={() => setActiveTab('team-timesheets')}
                />
              </div>
            </div>

            {/* My Timesheet Tab */}
            {activeTab === 'my-timesheets' && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => changeMonth(-1)}
                      className="p-2 rounded-full hover:bg-gray-100 transition"
                      type="button"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <h3 className="text-xl font-bold text-gray-900">
                      {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => changeMonth(1)}
                      className="p-2 rounded-full hover:bg-gray-100 transition"
                      type="button"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Hours</p>
                      <p className="text-2xl font-bold text-gray-900">
                        <LTR>{monthlyTimesheet?.total_hours ?? 0}</LTR>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Status</p>
                      <span
                        className={`inline-block px-4 py-1 text-sm font-medium rounded-full ${getStatusBadgeColor(
                          monthlyTimesheet?.status ?? 'draft'
                        )}`}
                      >
                        {formatStatus(monthlyTimesheet?.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {monthlyTimesheet?.status === 'rejected' && monthlyTimesheet.comments && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-800">Rejection Reason</h4>
                        <p className="text-red-700 mt-1">{monthlyTimesheet.comments}</p>
                        <p className="text-sm text-gray-600 mt-2">
                          Please update your timesheet based on the comments above, then resubmit it.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="py-16 flex justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-gray-800">Time Entries</h4>
                      {canEditTimesheet && (
                        <button
                          onClick={handleOpenAddEntryModal}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          type="button"
                        >
                          <Plus size={16} />
                          Add Entry
                        </button>
                      )}
                    </div>

                    {timesheetEntries.length === 0 ? (
                      <div className="py-12 text-center bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
                        No time entries for this month yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Hours
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Description
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Project
                              </th>
                              {canEditTimesheet && (
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                  Actions
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {timesheetEntries.map((entry) => (
                              <tr key={entry.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  <LTR>{formatDate(entry.date)}</LTR>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <LTR>{entry.hours_worked}</LTR>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                                  {entry.description}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {entry.projects?.name || '—'}
                                </td>
                                {canEditTimesheet && (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                      onClick={() => handleOpenEditEntryModal(entry)}
                                      className="text-blue-600 hover:text-blue-800 mr-4"
                                      type="button"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteEntry(entry.id!)}
                                      className="text-red-600 hover:text-red-800"
                                      type="button"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {canEditTimesheet && (monthlyTimesheet?.total_hours ?? 0) > 0 && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleSubmitForApproval}
                          disabled={saving}
                          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                          type="button"
                        >
                          <Send size={16} />
                          Submit for Approval
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Team Timesheets Tab */}
            {activeTab === 'team-timesheets' && (
              <div className="space-y-8">
                <h4 className="text-xl font-semibold text-gray-900">Team Timesheets</h4>

                {pendingApprovals.length === 0 ? (
                  <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                    <p className="font-medium">No pending approvals</p>
                    <p className="text-sm mt-1">
                      You can only view your own timesheet.<br />
                      Team timesheets appear when you are an approver.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h5 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Timesheets Waiting for Your Approval
                    </h5>

                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Employee
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Month
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Total Hours
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Current Step
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingApprovals.map((req) => (
                            <tr key={req.approval_action_id} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{req.employee_name}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <LTR>
                                  {new Date(req.month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </LTR>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <LTR>{req.total_hours}</LTR>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <LTR>Step {req.current_step}</LTR>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                                <button
                                  onClick={() => handleViewPendingTimesheet(req)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="View Timesheet"
                                  type="button"
                                >
                                  <Eye size={18} />
                                </button>

                                {!loading && req.approver_id === user?.id && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(req)}
                                      disabled={saving}
                                      className={`text-green-600 hover:text-green-800 ${
                                        saving ? 'opacity-50 cursor-not-allowed' : ''
                                      }`}
                                      title="Approve"
                                      type="button"
                                    >
                                      <CheckCircle2 size={18} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenReject(req)}
                                      disabled={saving}
                                      className={`text-red-600 hover:text-red-800 ${
                                        saving ? 'opacity-50 cursor-not-allowed' : ''
                                      }`}
                                      title="Reject"
                                      type="button"
                                    >
                                      <XCircle size={18} />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Entry Modal */}
        {showEntryModal && currentEntry && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">
                  {isEditingEntry ? 'Edit Entry' : 'New Time Entry'}
                </h3>
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="text-gray-400 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-5">
                <ResponsiveDateInput
                  label="Date"
                  value={currentEntry.date ?? ''}
                  isMobile={isMobile}
                  yearFrom={yearFrom}
                  yearTo={yearTo}
                  onChange={(nextISO) => {
                    setCurrentEntry((prev) => (prev ? { ...prev, date: nextISO } : null));

                    // ✅ Auto-sync the page month with the selected date month (so if user picks December, header becomes December)
                    const p = parseISODateParts(nextISO);
                    if (p) setCurrentDate(new Date(Number(p.yyyy), Number(p.mm) - 1, 1));
                  }}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hours <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={currentEntry.hours_worked ?? ''}
                    onChange={(e) =>
                      setCurrentEntry((prev) =>
                        prev ? { ...prev, hours_worked: Number(e.target.value) || 0 } : null
                      )
                    }
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={currentEntry.description ?? ''}
                    onChange={(e) =>
                      setCurrentEntry((prev) => (prev ? { ...prev, description: e.target.value } : null))
                    }
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                  <select
                    value={currentEntry.project_id ?? ''}
                    onChange={(e) =>
                      setCurrentEntry((prev) => (prev ? { ...prev, project_id: e.target.value || null } : null))
                    }
                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntry}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
                  type="button"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : isEditingEntry ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Timesheet Modal */}
        {showViewModal && selectedTimesheet && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-2xl font-bold text-gray-900">Timesheet Details</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-700"
                  type="button"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50 p-5 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2 text-blue-800 mb-1">
                      <User size={18} />
                      <span className="font-semibold">
                        {selectedTimesheet.employee_name ||
                          `${selectedTimesheet.employee?.first_name ?? ''} ${selectedTimesheet.employee?.last_name ?? ''}`.trim() ||
                          'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-700 text-sm">
                      <CalendarDays size={16} />
                      <LTR>
                        {new Date(selectedTimesheet.month).toLocaleString('default', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </LTR>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-blue-700 mb-1">Total Hours</p>
                    <div className="flex items-center justify-end gap-2 text-blue-900">
                      <Hourglass size={20} />
                      <span className="text-3xl font-bold">
                        <LTR>{selectedTimesheet.total_hours}</LTR>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-700 font-medium">Status</span>
                  <span
                    className={`px-4 py-1 text-sm font-medium rounded-full ${getStatusBadgeColor(
                      selectedTimesheet.status ?? 'draft'
                    )}`}
                  >
                    {formatStatus(selectedTimesheet.status)}
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Time Entries</h4>
                  {selectedTimesheet.timesheet_entries.length === 0 ? (
                    <div className="py-8 text-center bg-gray-50 rounded-lg text-gray-500">No entries recorded</div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Hours</th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                              Description
                            </th>
                            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Project</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedTimesheet.timesheet_entries.map((entry) => (
                            <tr key={entry.id}>
                              <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900">
                                <LTR>{formatDate(entry.date)}</LTR>
                              </td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm font-medium">
                                <LTR>{entry.hours_worked}</LTR>
                              </td>
                              <td className="px-5 py-3 text-sm text-gray-900">{entry.description}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900">
                                {entry.projects?.name || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {selectedTimesheet.comments && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Comments</h4>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-700">
                      {selectedTimesheet.comments}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-6 py-2.5 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition"
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectionModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-5">Reject Timesheet</h3>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Comments <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  value={rejectionComments}
                  onChange={(e) => setRejectionComments(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionComments('');
                    setRejectingApproval(null);
                  }}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (rejectingApproval && rejectionComments.trim()) {
                      handleReject(rejectingApproval, rejectionComments);
                    } else {
                      setError('Cannot reject: missing approval action or empty comments');
                    }
                  }}
                  disabled={saving || !rejectionComments.trim()}
                  className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                  type="button"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// TabButton Component
// ────────────────────────────────────────────────
function TabButton({
  tab,
  current,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  tab: 'my-timesheets' | 'team-timesheets';
  current: 'my-timesheets' | 'team-timesheets';
  icon: React.ElementType;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-5 py-2.5 rounded-lg font-medium transition ${
        tab === current ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'text-gray-600 hover:bg-gray-100'
      }`}
      type="button"
    >
      <Icon className="h-5 w-5 mr-2" />
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-2 px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
          {count}
        </span>
      )}
    </button>
  );
}

export default TimeSheet;
