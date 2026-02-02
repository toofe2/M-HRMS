// src/pages/Vacation.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Check,
  X,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Info,
  UserCircle,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { useLeaveBalance } from '../hooks/useLeaveBalance';
import { formatDateSafe } from '../lib/bidi';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  paid: boolean;
  annual_allowance: number;
  requires_approval: boolean;
  is_active?: boolean;
}

interface LeaveRequestEmployee {
  first_name: string | null;
  last_name: string | null;
  direct_manager_id?: string | null;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string;
  manager_approval_status: string;
  manager_comments?: string;
  employee: LeaveRequestEmployee | null;
  employee_id: string;
}

interface OfficeHoliday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  office_id: string;
}

interface Office {
  id: string;
  name: string;
  location: string;
}

interface ConfirmationDialog {
  show: boolean;
  requestId: string;
  action: 'approve' | 'reject';
  workingDays: number;
  leaveType: string;
  request?: LeaveRequest;
}

/**
 * ✅ Fix for mobile/RTL date rendering:
 * - Some mobile browsers (especially iOS Safari) reorder separators like "/" inside RTL containers.
 * - We render dates as isolated LTR parts with explicit spacing and separators.
 */
function parseISODateParts(input: string): { yyyy: string; mm: string; dd: string } | null {
  if (!input) return null;
  const pure = input.split('T')[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pure);
  if (m) return { yyyy: m[1], mm: m[2], dd: m[3] };

  // fallback: try slash formats (very defensive)
  const m2 = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(pure);
  if (!m2) return null;
  const dd = String(m2[1]).padStart(2, '0');
  const mm = String(m2[2]).padStart(2, '0');
  const yyyy = String(m2[3]).length === 2 ? `20${m2[3]}` : String(m2[3]);
  return { yyyy, mm, dd };
}

function toISODate(parts: { yyyy: string; mm: string; dd: string }): string {
  return `${parts.yyyy}-${parts.mm}-${parts.dd}`;
}

const LTR = ({ children }: { children: React.ReactNode }) => (
  <span dir="ltr" style={{ unicodeBidi: 'isolate' as any }}>
    {children}
  </span>
);

const DateDisplay = ({ value }: { value: string }) => {
  const parts = parseISODateParts(value);
  if (!parts) return <LTR>{formatDateSafe(value)}</LTR>;

  // Render as isolated parts to prevent "/" swapping in RTL
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate' as any }} className="inline-flex items-center gap-1 tabular-nums">
      <span>{parts.dd}</span>
      <span className="opacity-60">/</span>
      <span>{parts.mm}</span>
      <span className="opacity-60">/</span>
      <span>{parts.yyyy}</span>
    </span>
  );
};

function isValidDateISO(iso: string): boolean {
  const p = parseISODateParts(iso);
  if (!p) return false;
  const y = Number(p.yyyy);
  const m = Number(p.mm);
  const d = Number(p.dd);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(`${p.yyyy}-${p.mm}-${p.dd}T00:00:00`);
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

function compareISO(a: string, b: string): number {
  // safe because ISO yyyy-mm-dd sorts lexicographically
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function todayISO(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function monthLabel(m: number): string {
  const labels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return labels[m - 1] || String(m);
}

function ResponsiveDateInput({
  label,
  value,
  min,
  onChange,
  isMobile,
}: {
  label: string;
  value: string;
  min: string;
  onChange: (nextISO: string) => void;
  isMobile: boolean;
}) {
  const minISO = min || todayISO();

  // year options (no hooks)
  const nowY = new Date().getFullYear();
  const yearOptions = [nowY, nowY + 1, nowY + 2];

  // Desktop: native date input
  if (!isMobile) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
          type="date"
          value={value}
          min={minISO}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          dir="ltr"
          lang="en"
          style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}
          required
        />
      </div>
    );
  }

  // Mobile: custom selects but show ALL days/months (as you preferred) and just disable invalid ones.
  const minParts = parseISODateParts(minISO) || { yyyy: String(nowY), mm: '01', dd: '01' };

  const rawParts =
    parseISODateParts(value) ||
    parseISODateParts(minISO) || {
      yyyy: String(nowY),
      mm: String(new Date().getMonth() + 1).padStart(2, '0'),
      dd: String(new Date().getDate()).padStart(2, '0'),
    };

  // Clamp current parts to be >= minISO and valid calendar date
  const clampToValid = (p: { yyyy: string; mm: string; dd: string }) => {
    const y = Number(p.yyyy);
    const m = Number(p.mm);
    const max = daysInMonth(y, m);
    const d = Math.min(Math.max(1, Number(p.dd)), max);
    return { yyyy: String(y), mm: String(m).padStart(2, '0'), dd: String(d).padStart(2, '0') };
  };

  let safeParts = clampToValid(rawParts);
  const safeISO = toISODate(safeParts);
  if (compareISO(safeISO, minISO) < 0) {
    safeParts = clampToValid(minParts);
  }

  const selectedYear = Number(safeParts.yyyy);
  const selectedMonth = Number(safeParts.mm);
  const selectedDay = Number(safeParts.dd);

  const maxDay = daysInMonth(selectedYear, selectedMonth);

  const isYearDisabled = (y: number) => y < Number(minParts.yyyy);
  const isMonthDisabled = (m: number) =>
    selectedYear === Number(minParts.yyyy) && m < Number(minParts.mm);
  const isDayDisabled = (d: number) =>
    selectedYear === Number(minParts.yyyy) &&
    selectedMonth === Number(minParts.mm) &&
    d < Number(minParts.dd);

  const commit = (next: { yyyy: string; mm: string; dd: string }) => {
    const clamped = clampToValid(next);
    const iso = toISODate(clamped);
    if (compareISO(iso, minISO) < 0) {
      onChange(minISO);
      return;
    }
    onChange(iso);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="mt-1 grid grid-cols-3 gap-2" dir="ltr" style={{ unicodeBidi: 'isolate' as any }}>
        <select
          aria-label={`${label} Day`}
          value={selectedDay}
          onChange={(e) =>
            commit({
              ...safeParts,
              dd: String(Number(e.target.value)).padStart(2, '0'),
            })
          }
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
        >
          {range(maxDay).map((d) => (
            <option key={d} value={d} disabled={isDayDisabled(d)}>
              {String(d).padStart(2, '0')}
            </option>
          ))}
        </select>

        <select
          aria-label={`${label} Month`}
          value={selectedMonth}
          onChange={(e) => {
            const m = Number(e.target.value);
            const newMax = daysInMonth(selectedYear, m);
            const dd = Math.min(selectedDay, newMax);
            commit({ ...safeParts, mm: String(m).padStart(2, '0'), dd: String(dd).padStart(2, '0') });
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
        >
          {range(12).map((m) => (
            <option key={m} value={m} disabled={isMonthDisabled(m)}>
              {monthLabel(m)}
            </option>
          ))}
        </select>

        <select
          aria-label={`${label} Year`}
          value={selectedYear}
          onChange={(e) => {
            const y = Number(e.target.value);
            // If switching to min year, ensure month >= min month
            const newMonth =
              y === Number(minParts.yyyy) ? Math.max(selectedMonth, Number(minParts.mm)) : selectedMonth;

            const newMax = daysInMonth(y, newMonth);
            // If switching to min year+month, ensure day >= min day
            const newDayMin =
              y === Number(minParts.yyyy) && newMonth === Number(minParts.mm) ? Number(minParts.dd) : 1;

            const dd = Math.min(Math.max(selectedDay, newDayMin), newMax);

            commit({
              yyyy: String(y),
              mm: String(newMonth).padStart(2, '0'),
              dd: String(dd).padStart(2, '0'),
            });
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y} disabled={isYearDisabled(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        <LTR>
          Selected: <DateDisplay value={value || minISO} />
        </LTR>
      </p>
    </div>
  );
}

export default function Vacation() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { getAvailableDays, refreshBalances } = useLeaveBalance();

  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [teamLeaveRequests, setTeamLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newRequest, setNewRequest] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const [workingDaysCount, setWorkingDaysCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmation, setConfirmation] = useState<ConfirmationDialog>({
    show: false,
    requestId: '',
    action: 'approve',
    workingDays: 0,
    leaveType: '',
    request: undefined,
  });

  const [pendingCount, setPendingCount] = useState(0);
  const [officeHolidays, setOfficeHolidays] = useState<OfficeHoliday[]>([]);
  const [userOffice, setUserOffice] = useState<Office | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setIsMobile(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data, error } = await supabase.from('leave_types').select('*').order('name');
      if (error) throw error;

      if (data) {
        setLeaveTypes(data as LeaveType[]);
        if (!newRequest.leave_type && data.length > 0) {
          setNewRequest((prev) => ({ ...prev, leave_type: String(data[0].name).toLowerCase() }));
        }
      }
    } catch (err: any) {
      console.error('Error fetching leave types:', err);
      setError(err.message);
    }
  };

  const fetchOfficeData = async () => {
    if (!user) return;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(
          `
          office_id,
          offices:office_id (
            id,
            name,
            location
          )
        `
        )
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData?.offices) {
        setUserOffice(profileData.offices as Office);

        if (!profileData.office_id) {
          throw new Error('User profile does not have an associated office');
        }

        const { data: holidaysData, error: holidaysError } = await supabase
          .from('office_holidays')
          .select('*')
          .eq('office_id', profileData.office_id)
          .order('date');

        if (holidaysError) throw holidaysError;
        setOfficeHolidays((holidaysData || []) as OfficeHoliday[]);
      }
    } catch (err: any) {
      console.error('Error fetching office data:', err);
      setError(err.message);
    }
  };

  async function fetchLeaveRequests() {
    if (!user) return;

    const year = new Date().getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    try {
      // Personal leave requests
      const { data: personalData, error: personalError } = await supabase
        .from('leave_requests')
        .select(
          `
          *,
          employee:profiles!leave_requests_employee_id_fkey (
            first_name,
            last_name,
            direct_manager_id
          )
        `
        )
        .eq('employee_id', user.id)
        .gte('start_date', from)
        .lte('start_date', to)
        .order('created_at', { ascending: false });

      if (personalError) throw personalError;
      setLeaveRequests((personalData || []) as LeaveRequest[]);

      // Team leave requests (based on my pending actions)
      const { data: myPendingActions, error: actErr } = await supabase
        .from('approval_actions')
        .select(
          `
          id,
          request_id,
          action,
          approval_requests:request_id (
            id,
            request_data,
            status
          )
        `
        )
        .eq('approver_id', user.id)
        .eq('action', 'pending');

      if (actErr) throw actErr;

      const leaveIds = (myPendingActions || [])
        .map((a: any) => a.approval_requests?.request_data?.leave_request_id)
        .filter(Boolean);

      if (leaveIds.length === 0) {
        setTeamLeaveRequests([]);
        setPendingCount(0);
        return;
      }

      const { data: teamLeaves, error: teamLeavesErr } = await supabase
        .from('leave_requests')
        .select(
          `
          *,
          employee:profiles!leave_requests_employee_id_fkey (
            first_name,
            last_name,
            direct_manager_id
          )
        `
        )
        .in('id', leaveIds)
        .gte('start_date', from)
        .lte('start_date', to)
        .order('created_at', { ascending: false });

      if (teamLeavesErr) throw teamLeavesErr;

      setTeamLeaveRequests((teamLeaves || []) as LeaveRequest[]);
      setPendingCount(teamLeaves?.length || 0);
    } catch (err: any) {
      console.error('Error fetching leave requests:', err);
      setError(err.message);
    }
  }

  useEffect(() => {
    if (user) {
      fetchLeaveTypes();
      fetchLeaveRequests();
      fetchOfficeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isHoliday = (date: Date) => {
    if (!userOffice) return false;
    const dateStr = date.toISOString().split('T')[0];

    return officeHolidays.some((holiday) => {
      if (holiday.is_recurring) {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getMonth() === date.getMonth() && holidayDate.getDate() === date.getDate();
      }
      return holiday.date === dateStr;
    });
  };

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    let days = 0;
    const currDate = new Date(start);

    while (currDate <= end) {
      const dayOfWeek = currDate.getDay();
      // Fri=5, Sat=6
      if (dayOfWeek !== 5 && dayOfWeek !== 6 && !isHoliday(currDate)) {
        days++;
      }
      currDate.setDate(currDate.getDate() + 1);
    }
    return days;
  };

  const calculateApprovedDays = (type: string) =>
    leaveRequests
      .filter((r) => r.leave_type === type && r.status === 'approved' && r.employee_id === user?.id)
      .reduce((total, r) => total + calculateWorkingDays(r.start_date, r.end_date), 0);

  const calculatePendingDays = (type: string) =>
    leaveRequests
      .filter((r) => r.leave_type === type && r.status === 'pending' && r.employee_id === user?.id)
      .reduce((total, r) => total + calculateWorkingDays(r.start_date, r.end_date), 0);

  const getAvailableBalanceWithPending = (type: string) => {
    const available = getAvailableDays(type);
    const pendingDays = calculatePendingDays(type);
    return available - pendingDays;
  };

  useEffect(() => {
    if (newRequest.start_date && newRequest.end_date) {
      setWorkingDaysCount(calculateWorkingDays(newRequest.start_date, newRequest.end_date));
    } else {
      setWorkingDaysCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newRequest.start_date, newRequest.end_date]);

  const showConfirmation = (requestId: string, action: 'approve' | 'reject', request: LeaveRequest) => {
    setShowViewModal(false);
    const workingDays = calculateWorkingDays(request.start_date, request.end_date);

    setConfirmation({
      show: true,
      requestId,
      action,
      workingDays,
      leaveType: request.leave_type,
      request,
    });
  };

  const handleApproval = async (approved: boolean, leave: LeaveRequest) => {
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: apprReq, error: apprReqErr } = await supabase
        .from('approval_requests')
        .select('id, status')
        .contains('request_data', { leave_request_id: leave.id })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (apprReqErr) throw apprReqErr;
      if (!apprReq) throw new Error('No approval request found for this leave request.');

      const { data: currentAction, error: actionFetchErr } = await supabase
        .from('approval_actions')
        .select('id')
        .eq('request_id', apprReq.id)
        .eq('approver_id', user.id)
        .eq('action', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (actionFetchErr) throw actionFetchErr;
      if (!currentAction) throw new Error('No pending approval action found for you. It may have been handled already.');

      const { error: updateErr } = await supabase
        .from('approval_actions')
        .update({
          action: approved ? 'approved' : 'rejected',
          action_date: new Date().toISOString(),
          comments: approved ? 'Approved' : 'Rejected',
        })
        .eq('id', currentAction.id);

      if (updateErr) throw updateErr;

      await Promise.all([fetchLeaveRequests(), refreshBalances()]);
      setSuccess(approved ? 'Approved successfully' : 'Rejected successfully');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Approval failed');
    } finally {
      setIsSubmitting(false);
      setConfirmation({
        show: false,
        requestId: '',
        action: 'approve',
        workingDays: 0,
        leaveType: '',
        request: undefined,
      });
    }
  };

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const workingDays = calculateWorkingDays(newRequest.start_date, newRequest.end_date);

      if (new Date(newRequest.start_date) > new Date(newRequest.end_date)) {
        throw new Error('End date cannot be before start date');
      }
      if (new Date(newRequest.start_date) < new Date()) {
        throw new Error('Cannot request leave for past dates');
      }

      const availableBalance = getAvailableBalanceWithPending(newRequest.leave_type);
      if (workingDays > availableBalance) {
        throw new Error(`Insufficient ${newRequest.leave_type} leave balance. You have ${availableBalance} days available.`);
      }

      if (!userOffice?.id) {
        throw new Error('User office not found. Please ensure your profile is linked to an office.');
      }

      const requestBody = {
        employee_id: user.id,
        leave_type: newRequest.leave_type,
        start_date: newRequest.start_date,
        end_date: newRequest.end_date,
        reason: newRequest.reason,
        status: 'pending',
        manager_approval_status: 'pending',
        working_days: workingDays,
        office_id: userOffice.id,
      };

      const { error: insertError } = await supabase.from('leave_requests').insert([requestBody]).select().single();
      if (insertError) throw new Error(`Failed to submit leave request: ${insertError.message}`);

      await Promise.all([fetchLeaveRequests(), refreshBalances()]);
      setSuccess('Leave request submitted successfully');
      setShowModal(false);

      setNewRequest({
        leave_type: leaveTypes.length > 0 ? String(leaveTypes[0].name).toLowerCase() : '',
        start_date: '',
        end_date: '',
        reason: '',
      });
    } catch (err: any) {
      console.error('Error submitting leave request:', err);
      setError(err.message || 'An error occurred while submitting the request');
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

  const TabButton = ({
    tab,
    current,
    icon: Icon,
    label,
    count,
  }: {
    tab: 'personal' | 'team';
    current: 'personal' | 'team';
    icon: React.ElementType;
    label: string;
    count?: number;
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center px-4 py-2 rounded-lg ${
        tab === current ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
      }`}
      type="button"
    >
      <Icon className="h-5 w-5 mr-2" />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          {count}
        </span>
      )}
    </button>
  );

  const handleViewRequest = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setShowViewModal(true);
  };

  const renderTableRow = (request: LeaveRequest, showEmployeeName = false) => {
    const employeeName =
      `${request.employee?.first_name ?? ''} ${request.employee?.last_name ?? ''}`.trim() || 'Unknown Employee';

    return (
      <tr key={request.id}>
        {showEmployeeName && (
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employeeName}</td>
        )}

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
          {request.leave_type} Leave
        </td>

        {/* ✅ Mobile/RTL-safe date rendering */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span className="inline-flex items-center gap-2" dir="ltr" style={{ unicodeBidi: 'isolate' as any }}>
            <DateDisplay value={request.start_date} />
            <span className="opacity-60">-</span>
            <DateDisplay value={request.end_date} />
          </span>
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <LTR>{calculateWorkingDays(request.start_date, request.end_date)} days</LTR>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(request.manager_approval_status)}`}>
            {formatStatus(request.manager_approval_status)}
          </span>
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-right">
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => handleViewRequest(request)}
              className="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
              title="View Details"
              type="button"
            >
              <Eye className="h-4 w-4" />
            </button>

            {activeTab === 'team' && request.manager_approval_status === 'pending' && (
              <>
                <button
                  onClick={() => showConfirmation(request.id, 'approve', request)}
                  className="p-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
                  title="Approve"
                  type="button"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => showConfirmation(request.id, 'reject', request)}
                  className="p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                  title="Reject"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
          type="button"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Leave Management</h2>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              type="button"
            >
              <Plus className="h-4 w-4 mr-2" />
              Request Leave
            </button>
          </div>

          <div className="p-6">
            {(error || success) && (
              <div className={`mb-4 ${error ? 'bg-red-50' : 'bg-green-50'} text-${error ? 'red' : 'green'}-700 p-4 rounded-md flex items-start`}>
                {error ? (
                  <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-red-400" />
                ) : (
                  <Check className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0 text-green-400" />
                )}
                <p>{error || success}</p>
              </div>
            )}

            {userOffice && (
              <div className="mb-4 bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-blue-700">
                    Your Office: {userOffice.name} ({userOffice.location})
                  </span>
                </div>
                <p className="mt-2 text-sm text-blue-600">
                  Note: Leave days are calculated based on your office&apos;s holiday calendar
                </p>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Leave Balance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm text-green-600 font-medium">Annual Leave</p>
                    <div className="flex items-center">
                      <Info className="h-4 w-4 text-green-600 mr-1" />
                      <span className="text-xs text-green-600">
                        <LTR>{calculatePendingDays('annual')} pending</LTR>
                      </span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    <LTR>{getAvailableDays('annual')} days available</LTR>
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    <LTR>Total: {getAvailableDays('annual') + calculateApprovedDays('annual')} days</LTR>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    <LTR>Used: {calculateApprovedDays('annual')} days</LTR>
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm text-blue-600 font-medium">Sick Leave</p>
                    <div className="flex items-center">
                      <Info className="h-4 w-4 text-blue-600 mr-1" />
                      <span className="text-xs text-blue-600">
                        <LTR>{calculatePendingDays('sick')} pending</LTR>
                      </span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">
                    <LTR>{getAvailableDays('sick')} days available</LTR>
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    <LTR>Total: {getAvailableDays('sick') + calculateApprovedDays('sick')} days</LTR>
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    <LTR>Used: {calculateApprovedDays('sick')} days</LTR>
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm text-purple-600 font-medium">Personal Leave</p>
                    <div className="flex items-center">
                      <Info className="h-4 w-4 text-purple-600 mr-1" />
                      <span className="text-xs text-purple-600">
                        <LTR>{calculatePendingDays('personal')} pending</LTR>
                      </span>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">
                    <LTR>{getAvailableDays('personal')} days available</LTR>
                  </p>
                  <p className="text-sm text-purple-600 mt-1">
                    <LTR>Total: {getAvailableDays('personal') + calculateApprovedDays('personal')} days</LTR>
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    <LTR>Used: {calculateApprovedDays('personal')} days</LTR>
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4 flex space-x-4">
              <TabButton tab="personal" current={activeTab} icon={UserCircle} label="My Leave Requests" />
              <TabButton tab="team" current={activeTab} icon={Users} label="Team Leave Requests" count={pendingCount} />
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {activeTab === 'personal' ? 'My Leave History' : 'Team Leave History'}
              </h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      {activeTab === 'team' && (
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                      )}
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Working Days
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {(activeTab === 'personal' ? leaveRequests : teamLeaveRequests).map((request) =>
                      renderTableRow(request, activeTab === 'team')
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal - Request Leave */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Request Leave</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500" type="button">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                  <select
                    value={newRequest.leave_type}
                    onChange={(e) => setNewRequest((prev) => ({ ...prev, leave_type: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    {leaveTypes
                      .filter((type) => type.is_active !== false)
                      .map((type) => (
                        <option key={type.id} value={String(type.name).toLowerCase()}>
                          {type.name} Leave ({getAvailableBalanceWithPending(String(type.name).toLowerCase())} days available)
                          {type.paid ? ' - Paid' : ' - Unpaid'}
                        </option>
                      ))}
                  </select>
                </div>

                <ResponsiveDateInput
                  label="Start Date"
                  value={newRequest.start_date}
                  min={todayISO()}
                  isMobile={isMobile}
                  onChange={(v) => {
                    setNewRequest((prev) => ({
                      ...prev,
                      start_date: v,
                      // If end is empty or end < start, move end to start
                      end_date: prev.end_date && compareISO(prev.end_date, v) >= 0 ? prev.end_date : v,
                    }));
                  }}
                />

                <ResponsiveDateInput
                  label="End Date"
                  value={newRequest.end_date}
                  min={newRequest.start_date || todayISO()}
                  isMobile={isMobile}
                  onChange={(v) => setNewRequest((prev) => ({ ...prev, end_date: v }))}
                />

                {workingDaysCount > 0 && (
                  <div
                    className={`text-sm p-3 rounded-md ${
                      workingDaysCount > getAvailableBalanceWithPending(newRequest.leave_type)
                        ? 'bg-red-50 text-red-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        {workingDaysCount > getAvailableBalanceWithPending(newRequest.leave_type) ? (
                          <AlertTriangle className="h-5 w-5 text-red-400" />
                        ) : (
                          <Info className="h-5 w-5 text-blue-400" />
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium"><LTR>{workingDaysCount} working days required</LTR></p>
                        <p className="mt-1">
                          <LTR>
                            {workingDaysCount > getAvailableBalanceWithPending(newRequest.leave_type)
                              ? `Insufficient balance. You have only ${getAvailableBalanceWithPending(newRequest.leave_type)} days available.`
                              : `You will have ${getAvailableBalanceWithPending(newRequest.leave_type) - workingDaysCount} days remaining after this request.`}
                          </LTR>
                        </p>
                        {officeHolidays.length > 0 && (
                          <p className="mt-1 text-xs">Note: Office holidays are automatically excluded from working days calculation.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <textarea
                    value={newRequest.reason}
                    onChange={(e) => setNewRequest((prev) => ({ ...prev, reason: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (workingDaysCount > 0 && workingDaysCount > getAvailableBalanceWithPending(newRequest.leave_type))
                  }
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - View Request Details */}
      {showViewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800">Leave Request Details</h3>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedRequest(null);
                  }}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="space-y-6">
                <div className="flex justify-center">
                  <span
                    className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusBadgeColor(
                      selectedRequest.manager_approval_status
                    )}`}
                  >
                    <div className="flex items-center space-x-2">
                      {selectedRequest.manager_approval_status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : selectedRequest.manager_approval_status === 'rejected' ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                      <span>{formatStatus(selectedRequest.manager_approval_status)}</span>
                    </div>
                  </span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Leave Type</p>
                      <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">
                        {selectedRequest.leave_type} Leave
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-blue-500" />
                  </div>
                </div>

                {/* ✅ Mobile/RTL-safe date rendering inside modal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">Start Date</p>
                    <p className="mt-1 text-base text-gray-900">
                      <DateDisplay value={selectedRequest.start_date} />
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500">End Date</p>
                    <p className="mt-1 text-base text-gray-900">
                      <DateDisplay value={selectedRequest.end_date} />
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">Working Days</p>
                      <p className="mt-1 text-2xl font-bold text-blue-900">
                        <LTR>{calculateWorkingDays(selectedRequest.start_date, selectedRequest.end_date)}</LTR>
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Reason</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-base text-gray-900">{selectedRequest.reason}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Manager Status</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700">
                      Status: {formatStatus(selectedRequest.manager_approval_status)}
                    </p>
                    {selectedRequest.manager_comments && (
                      <p className="text-sm text-gray-600 mt-1">Comments: {selectedRequest.manager_comments}</p>
                    )}
                  </div>
                </div>

                {activeTab === 'team' && selectedRequest.manager_approval_status === 'pending' && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Your Action</p>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => showConfirmation(selectedRequest.id, 'approve', selectedRequest)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => showConfirmation(selectedRequest.id, 'reject', selectedRequest)}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRequest(null);
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmation.show && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {confirmation.action === 'approve' ? 'Approve Leave Request?' : 'Reject Leave Request?'}
            </h3>

            <p className="text-sm text-gray-500 mb-4">
              {confirmation.action === 'approve'
                ? `Are you sure you want to approve this ${confirmation.leaveType} leave request for ${confirmation.workingDays} working days?`
                : `Are you sure you want to reject this ${confirmation.leaveType} leave request?`}
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() =>
                  setConfirmation({
                    show: false,
                    requestId: '',
                    action: 'approve',
                    workingDays: 0,
                    leaveType: '',
                    request: undefined,
                  })
                }
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (!confirmation.request) {
                    setError('Leave request not found.');
                    return;
                  }
                  handleApproval(confirmation.action === 'approve', confirmation.request);
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  confirmation.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                }`}
                disabled={isSubmitting}
                type="button"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                ) : confirmation.action === 'approve' ? (
                  'Approve'
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
