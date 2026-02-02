import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Mail,
  AlertTriangle,
  Settings,
  Save,
  X,
  Send,
  Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface EmailLog {
  id: string;
  recipient: string | null;
  subject: string | null;
  status: string; // support ALL statuses (pending/sent/failed/processing/queued/etc.)
  error?: string | null;
  metadata?: {
    text?: string | null;
    html?: string | null;
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at?: string | null;
}

interface NotificationMetrics {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  averageDeliveryTime: number;
  commonErrors: { error: string; count: number }[];
}

interface SMTPSettings {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  is_active: boolean;
}

const ITEMS_PER_PAGE = 10;

export default function NotificationMonitoring() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [metrics, setMetrics] = useState<NotificationMetrics>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    averageDeliveryTime: 0,
    commonErrors: [],
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // empty = all
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showSMTPModal, setShowSMTPModal] = useState(false);
  const [smtpSettings, setSMTPSettings] = useState<SMTPSettings>({
    id: '',
    host: 'smtp-relay.brevo.com',
    port: 587,
    username: '88cd0c001@smtp-brevo.com',
    password: '********',
    from_email: 'toofehhhniiudmdjo@gmail.com',
    is_active: true,
  });

  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // ✅ Date range (to support ALL notifications, not only last 24h)
  const [rangePreset, setRangePreset] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [fromDate, setFromDate] = useState<string>(''); // optional manual override
  const [toDate, setToDate] = useState<string>('');   // optional manual override

  const computedRange = useMemo(() => {
    // Manual override wins
    if (fromDate || toDate) {
      return {
        from: fromDate ? new Date(fromDate).toISOString() : null,
        to: toDate ? new Date(toDate).toISOString() : null,
      };
    }

    const now = new Date();
    if (rangePreset === 'all') return { from: null, to: null };

    const start = new Date(now);
    if (rangePreset === '24h') start.setHours(start.getHours() - 24);
    if (rangePreset === '7d') start.setDate(start.getDate() - 7);
    if (rangePreset === '30d') start.setDate(start.getDate() - 30);

    return { from: start.toISOString(), to: null };
  }, [rangePreset, fromDate, toDate]);

  // ────────────────────────────────────────────────
  // Realtime subscription
  // ────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('email_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_logs' }, () => {
        // Keep current page but refresh data
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, sortField, sortDirection, rangePreset, fromDate, toDate]);

  // Auto refresh every 10s (when not loading)
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      fetchData();
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentPage, statusFilter, sortField, sortDirection, rangePreset, fromDate, toDate]);

  // ────────────────────────────────────────────────
  // SMTP Settings
  // ────────────────────────────────────────────────
  const fetchSMTPSettings = async () => {
    try {
      const { data, error } = await supabase.from('smtp_settings').select('*').eq('is_active', true).single();
      if (error) throw error;
      if (data) setSMTPSettings(data);
    } catch (err: any) {
      console.error('Error fetching SMTP settings:', err);
      setError('Failed to fetch SMTP settings');
    }
  };

  useEffect(() => {
    fetchSMTPSettings();
  }, []);

  const handleSaveSMTPSettings = async () => {
    try {
      setError(null);
      setSuccess(null);

      const payload = { ...smtpSettings };

      const { error } = await supabase.from('smtp_settings').upsert([payload]);
      if (error) throw error;

      setSuccess('SMTP settings updated successfully');
      setShowSMTPModal(false);
      fetchSMTPSettings();
    } catch (err: any) {
      console.error('Error saving SMTP settings:', err);
      setError(err.message || 'Failed to save SMTP settings');
    }
  };

  // ────────────────────────────────────────────────
  // Fetch + Metrics
  // ────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .order(sortField, { ascending: sortDirection === 'asc' });

      if (computedRange.from) query = query.gte('created_at', computedRange.from);
      if (computedRange.to) query = query.lte('created_at', computedRange.to);

      if (statusFilter) query = query.eq('status', statusFilter);

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setLogs((data || []) as EmailLog[]);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / ITEMS_PER_PAGE)));

      // Metrics (same range, all statuses)
      let mQuery = supabase.from('email_logs').select('status, error, created_at, updated_at');
      if (computedRange.from) mQuery = mQuery.gte('created_at', computedRange.from);
      if (computedRange.to) mQuery = mQuery.lte('created_at', computedRange.to);

      const { data: metricsData, error: metricsError } = await mQuery;
      if (metricsError) throw metricsError;

      const rows = metricsData || [];
      const sent = rows.filter((r: any) => String(r.status).toLowerCase() === 'sent').length;
      const failed = rows.filter((r: any) => String(r.status).toLowerCase() === 'failed').length;
      const pending = rows.filter((r: any) => String(r.status).toLowerCase() === 'pending').length;

      const deliveryTimes = rows
        .filter((r: any) => String(r.status).toLowerCase() === 'sent' && r.updated_at)
        .map((r: any) => {
          const start = new Date(r.created_at).getTime();
          const end = new Date(r.updated_at).getTime();
          return (end - start) / 1000;
        });

      const avgDeliveryTime = deliveryTimes.length ? deliveryTimes.reduce((a: number, b: number) => a + b, 0) / deliveryTimes.length : 0;

      const errorCounts: Record<string, number> = {};
      rows
        .filter((r: any) => r.error)
        .forEach((r: any) => {
          const key = String(r.error);
          errorCounts[key] = (errorCounts[key] || 0) + 1;
        });

      const commonErrors = Object.entries(errorCounts)
        .map(([err, c]) => ({ error: err, count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setMetrics({
        total: rows.length,
        sent,
        failed,
        pending,
        averageDeliveryTime: avgDeliveryTime,
        commonErrors,
      });
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch notification data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    setCurrentPage(1);
    if (field === sortField) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // ────────────────────────────────────────────────
  // Bulk Send (PRO fix)
  // ────────────────────────────────────────────────
  const handleBulkSend = async () => {
    try {
      setIsSendingBulk(true);
      setError(null);
      setSuccess(null);

      // Show quick hint if there is nothing pending in current range
      const { count: pendingCount, error: pendingErr } = await supabase
        .from('email_logs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingErr) {
        console.warn('Pending count check failed:', pendingErr);
      } else if (!pendingCount || pendingCount === 0) {
        setSuccess('No pending notifications found.');
        return;
      }

      // IMPORTANT: invoke with body, many Edge Functions expect JSON body (even if empty)
      const { data, error } = await supabase.functions.invoke('process-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          trigger: 'manual',
          filter: { status: 'pending' },
        },
      });

      if (error) throw error;

      // Some functions return nothing, so we handle both
      const processed = (data && typeof data === 'object' && 'processed' in data) ? (data as any).processed : undefined;
      const successCount = (data && typeof data === 'object' && 'success' in data) ? (data as any).success : undefined;
      const failedCount = (data && typeof data === 'object' && 'failed' in data) ? (data as any).failed : undefined;

      if (processed === undefined) {
        setSuccess('Bulk processing triggered successfully. Refreshing logs...');
      } else {
        setSuccess(`Processed ${processed} notifications (${successCount ?? 0} sent, ${failedCount ?? 0} failed)`);
      }

      await fetchData();
    } catch (err: any) {
      console.error('Error sending bulk emails:', err);
      setError(
        err?.message ||
          'Failed to process notifications. Please verify Edge Function (process-all) deployment, permissions, and SMTP settings.'
      );
    } finally {
      setIsSendingBulk(false);
    }
  };

  const handleExport = async () => {
    try {
      let query = supabase.from('email_logs').select('*');

      if (computedRange.from) query = query.gte('created_at', computedRange.from);
      if (computedRange.to) query = query.lte('created_at', computedRange.to);
      if (statusFilter) query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const csvContent = [
        ['Timestamp', 'Recipient', 'Subject', 'Status', 'Error'].join(','),
        ...rows.map((log: any) =>
          [
            new Date(log.created_at).toISOString(),
            log.recipient ?? '',
            `"${String(log.subject ?? '').replace(/"/g, '""')}"`,
            log.status ?? '',
            log.error ? `"${String(log.error).replace(/"/g, '""')}"` : '',
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notification-logs-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      console.error('Error exporting data:', err);
      setError(err.message || 'Failed to export data');
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleString();

  const normalizeStatus = (s: string) => String(s || '').toLowerCase();

  const getStatusColor = (status: string) => {
    const s = normalizeStatus(status);
    if (s === 'sent') return 'bg-green-100 text-green-800';
    if (s === 'failed') return 'bg-red-100 text-red-800';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (s === 'processing' || s === 'queued') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const s = normalizeStatus(status);
    if (s === 'sent') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (s === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
    if (s === 'processing' || s === 'queued') return <RefreshCcw className="h-4 w-4 text-blue-500" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const MetricCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: string | number;
    icon: any;
    color: string;
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
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

  const filteredLogs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const searchString = `${log.recipient ?? ''} ${log.subject ?? ''}`.toLowerCase();
      return searchString.includes(term);
    });
  }, [logs, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center text-gray-600 hover:text-gray-900"
            type="button"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Admin Settings
          </button>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowSMTPModal(true)}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              type="button"
            >
              <Settings className="h-4 w-4 mr-2" />
              SMTP Settings
            </button>

            <button
              onClick={handleBulkSend}
              disabled={isSendingBulk}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              type="button"
            >
              {isSendingBulk ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send All Pending
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Notification Monitoring</h2>
            <p className="mt-1 text-sm text-gray-500">
              Monitor and track notification delivery status (supports all statuses + flexible time range)
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50">
              <div className="flex">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard title="Total Notifications" value={metrics.total} icon={Bell} color="bg-blue-500" />
              <MetricCard title="Successfully Sent" value={metrics.sent} icon={CheckCircle2} color="bg-green-500" />
              <MetricCard title="Failed Deliveries" value={metrics.failed} icon={AlertTriangle} color="bg-red-500" />
              <MetricCard title="Average Delivery Time" value={`${Math.round(metrics.averageDeliveryTime)}s`} icon={Clock} color="bg-purple-500" />
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notifications..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setStatusFilter(e.target.value);
                    }}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="queued">Queued</option>
                  </select>

                  <select
                    value={rangePreset}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setFromDate('');
                      setToDate('');
                      setRangePreset(e.target.value as any);
                    }}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="all">All time</option>
                  </select>

                  <button
                    onClick={handleExport}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    type="button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </button>

                  <button onClick={fetchData} className="p-2 text-gray-600 hover:text-gray-900" title="Refresh" type="button">
                    <RefreshCcw className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Manual date range (optional) */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From (optional)</label>
                  <input
                    type="datetime-local"
                    value={fromDate}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setFromDate(e.target.value);
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To (optional)</label>
                  <input
                    type="datetime-local"
                    value={toDate}
                    onChange={(e) => {
                      setCurrentPage(1);
                      setToDate(e.target.value);
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {(fromDate || toDate) && (
                  <button
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                      setRangePreset('24h');
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    type="button"
                  >
                    Reset Range
                  </button>
                )}
              </div>
            </div>

            {/* Common Errors */}
            {metrics.commonErrors.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Common Errors</h3>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="p-4">
                    {metrics.commonErrors.map((e, index) => (
                      <div key={index} className={`flex items-center justify-between ${index !== metrics.commonErrors.length - 1 ? 'mb-4' : ''}`}>
                        <div className="flex items-center">
                          <XCircle className="h-5 w-5 text-red-500 mr-2" />
                          <span className="text-sm text-gray-600">{e.error}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{e.count} occurrences</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('created_at')}>
                          Timestamp
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('recipient')}>
                          Recipient
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('subject')}>
                          Subject
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('status')}>
                          Status
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLogs.map((log) => (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(log.created_at)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Mail className="h-5 w-5 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-900">{log.recipient || '—'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.subject || '—'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {getStatusIcon(log.status)}
                                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
                                  {String(log.status || 'unknown').charAt(0).toUpperCase() + String(log.status || 'unknown').slice(1)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                                className="text-blue-600 hover:text-blue-900"
                                type="button"
                              >
                                {showDetails === log.id ? 'Hide Details' : 'View Details'}
                              </button>
                            </td>
                          </tr>

                          {showDetails === log.id && (
                            <tr>
                              <td colSpan={5} className="px-6 py-4 bg-gray-50">
                                <div className="space-y-4">
                                  {log.error && (
                                    <div className="bg-red-50 p-4 rounded-md">
                                      <div className="flex">
                                        <AlertCircle className="h-5 w-5 text-red-400" />
                                        <div className="ml-3">
                                          <h4 className="text-sm font-medium text-red-800">Error Details</h4>
                                          <p className="mt-2 text-sm text-red-700">{log.error}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">Email Content</h4>
                                    <div className="bg-white p-4 rounded-md border border-gray-200">
                                      <div className="prose max-w-none whitespace-pre-wrap">
                                        {log.metadata?.text || 'No content available'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
                  <div className="flex items-center">
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, metrics.total || 0)}</span>{' '}
                      to{' '}
                      <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, metrics.total || 0)}</span>{' '}
                      of <span className="font-medium">{metrics.total}</span> results
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SMTP Modal */}
        {showSMTPModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">SMTP Settings</h3>
                <button onClick={() => setShowSMTPModal(false)} className="text-gray-400 hover:text-gray-500" type="button">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpSettings.host}
                    onChange={(e) => setSMTPSettings((prev) => ({ ...prev, host: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Port</label>
                  <input
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSMTPSettings((prev) => ({ ...prev, port: parseInt(e.target.value || '0', 10) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    value={smtpSettings.username}
                    onChange={(e) => setSMTPSettings((prev) => ({ ...prev, username: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={smtpSettings.password}
                    onChange={(e) => setSMTPSettings((prev) => ({ ...prev, password: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tip: لا تخلي باسورد حقيقي بالكود. خليه من قاعدة البيانات بس.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">From Email</label>
                  <input
                    type="email"
                    value={smtpSettings.from_email}
                    onChange={(e) => setSMTPSettings((prev) => ({ ...prev, from_email: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setShowSMTPModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500" type="button">
                  Cancel
                </button>
                <button
                  onClick={handleSaveSMTPSettings}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  type="button"
                >
                  <Save className="h-4 w-4 inline-block mr-2" />
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
