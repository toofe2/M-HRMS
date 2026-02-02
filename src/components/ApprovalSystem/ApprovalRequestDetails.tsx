import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ArrowRight,
  Flag,
  Eye,
  Download,
  Share2
} from 'lucide-react';
import { ApprovalRequest, ApprovalAction } from '../../types/approval';
import { ApprovalService } from '../../services/approvalService';
import { useApprovalSystem } from '../../hooks/useApprovalSystem';

interface ApprovalRequestDetailsProps {
  request: ApprovalRequest;
  onClose: () => void;
  onActionComplete?: () => void;
}

export default function ApprovalRequestDetails({
  request,
  onClose,
  onActionComplete
}: ApprovalRequestDetailsProps) {
  const { processAction, canApprove } = useApprovalSystem();
  const [requestDetails, setRequestDetails] = useState<(ApprovalRequest & { actions: ApprovalAction[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approved' | 'rejected'>('approved');
  const [comments, setComments] = useState('');
  const [canApproveRequest, setCanApproveRequest] = useState(false);

  useEffect(() => {
    fetchRequestDetails();
    checkApprovalPermission();
  }, [request.id]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const response = await ApprovalService.getRequestDetails(request.id);
      
      if (response.success && response.data) {
        setRequestDetails(response.data);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkApprovalPermission = async () => {
    const result = await canApprove(request.id);
    setCanApproveRequest(result);
  };

  const handleAction = async (action: 'approved' | 'rejected') => {
    setActionType(action);
    setShowActionModal(true);
  };

  const submitAction = async () => {
    if (!comments.trim() && actionType === 'rejected') {
      alert('يرجى إدخال سبب الرفض');
      return;
    }

    setProcessing(true);
    try {
      const success = await processAction({
        request_id: request.id,
        action: actionType,
        comments: comments.trim() || undefined
      });

      if (success) {
        setShowActionModal(false);
        setComments('');
        onActionComplete?.();
        await fetchRequestDetails();
      }
    } catch (error) {
      console.error('Error processing action:', error);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'normal':
        return 'text-blue-600';
      case 'low':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'delegated':
        return <Share2 className="h-5 w-5 text-blue-500" />;
      case 'escalated':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  تفاصيل الطلب {request.request_number}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {request.page_display_name}
                </p>
              </div>
              
              <div className="flex items-center space-x-4 rtl:space-x-reverse">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  getStatusColor(request.status)
                }`}>
                  {request.status === 'pending' ? 'معلق' :
                   request.status === 'approved' ? 'موافق عليه' :
                   request.status === 'rejected' ? 'مرفوض' :
                   request.status === 'cancelled' ? 'ملغي' : 'منتهي الصلاحية'}
                </span>
                
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : requestDetails ? (
              <div className="p-6 space-y-8">
                {/* Request Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">معلومات الطلب</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">رقم الطلب:</span>
                          <span className="text-sm font-medium text-gray-900">{requestDetails.request_number}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">المقدم:</span>
                          <span className="text-sm font-medium text-gray-900">{requestDetails.requester_name}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">الأولوية:</span>
                          <span className={`text-sm font-medium ${getPriorityColor(requestDetails.priority)}`}>
                            <Flag className="h-4 w-4 inline-block ml-1 rtl:ml-0 rtl:mr-1" />
                            {requestDetails.priority === 'urgent' ? 'عاجل' :
                             requestDetails.priority === 'high' ? 'مرتفع' :
                             requestDetails.priority === 'normal' ? 'عادي' : 'منخفض'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">تاريخ الإنشاء:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(requestDetails.created_at)}
                          </span>
                        </div>
                        
                        {requestDetails.due_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">تاريخ الاستحقاق:</span>
                            <span className={`text-sm font-medium ${
                              requestDetails.is_overdue ? 'text-red-600' : 'text-gray-900'
                            }`}>
                              {formatDate(requestDetails.due_date)}
                              {requestDetails.is_overdue && ' (متأخر)'}
                            </span>
                          </div>
                        )}
                        
                        {requestDetails.completed_at && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">تاريخ الإكمال:</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatDate(requestDetails.completed_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Request Data */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">بيانات الطلب</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(requestDetails.request_data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Current Step */}
                    {requestDetails.current_step_name && requestDetails.status === 'pending' && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">الخطوة الحالية</h3>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                              {requestDetails.current_step_name}
                            </span>
                            <span className="text-xs text-blue-600">
                              الخطوة {requestDetails.current_step}
                            </span>
                          </div>
                          
                          {requestDetails.required_approvals && requestDetails.current_approvals_count !== undefined && (
                            <div className="flex items-center text-sm text-blue-700">
                              <ArrowRight className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                              <span>
                                الموافقات: {requestDetails.current_approvals_count} من {requestDetails.required_approvals}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Approval History */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        سجل الموافقات ({requestDetails.actions.length})
                      </h3>
                      
                      {requestDetails.actions.length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-6 text-center">
                          <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">لا توجد إجراءات بعد</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {requestDetails.actions.map((action, index) => (
                            <div
                              key={action.id}
                              className="bg-white border border-gray-200 rounded-lg p-4"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 rtl:space-x-reverse">
                                  {getActionIcon(action.action)}
                                  <div>
                                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                      <span className="text-sm font-medium text-gray-900">
                                        {action.approver_name}
                                      </span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        action.action === 'approved' ? 'bg-green-100 text-green-800' :
                                        action.action === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                        {action.action === 'approved' ? 'وافق' :
                                         action.action === 'rejected' ? 'رفض' :
                                         action.action === 'delegated' ? 'فوض' : 'صعد'}
                                      </span>
                                    </div>
                                    
                                    <p className="text-xs text-gray-500 mt-1">
                                      {action.step_name} • {formatDate(action.action_date)}
                                    </p>
                                    
                                    {action.comments && (
                                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-700">{action.comments}</p>
                                      </div>
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
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">فشل في تحميل تفاصيل الطلب</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions Footer */}
          {requestDetails && canApproveRequest && request.status === 'pending' && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-end space-x-4 rtl:space-x-reverse">
                <button
                  onClick={() => handleAction('rejected')}
                  disabled={processing}
                  className="flex items-center px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-5 w-5 ml-2 rtl:ml-0 rtl:mr-2" />
                  رفض الطلب
                </button>
                
                <button
                  onClick={() => handleAction('approved')}
                  disabled={processing}
                  className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5 ml-2 rtl:ml-0 rtl:mr-2" />
                  موافقة على الطلب
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionType === 'approved' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>رقم الطلب:</strong> {request.request_number}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>المقدم:</strong> {request.requester_name}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>النوع:</strong> {request.page_display_name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {actionType === 'approved' ? 'تعليقات الموافقة (اختياري)' : 'سبب الرفض (مطلوب)'}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={actionType === 'approved' ? 
                    'أضف تعليقات إضافية...' : 
                    'يرجى توضيح سبب الرفض...'
                  }
                  required={actionType === 'rejected'}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse mt-6">
              <button
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                إلغاء
              </button>
              
              <button
                onClick={submitAction}
                disabled={processing || (actionType === 'rejected' && !comments.trim())}
                className={`flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  actionType === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white ml-2 rtl:ml-0 rtl:mr-2"></div>
                ) : actionType === 'approved' ? (
                  <CheckCircle2 className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
                ) : (
                  <XCircle className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
                )}
                {processing ? 'جاري المعالجة...' : 
                 actionType === 'approved' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}