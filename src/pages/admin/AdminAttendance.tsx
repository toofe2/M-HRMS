import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Clock,
  Save,
  Download,
  Edit,
  Fingerprint,
  User,
  Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmployeeProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  check_in_latitude: number;
  check_in_longitude: number;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  outside_zone_place?: string | null;
  outside_zone_note?: string | null;
  fingerprint_data?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  updated_at?: string | null;
  employee: EmployeeProfile;
}

interface AttendanceAdjustmentRequest {
  id: string;
  employee_id: string;
  attendance_record_id: string | null;
  request_type: 'check_in' | 'check_out';
  current_time?: string | null;
  original_time?: string | null;
  requested_time: string;
  reason: string;
  request_place?: string | null;
  request_note?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  employee?: EmployeeProfile;
  attendance_record?: Pick<AttendanceRecord, 'id' | 'check_in_time' | 'check_out_time' | 'status' | 'outside_zone_place' | 'outside_zone_note'> | null;
}

interface AttendanceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
  description?: string | null;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatDateTimeInput(value?: string | null) {
  const d = value ? new Date(value) : new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'inside_zone':
      return 'bg-green-100 text-green-800';
    case 'outside_zone':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-blue-100 text-blue-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function AdminAttendance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [adjustmentRequests, setAdjustmentRequests] = useState<AttendanceAdjustmentRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('pending');
  const [smartFilter, setSmartFilter] = useState<'all' | 'needs_review' | 'outside_zone' | 'missing_checkout'>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<AttendanceZone | null>(null);
  const [newZone, setNewZone] = useState<Partial<AttendanceZone>>({
    name: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
    is_active: true,
    description: '',
  });
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [fingerprintData, setFingerprintData] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTimeEditModal, setShowTimeEditModal] = useState(false);
  const [editCheckInTime, setEditCheckInTime] = useState('');
  const [editCheckOutTime, setEditCheckOutTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [exportConfig, setExportConfig] = useState({
    type: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'csv',
    includeLocation: true,
    includeFingerprint: false,
    includeOutsideZoneDetails: true,
  });

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [dateRange, statusFilter]);

  useEffect(() => {
    fetchAdjustmentRequests();
  }, [requestStatusFilter]);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase.from('attendance_zones').select('*').order('name');
      if (error) throw error;
      setZones(data || []);
    } catch (fetchError: any) {
      console.error('Error fetching zones:', fetchError);
      setError(fetchError.message);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const startDate = new Date(dateRange.start).toISOString().split('T')[0];
      const endDate = new Date(dateRange.end).toISOString().split('T')[0];

      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          employee:profiles!attendance_records_employee_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .gte('check_in_time', `${startDate}T00:00:00`)
        .lte('check_in_time', `${endDate}T23:59:59`)
        .order('check_in_time', { ascending: false });

      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;
      setRecords((data as AttendanceRecord[]) || []);
    } catch (fetchError: any) {
      console.error('Error fetching records:', fetchError);
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdjustmentRequests = async () => {
    try {
      setRequestsLoading(true);
      setError(null);
      let query = supabase
        .from('attendance_adjustment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (requestStatusFilter) query = query.eq('status', requestStatusFilter);

      const { data, error } = await query;
      if (error) throw error;

      const raw = (data || []) as AttendanceAdjustmentRequest[];
      if (raw.length === 0) {
        setAdjustmentRequests([]);
        return;
      }

      const employeeIds = Array.from(new Set(raw.map((r) => r.employee_id).filter(Boolean)));
      const recordIds = Array.from(new Set(raw.map((r) => r.attendance_record_id).filter(Boolean))) as string[];

      const [{ data: employeesData, error: employeesError }, { data: recordsData, error: recordsError }] = await Promise.all([
        employeeIds.length ? supabase.from('profiles').select('id, first_name, last_name, email').in('id', employeeIds) : Promise.resolve({ data: [], error: null } as any),
        recordIds.length ? supabase.from('attendance_records').select('id, check_in_time, check_out_time, status, outside_zone_place, outside_zone_note').in('id', recordIds) : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (employeesError) throw employeesError;
      if (recordsError) throw recordsError;

      const employeeMap = new Map<string, EmployeeProfile>((employeesData || []).map((item: EmployeeProfile) => [item.id, item]));
      const recordMap = new Map<string, any>((recordsData || []).map((item: any) => [item.id, item]));

      const hydrated = raw.map((item) => ({
        ...item,
        employee: employeeMap.get(item.employee_id),
        attendance_record: item.attendance_record_id ? recordMap.get(item.attendance_record_id) || null : null,
      }));

      setAdjustmentRequests(hydrated);
    } catch (fetchError: any) {
      console.error('Error fetching adjustment requests:', fetchError);
      setError(fetchError.message);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleStatusUpdate = async (recordId: string, newStatus: string) => {
    try {
      setError(null);
      setSuccess(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const { error } = await supabase
        .from('attendance_records')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', recordId);

      if (error) throw error;

      setRecords((prev) => prev.map((record) => record.id === recordId ? { ...record, status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: user.id } : record));
      setSuccess(`Record ${newStatus} successfully`);
    } catch (updateError: any) {
      console.error('Error updating record:', updateError);
      setError(updateError.message);
    }
  };

  const handleAdjustmentReview = async (request: AttendanceAdjustmentRequest, newStatus: 'approved' | 'rejected') => {
    try {
      setError(null);
      setSuccess(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const reviewNote = window.prompt(
        newStatus === 'approved' ? 'Approval note (optional):' : 'Rejection reason (optional):',
        request.review_note || ''
      ) ?? '';

      if (newStatus === 'approved' && request.attendance_record_id) {
        const recordUpdate = request.request_type === 'check_in'
          ? { check_in_time: request.requested_time, updated_at: new Date().toISOString() }
          : { check_out_time: request.requested_time, updated_at: new Date().toISOString() };

        const { error: recordError } = await supabase
          .from('attendance_records')
          .update(recordUpdate)
          .eq('id', request.attendance_record_id);

        if (recordError) throw recordError;
      }

      const { error: requestError } = await supabase
        .from('attendance_adjustment_requests')
        .update({
          status: newStatus,
          review_note: reviewNote || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (requestError) throw requestError;

      setSuccess(`Adjustment request ${newStatus} successfully`);
      await Promise.all([fetchRecords(), fetchAdjustmentRequests()]);
    } catch (reviewError: any) {
      console.error('Error reviewing adjustment request:', reviewError);
      setError(reviewError.message);
    }
  };

  const handleSaveZone = async () => {
    try {
      setError(null);
      setSuccess(null);
      if (!newZone.name || !newZone.latitude || !newZone.longitude || !newZone.radius) {
        throw new Error('All fields are required');
      }

      if (selectedZone) {
        const { error } = await supabase
          .from('attendance_zones')
          .update({
            name: newZone.name,
            description: newZone.description,
            latitude: newZone.latitude,
            longitude: newZone.longitude,
            radius: newZone.radius,
            is_active: newZone.is_active,
          })
          .eq('id', selectedZone.id);
        if (error) throw error;
        setSuccess('Zone updated successfully');
      } else {
        const { error } = await supabase.from('attendance_zones').insert([newZone]);
        if (error) throw error;
        setSuccess('Zone created successfully');
      }

      setShowSettingsModal(false);
      setSelectedZone(null);
      fetchZones();
    } catch (saveError: any) {
      console.error('Error saving zone:', saveError);
      setError(saveError.message);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;
    try {
      const { error } = await supabase.from('attendance_zones').delete().eq('id', zoneId);
      if (error) throw error;
      setSuccess('Zone deleted successfully');
      fetchZones();
    } catch (deleteError: any) {
      console.error('Error deleting zone:', deleteError);
      setError(deleteError.message);
    }
  };

  const handleFingerprintEdit = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setFingerprintData(record.fingerprint_data || '');
    setShowFingerprintModal(true);
  };

  const handleSaveFingerprint = async () => {
    if (!selectedRecord) return;
    try {
      setError(null);
      setSuccess(null);
      const { error } = await supabase
        .from('attendance_records')
        .update({
          fingerprint_data: fingerprintData || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRecord.id);
      if (error) throw error;
      setSuccess('Fingerprint data updated successfully');
      setShowFingerprintModal(false);
      fetchRecords();
    } catch (saveError: any) {
      console.error('Error updating fingerprint:', saveError);
      setError(saveError.message);
    }
  };

  const openTimeEditModal = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setEditCheckInTime(formatDateTimeInput(record.check_in_time));
    setEditCheckOutTime(record.check_out_time ? formatDateTimeInput(record.check_out_time) : '');
    setEditReason('');
    setShowTimeEditModal(true);
  };

  const handleSaveTimeEdit = async () => {
    if (!selectedRecord) return;
    try {
      setError(null);
      setSuccess(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      };

      if (editCheckInTime) payload.check_in_time = new Date(editCheckInTime).toISOString();
      payload.check_out_time = editCheckOutTime ? new Date(editCheckOutTime).toISOString() : null;

      const { error } = await supabase.from('attendance_records').update(payload).eq('id', selectedRecord.id);
      if (error) throw error;

      if (editReason.trim()) {
        await supabase.from('attendance_adjustment_requests').insert([{ 
          employee_id: selectedRecord.employee_id,
          attendance_record_id: selectedRecord.id,
          request_type: 'check_out',
          current_time: selectedRecord.check_out_time,
          requested_time: payload.check_out_time || payload.check_in_time,
          reason: `Admin manual edit: ${editReason.trim()}`,
          request_note: editReason.trim(),
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_note: 'Created automatically from admin direct edit',
        }]).then(() => undefined).catch(() => undefined);
      }

      setShowTimeEditModal(false);
      setSuccess('Attendance times updated successfully');
      fetchRecords();
      fetchAdjustmentRequests();
    } catch (saveError: any) {
      console.error('Error updating attendance times:', saveError);
      setError(saveError.message);
    }
  };

  const generateExportData = async () => {
    try {
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          employee:profiles!attendance_records_employee_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .gte('check_in_time', `${exportConfig.startDate}T00:00:00`)
        .lte('check_in_time', `${exportConfig.endDate}T23:59:59`)
        .order('check_in_time', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data as AttendanceRecord[]) || [];
    } catch (exportError: any) {
      console.error('Error generating export data:', exportError);
      setError(exportError.message);
      return [];
    }
  };

  const handleExport = async () => {
    try {
      setError(null);
      setSuccess(null);
      const data = await generateExportData();
      if (data.length === 0) {
        setError('No data found for the selected date range');
        return;
      }

      const headers = ['Date', 'Employee Name', 'Email', 'Check In Time', 'Check Out Time', 'Status'];
      if (exportConfig.includeLocation) headers.push('Check In Location', 'Check Out Location');
      if (exportConfig.includeOutsideZoneDetails) headers.push('Outside Zone Place', 'Outside Zone Note');
      if (exportConfig.includeFingerprint) headers.push('Fingerprint Status');

      const csvContent = [
        headers.join(','),
        ...data.map((record) => {
          const row = [
            new Date(record.check_in_time).toLocaleDateString(),
            `"${record.employee?.first_name || ''} ${record.employee?.last_name || ''}"`,
            record.employee?.email || '',
            formatDateTime(record.check_in_time),
            formatDateTime(record.check_out_time),
            record.status,
          ];

          if (exportConfig.includeLocation) {
            row.push(
              `"${record.check_in_latitude}, ${record.check_in_longitude}"`,
              record.check_out_latitude && record.check_out_longitude ? `"${record.check_out_latitude}, ${record.check_out_longitude}"` : 'N/A'
            );
          }
          if (exportConfig.includeOutsideZoneDetails) {
            row.push(`"${record.outside_zone_place || ''}"`, `"${record.outside_zone_note || ''}"`);
          }
          if (exportConfig.includeFingerprint) row.push(record.fingerprint_data ? 'Available' : 'Not Available');
          return row.join(',');
        }),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance-report-${exportConfig.startDate}-to-${exportConfig.endDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportModal(false);
      setSuccess('Report exported successfully');
    } catch (exportError: any) {
      console.error('Error exporting data:', exportError);
      setError(exportError.message);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const searchString = `${record.employee?.first_name || ''} ${record.employee?.last_name || ''} ${record.employee?.email || ''} ${record.outside_zone_place || ''} ${record.outside_zone_note || ''}`.toLowerCase();
      if (!searchString.includes(searchTerm.toLowerCase())) return false;
      if (smartFilter === 'outside_zone' && record.status !== 'outside_zone') return false;
      if (smartFilter === 'missing_checkout' && !!record.check_out_time) return false;
      if (smartFilter === 'needs_review' && !(record.status === 'outside_zone' || !record.check_out_time)) return false;
      return true;
    });
  }, [records, searchTerm, smartFilter]);

  const filteredRequests = useMemo(() => {
    return adjustmentRequests.filter((request) => {
      const text = `${request.employee?.first_name || ''} ${request.employee?.last_name || ''} ${request.employee?.email || ''} ${request.reason || ''} ${request.request_place || ''} ${request.request_note || ''}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    });
  }, [adjustmentRequests, searchTerm]);

  const summary = useMemo(() => ({
    total: records.length,
    outsideZone: records.filter((r) => r.status === 'outside_zone').length,
    missingCheckout: records.filter((r) => !r.check_out_time).length,
    pendingRequests: adjustmentRequests.filter((r) => r.status === 'pending').length,
  }), [records, adjustmentRequests]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button onClick={() => navigate('/admin/settings')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Admin Settings
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedZone(null);
                setNewZone({ name: '', latitude: 0, longitude: 0, radius: 100, is_active: true, description: '' });
                setShowSettingsModal(true);
              }}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Attendance Settings
            </button>
            <button onClick={() => setShowExportModal(true)} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5 border"><p className="text-sm text-gray-500">Attendance Records</p><p className="mt-2 text-3xl font-bold text-gray-900">{summary.total}</p></div>
          <div className="bg-white rounded-xl shadow-sm p-5 border"><p className="text-sm text-gray-500">Outside Zone</p><p className="mt-2 text-3xl font-bold text-amber-600">{summary.outsideZone}</p></div>
          <div className="bg-white rounded-xl shadow-sm p-5 border"><p className="text-sm text-gray-500">Missing Check-out</p><p className="mt-2 text-3xl font-bold text-rose-600">{summary.missingCheckout}</p></div>
          <div className="bg-white rounded-xl shadow-sm p-5 border"><p className="text-sm text-gray-500">Pending Adjustment Requests</p><p className="mt-2 text-3xl font-bold text-blue-600">{summary.pendingRequests}</p></div>
        </div>

        {(error || success) && (
          <div className={`mb-6 p-4 rounded-lg ${error ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className="flex items-start">
              {error ? <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5" />}
              <p className={`ml-3 text-sm ${error ? 'text-red-800' : 'text-green-800'}`}>{error || success}</p>
            </div>
          </div>
        )}

        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Attendance Management</h2>
            <p className="mt-1 text-sm text-gray-500">Review attendance, outside-zone submissions, missing check-outs, and direct time edits</p>
          </div>

          <div className="p-6">
            <div className="mb-6 grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee, place, note..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <input type="date" value={dateRange.start} onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))} className="border border-gray-300 rounded-lg px-4 py-2" />
                <input type="date" value={dateRange.end} onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))} className="border border-gray-300 rounded-lg px-4 py-2" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2">
                  <option value="">All Statuses</option>
                  <option value="inside_zone">Inside Zone</option>
                  <option value="outside_zone">Outside Zone</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={smartFilter} onChange={(e) => setSmartFilter(e.target.value as any)} className="border border-gray-300 rounded-lg px-4 py-2">
                  <option value="all">All Records</option>
                  <option value="needs_review">Needs Review</option>
                  <option value="outside_zone">Outside Zone Only</option>
                  <option value="missing_checkout">Missing Check-out</option>
                </select>
                <button onClick={() => { fetchRecords(); fetchAdjustmentRequests(); }} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Refresh</button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Place / Note</th>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fingerprint</th>
                      <th className="px-5 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Smart Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.length === 0 ? (
                      <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">No attendance records found for the current filters.</td></tr>
                    ) : filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 align-top">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{record.employee?.first_name} {record.employee?.last_name}</div>
                          <div className="text-sm text-gray-500">{record.employee?.email}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{formatDateTime(record.check_in_time)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{formatDateTime(record.check_out_time)}</td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div>
                              <div>In: {record.check_in_latitude?.toFixed?.(6)}, {record.check_in_longitude?.toFixed?.(6)}</div>
                              <div className="text-xs text-gray-500 mt-1">Out: {record.check_out_latitude && record.check_out_longitude ? `${record.check_out_latitude.toFixed(6)}, ${record.check_out_longitude.toFixed(6)}` : '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {record.outside_zone_place || record.outside_zone_note ? (
                            <div className="max-w-xs">
                              <p className="font-medium text-gray-900">{record.outside_zone_place || '-'}</p>
                              <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{record.outside_zone_note || 'No note'}</p>
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(record.status)}`}>
                            {record.status.replace('_', ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Fingerprint className={`h-4 w-4 mr-2 ${record.fingerprint_data ? 'text-green-500' : 'text-gray-400'}`} />
                            <span className={`text-sm ${record.fingerprint_data ? 'text-green-600' : 'text-gray-500'}`}>{record.fingerprint_data ? 'Available' : 'Not Available'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end flex-wrap gap-2">
                            <button onClick={() => { setSelectedRecord(record); setShowDetailsModal(true); }} className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200" title="View details"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => openTimeEditModal(record)} className="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200" title="Edit times"><Clock className="h-4 w-4" /></button>
                            <button onClick={() => handleFingerprintEdit(record)} className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" title="Edit fingerprint"><Edit className="h-4 w-4" /></button>
                            {record.status === 'outside_zone' && (
                              <>
                                <button onClick={() => handleStatusUpdate(record.id, 'approved')} className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200" title="Approve outside-zone"><CheckCircle2 className="h-4 w-4" /></button>
                                <button onClick={() => handleStatusUpdate(record.id, 'rejected')} className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200" title="Reject outside-zone"><XCircle className="h-4 w-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Adjustment Requests</h2>
              <p className="mt-1 text-sm text-gray-500">Approve or reject employee requests to change check-in or check-out times</p>
            </div>
            <select value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </select>
          </div>

          <div className="p-6">
            {requestsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" /></div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-sm text-gray-500">No adjustment requests found.</div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="border rounded-xl p-5 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-3">
                        <p className="text-sm font-semibold text-gray-900">{request.employee?.first_name} {request.employee?.last_name}</p>
                        <p className="text-sm text-gray-500">{request.employee?.email}</p>
                        <div className="mt-2 inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-white border text-gray-700">{request.request_type === 'check_in' ? 'Check-in edit' : 'Check-out edit'}</div>
                      </div>
                      <div className="lg:col-span-3 text-sm text-gray-700">
                        <p><span className="font-medium">Current:</span> {formatDateTime(request.current_time || request.original_time)}</p>
                        <p className="mt-1"><span className="font-medium">Requested:</span> {formatDateTime(request.requested_time)}</p>
                        <p className="mt-1"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(request.status)}`}>{request.status}</span></p>
                      </div>
                      <div className="lg:col-span-3 text-sm text-gray-700">
                        <p><span className="font-medium">Reason:</span> {request.reason}</p>
                        <p className="mt-1"><span className="font-medium">Place:</span> {request.request_place || request.attendance_record?.outside_zone_place || '-'}</p>
                        <p className="mt-1"><span className="font-medium">Note:</span> {request.request_note || request.attendance_record?.outside_zone_note || '-'}</p>
                      </div>
                      <div className="lg:col-span-3 flex flex-col items-start lg:items-end gap-2">
                        <p className="text-xs text-gray-500">Requested on {formatDateTime(request.created_at)}</p>
                        {request.review_note && <p className="text-xs text-gray-500 text-left lg:text-right max-w-xs">Review note: {request.review_note}</p>}
                        <div className="flex gap-2">
                          {request.status === 'pending' ? (
                            <>
                              <button onClick={() => handleAdjustmentReview(request, 'approved')} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Approve</button>
                              <button onClick={() => handleAdjustmentReview(request, 'rejected')} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Reject</button>
                            </>
                          ) : (
                            <div className="text-xs text-gray-500">Reviewed {formatDateTime(request.reviewed_at)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Attendance Tracking Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="space-y-6">
              {zones.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Existing Zones</h4>
                  <div className="space-y-4">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h5 className="font-medium text-gray-900">{zone.name}</h5>
                          <p className="text-sm text-gray-500">{zone.latitude}, {zone.longitude} ({zone.radius}m radius)</p>
                          {zone.description && <p className="text-xs text-gray-400 mt-1">{zone.description}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => { setSelectedZone(zone); setNewZone(zone); }} className="p-2 text-blue-600 hover:text-blue-800"><Settings className="h-5 w-5" /></button>
                          <button onClick={() => handleDeleteZone(zone.id)} className="p-2 text-red-600 hover:text-red-800"><XCircle className="h-5 w-5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">{selectedZone ? 'Edit Zone' : 'Add New Zone'}</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Office Name</label>
                  <input type="text" value={newZone.name || ''} onChange={(e) => setNewZone((prev) => ({ ...prev, name: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="Main Office" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input type="text" value={newZone.description || ''} onChange={(e) => setNewZone((prev) => ({ ...prev, description: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="Optional description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Latitude</label>
                    <input type="number" step="any" value={newZone.latitude || ''} onChange={(e) => setNewZone((prev) => ({ ...prev, latitude: parseFloat(e.target.value) }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="25.197197" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Longitude</label>
                    <input type="number" step="any" value={newZone.longitude || ''} onChange={(e) => setNewZone((prev) => ({ ...prev, longitude: parseFloat(e.target.value) }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="55.274376" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Radius (meters)</label>
                  <input type="number" value={newZone.radius || ''} onChange={(e) => setNewZone((prev) => ({ ...prev, radius: parseInt(e.target.value, 10) }))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="100" />
                </div>
                <div className="flex items-center">
                  <input type="checkbox" checked={!!newZone.is_active} onChange={(e) => setNewZone((prev) => ({ ...prev, is_active: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                  <label className="ml-2 block text-sm text-gray-900">Active Zone</label>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setShowSettingsModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500">Cancel</button>
              <button onClick={handleSaveZone} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"><Save className="h-4 w-4 inline-block mr-2" />Save Zone</button>
            </div>
          </div>
        </div>
      )}

      {showFingerprintModal && selectedRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Fingerprint Data</h3>
              <button onClick={() => setShowFingerprintModal(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2"><User className="h-5 w-5 text-gray-400 mr-2" /><span className="font-medium text-gray-900">{selectedRecord.employee.first_name} {selectedRecord.employee.last_name}</span></div>
                <div className="flex items-center text-sm text-gray-500"><Clock className="h-4 w-4 mr-2" />{new Date(selectedRecord.check_in_time).toLocaleString()}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fingerprint Data</label>
                <textarea value={fingerprintData} onChange={(e) => setFingerprintData(e.target.value)} rows={4} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Enter fingerprint data or leave empty to remove" />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => setShowFingerprintModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500">Cancel</button>
              <button onClick={handleSaveFingerprint} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"><Save className="h-4 w-4 inline-block mr-2" />Save Fingerprint</button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Attendance Details</h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="rounded-lg border p-4"><p className="text-gray-500">Employee</p><p className="font-semibold text-gray-900 mt-1">{selectedRecord.employee.first_name} {selectedRecord.employee.last_name}</p><p className="mt-1">{selectedRecord.employee.email}</p></div>
              <div className="rounded-lg border p-4"><p className="text-gray-500">Status</p><div className="mt-2"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(selectedRecord.status)}`}>{selectedRecord.status.replace('_', ' ')}</span></div></div>
              <div className="rounded-lg border p-4"><p className="text-gray-500">Check In</p><p className="font-semibold text-gray-900 mt-1">{formatDateTime(selectedRecord.check_in_time)}</p></div>
              <div className="rounded-lg border p-4"><p className="text-gray-500">Check Out</p><p className="font-semibold text-gray-900 mt-1">{formatDateTime(selectedRecord.check_out_time)}</p></div>
              <div className="rounded-lg border p-4"><p className="text-gray-500">Check In Location</p><p className="font-semibold text-gray-900 mt-1">{selectedRecord.check_in_latitude}, {selectedRecord.check_in_longitude}</p></div>
              <div className="rounded-lg border p-4"><p className="text-gray-500">Check Out Location</p><p className="font-semibold text-gray-900 mt-1">{selectedRecord.check_out_latitude && selectedRecord.check_out_longitude ? `${selectedRecord.check_out_latitude}, ${selectedRecord.check_out_longitude}` : '-'}</p></div>
              <div className="rounded-lg border p-4 md:col-span-2 bg-amber-50 border-amber-200"><p className="text-gray-500">Outside Zone Details</p><p className="font-semibold text-gray-900 mt-1">{selectedRecord.outside_zone_place || '-'}</p><p className="mt-2 whitespace-pre-wrap">{selectedRecord.outside_zone_note || '-'}</p></div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => openTimeEditModal(selectedRecord)} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"><Clock className="h-4 w-4 inline-block mr-2" />Edit Times</button>
            </div>
          </div>
        </div>
      )}

      {showTimeEditModal && selectedRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-xl w-full p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-gray-900">Direct Attendance Time Edit</h3>
              <button onClick={() => setShowTimeEditModal(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check In Time</label>
                <input type="datetime-local" value={editCheckInTime} onChange={(e) => setEditCheckInTime(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Out Time</label>
                <input type="datetime-local" value={editCheckOutTime} onChange={(e) => setEditCheckOutTime(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note / Reason</label>
                <textarea rows={4} value={editReason} onChange={(e) => setEditReason(e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" placeholder="Write why you changed the time" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowTimeEditModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500">Cancel</button>
              <button onClick={handleSaveTimeEdit} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"><Save className="h-4 w-4 inline-block mr-2" />Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-medium text-gray-900">Export Attendance Report</h3><button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={exportConfig.startDate} onChange={(e) => setExportConfig((prev) => ({ ...prev, startDate: e.target.value }))} className="w-full rounded-md border-gray-300 shadow-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" value={exportConfig.endDate} onChange={(e) => setExportConfig((prev) => ({ ...prev, endDate: e.target.value }))} className="w-full rounded-md border-gray-300 shadow-sm" /></div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center"><input type="checkbox" checked={exportConfig.includeLocation} onChange={(e) => setExportConfig((prev) => ({ ...prev, includeLocation: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /><span className="ml-2 text-sm text-gray-900">Include location data</span></label>
                <label className="flex items-center"><input type="checkbox" checked={exportConfig.includeOutsideZoneDetails} onChange={(e) => setExportConfig((prev) => ({ ...prev, includeOutsideZoneDetails: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /><span className="ml-2 text-sm text-gray-900">Include outside-zone place and note</span></label>
                <label className="flex items-center"><input type="checkbox" checked={exportConfig.includeFingerprint} onChange={(e) => setExportConfig((prev) => ({ ...prev, includeFingerprint: e.target.checked }))} className="h-4 w-4 text-blue-600 border-gray-300 rounded" /><span className="ml-2 text-sm text-gray-900">Include fingerprint status</span></label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500">Cancel</button><button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"><Download className="h-4 w-4 inline-block mr-2" />Export Report</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
