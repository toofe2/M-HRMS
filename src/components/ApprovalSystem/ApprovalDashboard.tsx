import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  TrendingUp,
  Mail,
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApprovalSystem } from '../../hooks/useApprovalSystem';

interface ApprovalRequestRow {
  request_id: string;
  status: string;
  requester_name: string;
  approver_name: string;
  approver_email: string;
  created_at: string;
}

const ApprovalDashboard: React.FC = () => {
  const { statistics, refresh } = useApprovalSystem();

  const [requests, setRequests] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  /* ------------------------------
   * Load pending approvals
   * ------------------------------ */
  const loadRequests = async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('approval_dashboard_for_approver')
      .select('*')
      .eq('request_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setRequests(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = requests.filter(r =>
    !search ||
    r.requester_name.toLowerCase().includes(search.toLowerCase()) ||
    r.approver_name.toLowerCase().includes(search.toLowerCase())
  );

  /* ------------------------------
   * UI Components
   * ------------------------------ */
  const StatCard = ({
    title,
    value,
    icon: Icon,
    color
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
  }) => (
    <div className="bg-white border rounded-xl p-5 flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  );

  /* ------------------------------
   * Render
   * ------------------------------ */
  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Approval Dashboard
          </h1>
          <p className="text-gray-600">
            Review and manage pending approval requests
          </p>
        </div>

        <button
          onClick={() => {
            refresh();
            loadRequests();
          }}
          className="flex items-center px-4 py-2 border rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Pending Requests"
          value={statistics.reduce((s, x) => s + x.pending_requests, 0)}
          icon={Clock}
          color="bg-blue-500"
        />
        <StatCard
          title="Approved"
          value={statistics.reduce((s, x) => s + x.approved_requests, 0)}
          icon={CheckCircle2}
          color="bg-green-500"
        />
        <StatCard
          title="Rejected"
          value={statistics.reduce((s, x) => s + x.rejected_requests, 0)}
          icon={XCircle}
          color="bg-red-500"
        />
        <StatCard
          title="Avg. Processing (hrs)"
          value={
            Math.round(
              statistics.reduce((s, x) => s + x.avg_completion_hours, 0) /
              (statistics.length || 1)
            )
          }
          icon={TrendingUp}
          color="bg-purple-500"
        />
      </div>

      {/* Search */}
      <div className="bg-white border rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by requester or approver name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Requests */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Pending Approvals ({filteredRequests.length})
        </h2>

        {loading ? (
          <p className="text-gray-500">Loading approvals…</p>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center">
            <Clock className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No pending approvals</p>
          </div>
        ) : (
          filteredRequests.map(req => (
            <div
              key={req.request_id}
              className="bg-white border rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <p className="font-semibold text-gray-900 flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  Requester: {req.requester_name}
                </p>

                <p className="text-sm text-gray-600 mt-1 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  Waiting for approval from:
                  <span className="ml-1 font-medium">
                    {req.approver_name}
                  </span>
                  <span className="ml-1 text-xs text-gray-500">
                    ({req.approver_email})
                  </span>
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  Submitted on {new Date(req.created_at).toLocaleString()}
                </p>
              </div>

              <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800 self-start md:self-center">
                Pending
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ApprovalDashboard;