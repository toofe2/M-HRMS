import React, { useState } from 'react';
import {
  Clock,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  Paperclip,
  ArrowRight,
  Flag
} from 'lucide-react';
import { ApprovalRequest } from '../../types/approval';
import { useApprovalSystem } from '../../hooks/useApprovalSystem';

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  showActions?: boolean;
  onViewDetails?: (request: ApprovalRequest) => void;
  onActionComplete?: () => void;
}

export default function ApprovalRequestCard({
  request,
  showActions = true,
  onViewDetails,
  onActionComplete
}: ApprovalRequestCardProps) {
  const { processAction, canApprove } = useApprovalSystem();
  const [processing, setProcessing] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [action, setAction] = useState<'approved' | 'rejected'>('approved');
  const [comments, setComments] = useState('');
  const [canApproveRequest, setCanApproveRequest] = useState(false);

  React.useEffect(() => {
    const checkPermission = async () => {
      const result = await canApprove(request.id);
      setCanApproveRequest(result);
    };
    checkPermission();
  }, [request.id, canApprove]);

  const handleAction = async (actionType: 'approved' | 'rejected') => {
    setAction(actionType);
    setShowCommentModal(true);
  };

  const submitAction = async () => {
    if (!comments.trim() && action === 'rejected') {
      alert('يرجى إدخال سبب الرفض');
      return;
    }

    setProcessing(true);
    try {
      const success = await processAction({
        request_id: request.id,
        action,
        comments: comments.trim() || undefined
      });

      if (success) {
        setShowCommentModal(false);
        setComments('');
        onActionComplete?.();
      }
    } catch (error) {
      console.error('Error processing action:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md ${
        request.is_overdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
      }`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className={`p-2 rounded-lg ${
                request.is_overdue ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                <Clock className={`h-5 w-5 ${
                  request.is_overdue ? 'text-red-600' : 'text-blue-600'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {request.request_number}
                </h3>
                <p className="text-sm text-gray-600">
                  {request.page_display_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                getPriorityColor(request.priority)
              }`}>
                <Flag className="h-3 w-3 inline-block ml-1 rtl:ml-0 rtl:mr-1" />
                {request.priority === 'urgent' ? 'عاجل' :
                 request.priority === 'high' ? 'مرتفع' :
                 request.priority === 'normal' ? 'عادي' : 'منخفض'}
              </span>
              
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                getStatusColor(request.status)
              }`}>
                {request.status === 'pending' ? 'معلق' :
                 request.status === 'approved' ? 'موافق عليه' :
                 request.status === 'rejected' ? 'مرفوض' :
                 request.status === 'cancelled' ? 'ملغي' : 'منتهي الصلاحية'}
              </span>
            </div>
          </div>

          {/* Request Info */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <User className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
              <span>المقدم: {request.requester_name}</span>
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
              <span>تاريخ الإنشاء: {formatDate(request.created_at)}</span>
            </div>

            {request.due_date && (
              <div className={`flex items-center text-sm ${
                request.is_overdue ? 'text-red-600' : 'text-gray-600'
              }`}>
                <AlertTriangle className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                <span>
                  تاريخ الاستحقاق: {formatDate(request.due_date)}
                  {request.is_overdue && ' (متأخر)'}
                </span>
              </div>
            )}

            {request.current_step_name && (
              <div className="flex items-center text-sm text-gray-600">
                <ArrowRight className="h-4 w-4 ml-2 rtl:ml-0 rtl:mr-2" />
                <span>الخطوة الحالية: {request.current_step_name}</span>
                {request.required_approvals && request.current_approvals_count !== undefined && (
                  <span className="mr-2 rtl:mr-0 rtl:ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    {request.current_approvals_count}/{request.required_approvals}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => onViewDetails?.(request)}
              className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Eye className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
              عرض التفاصيل
            </button>

            {showActions && canApproveRequest && request.status === 'pending' && (
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <button
                  onClick={() => handleAction('rejected')}
                  disabled={processing}
                  className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
                  رفض
                </button>
                
                <button
                  onClick={() => handleAction('approved')}
                  disabled={processing}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
                  موافقة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {action === 'approved' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </h3>
              <button
                onClick={() => setShowCommentModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-5 w-5" />
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
                  {action === 'approved' ? 'تعليقات الموافقة (اختياري)' : 'سبب الرفض (مطلوب)'}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={action === 'approved' ? 
                    'أضف تعليقات إضافية...' : 
                    'يرجى توضيح سبب الرفض...'
                  }
                  required={action === 'rejected'}
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse mt-6">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                إلغاء
              </button>
              
              <button
                onClick={submitAction}
                disabled={processing || (action === 'rejected' && !comments.trim())}
                className={`flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  action === 'approved' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white ml-2 rtl:ml-0 rtl:mr-2"></div>
                ) : action === 'approved' ? (
                  <CheckCircle2 className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
                ) : (
                  <XCircle className="h-4 w-4 ml-1 rtl:ml-0 rtl:mr-1" />
                )}
                {processing ? 'جاري المعالجة...' : 
                 action === 'approved' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}