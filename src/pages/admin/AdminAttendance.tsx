import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Search,
  Calendar,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  Settings,
  Clock,
  Save,
  Download,
  Edit,
  Fingerprint,
  FileText,
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
  fingerprint_data?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface AttendanceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
}

export default function AdminAttendance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<AttendanceZone | null>(null);
  const [newZone, setNewZone] = useState<Partial<AttendanceZone>>({
    name: '',
    latitude: 0,
    longitude: 0,
    radius: 100,
    is_active: true
  });
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [fingerprintData, setFingerprintData] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    type: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'csv',
    includeLocation: true,
    includeFingerprint: false
  });

  useEffect(() => {
    fetchRecords();
    fetchZones();
  }, [dateRange, statusFilter]);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_zones')
        .select('*')
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (error: any) {
      console.error('Error fetching zones:', error);
      setError(error.message);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const startDate = new Date(dateRange.start).toISOString().split('T')[0];
      const endDate = new Date(dateRange.end).toISOString().split('T')[0];

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
        .gte('check_in_time', `${startDate}T00:00:00`)
        .lte('check_in_time', `${endDate}T23:59:59`)
        .order('check_in_time', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error: any) {
      console.error('Error fetching records:', error);
      setError(error.message);
    } finally {
      setLoading(false);
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
          reviewed_by: user.id
        })
        .eq('id', recordId);

      if (error) throw error;

      // Update the local state to reflect the change
      setRecords(prevRecords => 
        prevRecords.map(record => 
          record.id === recordId 
            ? { ...record, status: newStatus }
            : record
        )
      );

      setSuccess(`Record ${newStatus} successfully`);
    } catch (error: any) {
      console.error('Error updating record:', error);
      setError(error.message);
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
        // Update existing zone
        const { error } = await supabase
          .from('attendance_zones')
          .update({
            name: newZone.name,
            description: newZone.description,
            latitude: newZone.latitude,
            longitude: newZone.longitude,
            radius: newZone.radius,
            is_active: newZone.is_active
          })
          .eq('id', selectedZone.id);

        if (error) throw error;
        setSuccess('Zone updated successfully');
      } else {
        // Create new zone
        const { error } = await supabase
          .from('attendance_zones')
          .insert([newZone]);

        if (error) throw error;
        setSuccess('Zone created successfully');
      }

      setShowSettingsModal(false);
      fetchZones();
    } catch (error: any) {
      console.error('Error saving zone:', error);
      setError(error.message);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;

    try {
      const { error } = await supabase
        .from('attendance_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
      setSuccess('Zone deleted successfully');
      fetchZones();
    } catch (error: any) {
      console.error('Error deleting zone:', error);
      setError(error.message);
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
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRecord.id);

      if (error) throw error;

      setSuccess('Fingerprint data updated successfully');
      setShowFingerprintModal(false);
      fetchRecords();
    } catch (error: any) {
      console.error('Error updating fingerprint:', error);
      setError(error.message);
    }
  };

  const generateExportData = async () => {
    try {
      setError(null);
      
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          employee:profiles!attendance_records_employee_id_fkey (
            first_name,
            last_name,
            email,
            departments:profiles_department_id_fkey(name)
          )
        `)
        .gte('check_in_time', `${exportConfig.startDate}T00:00:00`)
        .lte('check_in_time', `${exportConfig.endDate}T23:59:59`)
        .order('check_in_time', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error: any) {
      console.error('Error generating export data:', error);
      setError(error.message);
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

      if (exportConfig.format === 'csv') {
        const headers = [
          'Date',
          'Employee Name',
          'Email',
          'Department',
          'Check In Time',
          'Check Out Time',
          'Status',
          'Working Hours'
        ];

        if (exportConfig.includeLocation) {
          headers.push('Check In Location', 'Check Out Location');
        }

        if (exportConfig.includeFingerprint) {
          headers.push('Fingerprint Status');
        }

        const csvContent = [
          headers.join(','),
          ...data.map(record => {
            const checkInTime = new Date(record.check_in_time);
            const checkOutTime = record.check_out_time ? new Date(record.check_out_time) : null;
            const workingHours = checkOutTime 
              ? ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)
              : '0';

            const row = [
              checkInTime.toLocaleDateString(),
              `"${record.employee.first_name} ${record.employee.last_name}"`,
              record.employee.email,
              record.employee.departments?.name || 'N/A',
              checkInTime.toLocaleTimeString(),
              checkOutTime ? checkOutTime.toLocaleTimeString() : 'Not checked out',
              record.status.replace('_', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
              workingHours + ' hours'
            ];

            if (exportConfig.includeLocation) {
              row.push(
                `"${record.check_in_latitude}, ${record.check_in_longitude}"`,
                record.check_out_latitude && record.check_out_longitude 
                  ? `"${record.check_out_latitude}, ${record.check_out_longitude}"`
                  : 'N/A'
              );
            }

            if (exportConfig.includeFingerprint) {
              row.push(record.fingerprint_data ? 'Available' : 'Not Available');
            }

            return row.join(',');
          })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `attendance-report-${exportConfig.type}-${exportConfig.startDate}-to-${exportConfig.endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSuccess(`${exportConfig.type.charAt(0).toUpperCase() + exportConfig.type.slice(1)} report exported successfully`);
      }

      setShowExportModal(false);
    } catch (error: any) {
      console.error('Error exporting data:', error);
      setError(error.message);
    }
  };

  const setQuickDateRange = (type: 'daily' | 'weekly' | 'monthly') => {
    const today = new Date();
    let startDate: Date;
    let endDate = new Date(today);

    switch (type) {
      case 'daily':
        startDate = new Date(today);
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      default:
        startDate = new Date(today);
    }

    setExportConfig(prev => ({
      ...prev,
      type,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }));
  };

  const filteredRecords = records.filter(record => {
    const searchString = `${record.employee.first_name} ${record.employee.last_name} ${record.employee.email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'inside_zone':
        return 'bg-green-100 text-green-800';
      case 'outside_zone':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Admin Settings
          </button>
          <button
            onClick={() => {
              setSelectedZone(null);
              setNewZone({
                name: '',
                latitude: 0,
                longitude: 0,
                radius: 100,
                is_active: true
              });
              setShowSettingsModal(true);
            }}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Attendance Settings
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Attendance Management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Review and manage employee attendance records
            </p>
          </div>

          {(error || success) && (
            <div className={`p-4 ${error ? 'bg-red-50' : 'bg-green-50'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error ? (
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm ${error ? 'text-red-800' : 'text-green-800'}`}>
                    {error || success}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="inside_zone">Inside Zone</option>
                  <option value="outside_zone">Outside Zone</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Check In
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Check Out
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fingerprint
                      </th>
                      <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {record.employee.first_name} {record.employee.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {record.employee.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDateTime(record.check_in_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_out_time ? formatDateTime(record.check_out_time) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                              <span>
                                {record.check_in_latitude.toFixed(6)}, {record.check_in_longitude.toFixed(6)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            getStatusBadgeColor(record.status)
                          }`}>
                            {record.status.replace('_', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Fingerprint className={`h-4 w-4 mr-2 ${
                              record.fingerprint_data ? 'text-green-500' : 'text-gray-400'
                            }`} />
                            <span className={`text-sm ${
                              record.fingerprint_data ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {record.fingerprint_data ? 'Available' : 'Not Available'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleFingerprintEdit(record)}
                              className="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                              title="Edit Fingerprint"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {record.status === 'outside_zone' && (
                              <>
                                <button
                                  onClick={() => handleStatusUpdate(record.id, 'approved')}
                                  className="p-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(record.id, 'rejected')}
                                  className="p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                                  title="Reject"
                                >
                                  <XCircle className="h-5 w-5" />
                                </button>
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
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Attendance Tracking Settings
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Existing Zones */}
              {zones.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Existing Zones</h4>
                  <div className="space-y-4">
                    {zones.map(zone => (
                      <div key={zone.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <h5 className="font-medium text-gray-900">{zone.name}</h5>
                          <p className="text-sm text-gray-500">
                            {zone.latitude}, {zone.longitude} ({zone.radius}m radius)
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedZone(zone);
                              setNewZone(zone);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-800"
                          >
                            <Settings className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(zone.id)}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Zone Form */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900">
                  {selectedZone ? 'Edit Zone' : 'Add New Zone'}
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Office Name
                  </label>
                  <input
                    type="text"
                    value={newZone.name || ''}
                    onChange={(e) => setNewZone(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Main Office"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newZone.latitude || ''}
                      onChange={(e) => setNewZone(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="25.197197"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newZone.longitude || ''}
                      onChange={(e) => setNewZone(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="55.274376"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Radius (meters)
                  </label>
                  <input
                    type="number"
                    value={newZone.radius || ''}
                    onChange={(e) => setNewZone(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="100"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newZone.is_active}
                    onChange={(e) => setNewZone(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Active Zone
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveZone}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Save className="h-4 w-4 inline-block mr-2" />
                Save Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fingerprint Edit Modal */}
      {showFingerprintModal && selectedRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Fingerprint Data</h3>
              <button
                onClick={() => setShowFingerprintModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <User className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="font-medium text-gray-900">
                    {selectedRecord.employee.first_name} {selectedRecord.employee.last_name}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-2" />
                  {new Date(selectedRecord.check_in_time).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fingerprint Data
                </label>
                <textarea
                  value={fingerprintData}
                  onChange={(e) => setFingerprintData(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter fingerprint data or leave empty to remove"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This field stores biometric fingerprint data for attendance verification
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowFingerprintModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFingerprint}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Save className="h-4 w-4 inline-block mr-2" />
                Save Fingerprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Export Attendance Report</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Report Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['daily', 'weekly', 'monthly'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setQuickDateRange(type as 'daily' | 'weekly' | 'monthly')}
                      className={`px-4 py-2 text-sm font-medium rounded-md border ${
                        exportConfig.type === type
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={exportConfig.startDate}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={exportConfig.endDate}
                    onChange={(e) => setExportConfig(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Export Options
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportConfig.includeLocation}
                      onChange={(e) => setExportConfig(prev => ({ ...prev, includeLocation: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Include Location Data
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportConfig.includeFingerprint}
                      onChange={(e) => setExportConfig(prev => ({ ...prev, includeFingerprint: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Include Fingerprint Status
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Export Format
                </label>
                <select
                  value={exportConfig.format}
                  onChange={(e) => setExportConfig(prev => ({ ...prev, format: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="csv">CSV (Excel Compatible)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Download className="h-4 w-4 inline-block mr-2" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}