import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Clock,
  User,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function RequestApproval() {
  const navigate = useNavigate();
  const [requestId, setRequestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSearch = async () => {
    if (!requestId.trim()) return;

    setLoading(true);
    setError(null);
    setRequest(null);

    try {
      // First check if this is a valid approval token
      const { data: tokenData, error: tokenError } = await supabase
        .from('approval_tokens')
        .select('request_id')
        .eq('token', requestId)
        .maybeSingle();

      // If token found, use its request_id, otherwise use the input directly as request_id
      const actualRequestId = tokenData?.request_id || requestId;

      const { data, error: supabaseError } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:profiles!leave_requests_employee_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', actualRequestId)
        .maybeSingle();

      if (supabaseError) {
        console.error('Supabase error:', supabaseError);
        throw new Error(`Database error: ${supabaseError.message}`);
      }

      if (!data) {
        console.log('No request found for ID:', actualRequestId);
        setError('No request found with this ID. Please check the request ID or token and try again.');
        return;
      }

      if (data.status !== 'pending' || data.manager_approval_status !== 'pending') {
        console.log('Request already processed:', data);
        setError('This request has already been processed and cannot be modified.');
        return;
      }

      setRequest(data);
    } catch (err: any) {
      console.error('Error fetching request:', err);
      setError(err.message || 'An error occurred while fetching the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (approved: boolean) => {
    if (!request) return;

    setProcessing(true);
    setError(null);

    try {
      // Start a transaction to update both tables
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          manager_approval_status: approved ? 'approved' : 'rejected',
          manager_comments: approved ? 'Approved via request ID/token' : 'Rejected via request ID/token',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // If this was accessed via token, delete the used token
      if (requestId !== request.id) {
        const { error: tokenError } = await supabase
          .from('approval_tokens')
          .delete()
          .eq('token', requestId);

        if (tokenError) {
          console.error('Error deleting token:', tokenError);
          // Don't throw here as the main action succeeded
        }
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Error processing request:', err);
      setError(err.message || 'An error occurred while processing the request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let days = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 5 && dayOfWeek !== 6) { // Not Friday or Saturday
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Request Approval</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter a request ID or approval token to review and process the request
            </p>
          </div>

          <div className="p-6">
            {success ? (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Request Processed Successfully</h3>
                <p className="mt-2 text-sm text-gray-500">
                  The request has been processed. You can close this window or process another request.
                </p>
                <button
                  onClick={() => {
                    setSuccess(false);
                    setRequest(null);
                    setRequestId('');
                  }}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Process Another Request
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="max-w-xl mx-auto">
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={requestId}
                        onChange={(e) => setRequestId(e.target.value.trim())}
                        placeholder="Enter Request ID or Token"
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleSearch}
                        disabled={loading || !requestId.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Search className="h-5 w-5 mr-2" />
                            Search
                          </>
                        )}
                      </button>
                    </div>

                    {error && (
                      <div className="mt-4 p-4 bg-red-50 rounded-md">
                        <div className="flex">
                          <AlertCircle className="h-5 w-5 text-red-400" />
                          <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {request && (
                  <div className="max-w-2xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="p-6">
                      <div className="flex items-center mb-4">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            {request.employee.first_name} {request.employee.last_name}
                          </h3>
                          <p className="text-sm text-gray-500">{request.employee.email}</p>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-4">
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                          <div>
                            <dt className="text-sm font-medium text-gray-500 flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              Leave Type
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 capitalize">
                              {request.leave_type} Leave
                            </dd>
                          </div>

                          <div>
                            <dt className="text-sm font-medium text-gray-500 flex items-center">
                              <Calendar className="h-4 w-4 mr-2" />
                              Duration
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {formatDate(request.start_date)} - {formatDate(request.end_date)}
                              <br />
                              <span className="text-sm text-gray-500">
                                ({calculateWorkingDays(request.start_date, request.end_date)} working days)
                              </span>
                            </dd>
                          </div>

                          <div className="sm:col-span-2">
                            <dt className="text-sm font-medium text-gray-500">Reason</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {request.reason || 'No reason provided'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div className="mt-6 flex justify-end space-x-4">
                        <button
                          onClick={() => handleAction(false)}
                          disabled={processing}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center"
                        >
                          {processing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleAction(true)}
                          disabled={processing}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
                        >
                          {processing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
