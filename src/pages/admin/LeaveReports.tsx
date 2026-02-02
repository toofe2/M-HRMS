import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  BarChart3, 
  Calendar,
  Download,
  Filter,
  Users,
  PieChart,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LeaveAnalytics {
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
  byDepartment: {
    [key: string]: number;
  };
  byType: {
    [key: string]: number;
  };
  monthlyTrends: {
    [key: string]: number;
  };
}

interface Department {
  id: string;
  name: string;
}

export default function LeaveReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<LeaveAnalytics>({
    totalRequests: 0,
    approvedRequests: 0,
    pendingRequests: 0,
    rejectedRequests: 0,
    byDepartment: {},
    byType: {},
    monthlyTrends: {}
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [selectedDepartment, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch departments
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (departmentsError) throw departmentsError;
      setDepartments(departmentsData || []);

      // Fetch leave requests with filters
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          profiles:employee_id (
            department_id
          )
        `)
        .gte('start_date', dateRange.start)
        .lte('end_date', dateRange.end);

      if (selectedDepartment) {
        query = query.eq('profiles.department_id', selectedDepartment);
      }

      const { data: requests, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      // Process analytics
      const analytics: LeaveAnalytics = {
        totalRequests: requests?.length || 0,
        approvedRequests: requests?.filter(r => r.status === 'approved').length || 0,
        pendingRequests: requests?.filter(r => r.status === 'pending').length || 0,
        rejectedRequests: requests?.filter(r => r.status === 'rejected').length || 0,
        byDepartment: {},
        byType: {},
        monthlyTrends: {}
      };

      // Process by department
      requests?.forEach(request => {
        const deptId = request.profiles?.department_id;
        if (deptId) {
          analytics.byDepartment[deptId] = (analytics.byDepartment[deptId] || 0) + 1;
        }
      });

      // Process by type
      requests?.forEach(request => {
        analytics.byType[request.leave_type] = (analytics.byType[request.leave_type] || 0) + 1;
      });

      // Process monthly trends
      requests?.forEach(request => {
        const month = new Date(request.start_date).toLocaleString('default', { month: 'long' });
        analytics.monthlyTrends[month] = (analytics.monthlyTrends[month] || 0) + 1;
      });

      setAnalytics(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Exporting data...');
  };

  const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) => (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-100`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
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
            onClick={() => navigate('/admin/leave')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Leave Management
          </button>
          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </button>
        </div>

        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              title="Total Requests"
              value={analytics.totalRequests}
              icon={BarChart3}
              color="bg-blue-500"
            />
            <StatCard
              title="Approved"
              value={analytics.approvedRequests}
              icon={Calendar}
              color="bg-green-500"
            />
            <StatCard
              title="Pending"
              value={analytics.pendingRequests}
              icon={Filter}
              color="bg-yellow-500"
            />
            <StatCard
              title="Rejected"
              value={analytics.rejectedRequests}
              icon={Users}
              color="bg-red-500"
            />
          </div>

          {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Types Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Leave Types Distribution</h3>
                <PieChart className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {Object.entries(analytics.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-600 capitalize">
                          {type} Leave
                        </span>
                        <span className="text-sm text-gray-500">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / analytics.totalRequests) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Trends */}
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Monthly Trends</h3>
                <TrendingUp className="h-5 w-5 text-gray-400" />
              </div>
              <div className="space-y-4">
                {Object.entries(analytics.monthlyTrends).map(([month, count]) => (
                  <div key={month} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-600">
                          {month}
                        </span>
                        <span className="text-sm text-gray-500">{count} requests</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${(count / Math.max(...Object.values(analytics.monthlyTrends))) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}