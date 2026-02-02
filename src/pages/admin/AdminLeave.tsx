import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Plus,
  Settings,
  Users,
  BarChart3,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  UserCheck,
  TrendingUp,
  Database
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  manager_approval_status: 'pending' | 'approved' | 'rejected';
  manager_comments?: string;
  created_at: string;
  employee: {
    first_name: string;
    last_name: string;
    email: string;
    departments?: {
      name: string;
    };
  };
}

interface LeaveStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalDaysRequested: number;
  totalDaysApproved: number;
  byLeaveType: { [key: string]: number };
  byDepartment: { [key: string]: number };
}

const leaveManagementModules = [
  {
    title: 'Leave Types',
    description: 'Configure leave types and policies',
    icon: Settings,
    path: '/admin/leave/settings',
    color: 'bg-blue-500',
    stats: 'Configure'
  },
  {
    title: 'Employee Balances',
    description: 'Manage individual employee leave balances',
    icon: Users,
    path: '/admin/leave/employee-leave',
    color: 'bg-green-500',
    stats: 'Manage'
  },
  {
    title: 'Leave Reports',
    description: 'Analytics and reporting dashboard',
    icon: BarChart3,
    path: '/admin/leave/reports',
    color: 'bg-purple-500',
    stats: 'Analyze'
  },
  {
    title: 'Bulk Operations',
    description: 'Perform bulk leave balance operations',
    icon: Database,
    path: '/admin/leave/bulk-operations',
    color: 'bg-orange-500',
    stats: 'Execute'
  }
];

export default function AdminLeave() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<LeaveStats>({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalDaysRequested: 0,
    totalDaysApproved: 0,
    byLeaveType: {},
    byDepartment: {}
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchLeaveRequests();
  }, [statusFilter, leaveTypeFilter, dateRange]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          employee:profiles!leave_requests_employee_id_fkey (
            first_name,
            last_name,
            email,
            departments:profiles_department_id_fkey (
              name
            )
          )
        `)
        .gte('start_date', dateRange.start)
        .lte('end_date', dateRange.end)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (leaveTypeFilter) {
        query = query.eq('leave_type', leaveTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLeaveRequests(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (requests: LeaveRequest[]) => {
    const stats: LeaveStats = {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      approvedRequests: requests.filter(r => r.status === 'approved').length,
      rejectedRequests: requests.filter(r => r.status === 'rejected').length,
      totalDaysRequested: requests.reduce((sum, r) => sum + (r.working_days || 0), 0),
      totalDaysApproved: requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.working_days || 0), 0),
      byLeaveType: {},
      byDepartment: {}
    };

    // Calculate by leave type
    requests.forEach(request => {
      stats.byLeaveType[request.leave_type] = (stats.byLeaveType[request.leave_type] || 0) + 1;
    });

    // Calculate by department
    requests.forEach(request => {
      const deptName = request.employee.departments?.name || 'Unknown';
      stats.byDepartment[deptName] = (stats.byDepartment[deptName] || 0) + 1;
    });

    setStats(stats);
  };

  const handleApproval = async (requestId: string, approved: boolean, comments?: string) => {
    try {
      setProcessing(true);
      setError(null);

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          manager_approval_status: approved ? 'approved' : 'rejected',
          manager_comments: comments || (approved ? 'Approved by admin' : 'Rejected by admin'),
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      setSuccess(`Request ${approved ? 'approved' : 'rejected'} successfully`);
      fetchLeaveRequests();
    } catch (error: any) {
      console.error('Error updating request:', error);
      setError(error.message);
    } finally {
      setProcessing(false);
    }
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const filteredRequests = leaveRequests.filter(request => {
    const searchString = `${request.employee.first_name} ${request.employee.last_name} ${request.employee.email}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const StatCard = ({ title, value, icon: Icon, color, subtitle }: {
    title: string;
    value: number | string;
    icon: React.ElementType;
    color: string;
    subtitle?: string;
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

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
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Leave Management System</h2>
            <p className="mt-1 text-sm text-gray-500">
              Complete administrative control over employee leave management
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
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Requests"
                value={stats.totalRequests}
                icon={FileText}
                color="bg-blue-500"
                subtitle="All time"
              />
              <StatCard
                title="Pending Approval"
                value={stats.pendingRequests}
                icon={Clock}
                color="bg-yellow-500"
                subtitle="Needs attention"
              />
              <StatCard
                title="Days Approved"
                value={stats.totalDaysApproved}
                icon={Calendar}
                color="bg-green-500"
                subtitle="This period"
              />
              <StatCard
                title="Approval Rate"
                value={stats.totalRequests > 0 ? `${Math.round((stats.approvedRequests / stats.totalRequests) * 100)}%` : '0%'}
                icon={TrendingUp}
                color="bg-purple-500"
                subtitle="Success rate"
              />
            </div>

            {/* Management Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {leaveManagementModules.map((module) => (
                <div
                  key={module.path}
                  onClick={() => navigate(module.path)}
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                >
                  <div className="p-6">
                    <div className={`inline-flex p-3 rounded-lg ${module.color} mb-4`}>
                      <module.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {module.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {module.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {module.stats}
                      </span>
                      <div className="text-blue-600">
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters and Search */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Employees
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Leave Type
                  </label>
                  <select
                    value={leaveTypeFilter}
                    onChange={(e) => setLeaveTypeFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="personal">Personal Leave</option>
                    <option value="maternity">Maternity Leave</option>
                    <option value="emergency">Emergency Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4 space-x-2">
                <button
                  onClick={fetchLeaveRequests}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
                <button
                  onClick={() => {/* TODO: Implement export */}}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>

            {/* Leave Requests Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Leave Requests</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Review and manage employee leave requests
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No leave requests found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No leave requests match your current filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Leave Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Working Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {request.employee.first_name} {request.employee.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {request.employee.email}
                              </div>
                              <div className="text-xs text-gray-400">
                                {request.employee.departments?.name || 'No Department'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900 capitalize">
                              {request.leave_type} Leave
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <div>{new Date(request.start_date).toLocaleDateString()}</div>
                                <div className="text-xs text-gray-500">
                                  to {new Date(request.end_date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center text-sm font-medium text-gray-900">
                              <Clock className="h-4 w-4 text-gray-400 mr-2" />
                              {request.working_days || 0} days
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getStatusIcon(request.status)}
                              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(request.status)}`}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(request.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowDetailsModal(true);
                                }}
                                className="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {request.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproval(request.id, true)}
                                    disabled={processing}
                                    className="p-1 bg-green-100 text-green-600 rounded-full hover:bg-green-200 disabled:opacity-50"
                                    title="Approve"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleApproval(request.id, false)}
                                    disabled={processing}
                                    className="p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 disabled:opacity-50"
                                    title="Reject"
                                  >
                                    <XCircle className="h-4 w-4" />
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
      </div>

      {/* Request Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Leave Request Details</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedRequest(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Employee Information</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900">
                      {selectedRequest.employee.first_name} {selectedRequest.employee.last_name}
                    </p>
                    <p className="text-sm text-gray-600">{selectedRequest.employee.email}</p>
                    <p className="text-sm text-gray-500">
                      {selectedRequest.employee.departments?.name || 'No Department'}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Request Status</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      {getStatusIcon(selectedRequest.status)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(selectedRequest.status)}`}>
                        {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Submitted: {new Date(selectedRequest.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Leave Details</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Leave Type</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {selectedRequest.leave_type} Leave
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Working Days</p>
                      <p className="font-medium text-gray-900">
                        {selectedRequest.working_days || 0} days
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Start Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedRequest.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">End Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(selectedRequest.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Reason</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700">
                    {selectedRequest.reason || 'No reason provided'}
                  </p>
                </div>
              </div>

              {selectedRequest.manager_comments && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Manager Comments</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700">{selectedRequest.manager_comments}</p>
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      handleApproval(selectedRequest.id, false, 'Rejected by admin');
                      setShowDetailsModal(false);
                    }}
                    disabled={processing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => {
                      handleApproval(selectedRequest.id, true, 'Approved by admin');
                      setShowDetailsModal(false);
                    }}
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve Request
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}