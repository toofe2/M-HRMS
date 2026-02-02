import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plane,
  ShoppingCart,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import NotificationBell from '../components/NotificationBell';
import SettingsButton from '../components/SettingsButton';
import OptimizedImage from '../components/OptimizedImage';

interface ProcurementStats {
  travelRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  totalBudget: number;
  spentAmount: number;
  remainingBudget: number;
  activeProjects: number;
}

interface RecentActivity {
  id: string;
  type: 'travel' | 'expense' | 'project';
  title: string;
  description: string;
  status: string;
  created_at: string;
  amount?: number;
}

const procurementModules = [
  {
    title: 'Travel Requests',
    description: 'Submit and manage business travel requests',
    icon: Plane,
    path: '/procurement/travel',
    color: 'bg-blue-500',
    statKey: 'travelRequests'
  },
  {
    title: 'Purchase Orders',
    description: 'Create and track purchase orders',
    icon: ShoppingCart,
    path: '/procurement/purchase-orders',
    color: 'bg-green-500',
    statKey: 'purchaseOrders'
  },
  {
    title: 'Expense Reports',
    description: 'Submit expense reports and reimbursements',
    icon: FileText,
    path: '/procurement/expenses',
    color: 'bg-purple-500',
    statKey: 'expenseReports'
  },
  {
    title: 'Budget Tracking',
    description: 'Monitor department and project budgets',
    icon: DollarSign,
    path: '/procurement/budget',
    color: 'bg-orange-500',
    statKey: 'budget'
  }
];

export default function Procurement() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProcurementStats>({
    travelRequests: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0
    },
    totalBudget: 0,
    spentAmount: 0,
    remainingBudget: 0,
    activeProjects: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProcurementData();
    }
  }, [user]);

  const fetchProcurementData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch travel requests statistics
      const { data: travelData, error: travelError } = await supabase
        .from('travel_requests')
        .select('status, total_estimated_cost, created_at, from_location, to_location, employee_id')
        .order('created_at', { ascending: false });

      if (travelError) throw travelError;

      // Calculate travel request stats
      const travelStats = {
        total: travelData?.length || 0,
        pending: travelData?.filter(req => req.status === 'pending').length || 0,
        approved: travelData?.filter(req => req.status === 'approved').length || 0,
        rejected: travelData?.filter(req => req.status === 'rejected').length || 0
      };

      // Fetch projects data
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('budget, status')
        .eq('status', 'active');

      if (projectsError) throw projectsError;

      // Calculate budget stats
      const totalBudget = projectsData?.reduce((sum, project) => sum + (project.budget || 0), 0) || 0;
      const spentAmount = travelData?.reduce((sum, req) => sum + (req.total_estimated_cost || 0), 0) || 0;
      const remainingBudget = totalBudget - spentAmount;
      const activeProjects = projectsData?.length || 0;

      setStats({
        travelRequests: travelStats,
        totalBudget,
        spentAmount,
        remainingBudget,
        activeProjects
      });

      // Prepare recent activity data
      const activities: RecentActivity[] = [];

      // Add travel requests to recent activity
      travelData?.slice(0, 5).forEach(req => {
        activities.push({
          id: req.employee_id,
          type: 'travel',
          title: `Travel Request`,
          description: `${req.from_location} → ${req.to_location}`,
          status: req.status,
          created_at: req.created_at,
          amount: req.total_estimated_cost
        });
      });

      setRecentActivity(activities);

    } catch (error: any) {
      console.error('Error fetching procurement data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600';
      case 'rejected':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getModuleStats = (statKey: string) => {
    switch (statKey) {
      case 'travelRequests':
        return {
          pending: stats.travelRequests.pending,
          total: stats.travelRequests.total,
          approved: stats.travelRequests.approved
        };
      case 'budget':
        return {
          allocated: formatCurrency(stats.totalBudget),
          spent: formatCurrency(stats.spentAmount),
          remaining: formatCurrency(stats.remainingBudget)
        };
      default:
        return { pending: 0, total: 0, approved: 0 };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">Procurement Management</h1>
            </div>
            <div className="flex items-center space-x-4">
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
                    <div className="h-8 w-8 bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-medium">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-gray-700">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600">Travel Requests</p>
                <p className="text-2xl font-bold text-blue-900">{stats.travelRequests.pending}</p>
                <p className="text-xs text-blue-600">Pending Approval</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600">Active Projects</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeProjects}</p>
                <p className="text-xs text-green-600">In Progress</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600">Total Budget</p>
                <p className="text-2xl font-bold text-purple-900">{formatCurrency(stats.totalBudget)}</p>
                <p className="text-xs text-purple-600">Allocated</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-orange-600">Remaining Budget</p>
                <p className="text-2xl font-bold text-orange-900">{formatCurrency(stats.remainingBudget)}</p>
                <p className="text-xs text-orange-600">Available</p>
              </div>
            </div>
          </div>
        </div>

        {/* Procurement Modules */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-2 mb-8">
          {procurementModules.map((module) => {
            const moduleStats = getModuleStats(module.statKey);
            return (
              <div
                key={module.path}
                onClick={() => navigate(module.path)}
                className="bg-white overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105 cursor-pointer border border-gray-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`inline-flex p-3 rounded-lg ${module.color}`}>
                      <module.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Status</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {module.statKey === 'travelRequests' ? `${moduleStats.pending} Pending` : 
                         module.statKey === 'budget' ? 'Active' : 
                         'Available'}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {module.description}
                  </p>

                  {/* Module-specific stats */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-4">
                      {module.statKey === 'travelRequests' && (
                        <>
                          <span>Total: {moduleStats.total}</span>
                          <span>Approved: {moduleStats.approved}</span>
                        </>
                      )}
                      {module.statKey === 'budget' && (
                        <>
                          <span>Allocated: {moduleStats.allocated}</span>
                          <span>Spent: {moduleStats.spent}</span>
                        </>
                      )}
                      {module.statKey === 'purchaseOrders' && (
                        <>
                          <span>Total: 8</span>
                          <span>Approved: 5</span>
                        </>
                      )}
                      {module.statKey === 'expenseReports' && (
                        <>
                          <span>Total: 12</span>
                          <span>Approved: 9</span>
                        </>
                      )}
                    </div>
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              Latest procurement activities and requests
            </p>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No recent activity</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Recent procurement activities will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={`${activity.id}-${index}`} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${
                        activity.type === 'travel' ? 'bg-blue-100' :
                        activity.type === 'expense' ? 'bg-purple-100' :
                        'bg-green-100'
                      }`}>
                        {activity.type === 'travel' ? (
                          <Plane className={`h-4 w-4 ${
                            activity.type === 'travel' ? 'text-blue-600' :
                            activity.type === 'expense' ? 'text-purple-600' :
                            'text-green-600'
                          }`} />
                        ) : activity.type === 'expense' ? (
                          <FileText className="h-4 w-4 text-purple-600" />
                        ) : (
                          <ShoppingCart className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="text-xs text-gray-500">{activity.description}</p>
                        {activity.amount && (
                          <p className="text-xs text-gray-600 mt-1">
                            Amount: {formatCurrency(activity.amount)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(activity.status)}
                      <span className={`text-xs font-medium capitalize ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}