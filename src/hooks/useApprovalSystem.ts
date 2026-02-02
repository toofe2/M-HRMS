/**
 * Hook لإدارة نظام الموافقات
 */

import { useState, useEffect, useCallback } from 'react';
import { ApprovalService } from '../services/approvalService';
import {
  ApprovalRequest,
  ApprovalNotification,
  ApprovalStatistics,
  CreateApprovalRequestData,
  ProcessApprovalActionData
} from '../types/approval';

export function useApprovalSystem() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [notifications, setNotifications] = useState<ApprovalNotification[]>([]);
  const [statistics, setStatistics] = useState<ApprovalStatistics[]>([]);

  /**
   * جلب الطلبات المعلقة
   */
  const fetchPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApprovalService.getPendingRequestsForUser();
      
      if (response.success && response.data) {
        setPendingRequests(response.data);
      } else {
        setError(response.error || 'فشل في جلب الطلبات المعلقة');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * جلب الإشعارات غير المقروءة
   */
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await ApprovalService.getUnreadNotifications();
      
      if (response.success && response.data) {
        setNotifications(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
    }
  }, []);

  /**
   * جلب الإحصائيات
   */
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await ApprovalService.getStatistics();
      
      if (response.success && response.data) {
        setStatistics(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
    }
  }, []);

  /**
   * إنشاء طلب موافقة جديد
   */
  const createRequest = useCallback(async (data: CreateApprovalRequestData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ApprovalService.createRequest(data);
      
      if (response.success) {
        await fetchPendingRequests();
        return response.data;
      } else {
        setError(response.error || 'فشل في إنشاء الطلب');
        return null;
      }
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingRequests]);

  /**
   * معالجة إجراء الموافقة
   */
  const processAction = useCallback(async (data: ProcessApprovalActionData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await ApprovalService.processAction(data);
      
      if (response.success) {
        await fetchPendingRequests();
        await fetchNotifications();
        return true;
      } else {
        setError(response.error || 'فشل في معالجة الإجراء');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPendingRequests, fetchNotifications]);

  /**
   * تحديد إشعار كمقروء
   */
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await ApprovalService.markNotificationAsRead(notificationId);
      
      if (response.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, is_read: true, read_at: new Date().toISOString() }
              : notification
          )
        );
      }
    } catch (err: any) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  /**
   * التحقق من صلاحية الموافقة
   */
  const canApprove = useCallback(async (requestId: string) => {
    try {
      const response = await ApprovalService.canApproveRequest(requestId);
      return response.success ? response.data : false;
    } catch (err: any) {
      console.error('Error checking approval permission:', err);
      return false;
    }
  }, []);

  /**
   * تحديث البيانات
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchPendingRequests(),
      fetchNotifications(),
      fetchStatistics()
    ]);
  }, [fetchPendingRequests, fetchNotifications, fetchStatistics]);

  // جلب البيانات عند تحميل الـ hook
  useEffect(() => {
    refresh();
  }, [refresh]);

  // إعداد التحديث التلقائي كل 30 ثانية
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    loading,
    error,
    pendingRequests,
    notifications,
    statistics,
    createRequest,
    processAction,
    markNotificationAsRead,
    canApprove,
    refresh,
    setError
  };
}

/**
 * Hook لإدارة سير العمل
 */
export function useApprovalWorkflows(pageId?: string) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    if (!pageId) return;
    
    try {
      setLoading(true);
      const response = await ApprovalService.getWorkflowsForPage(pageId);
      
      if (response.success && response.data) {
        setWorkflows(response.data);
      } else {
        setError(response.error || 'فشل في جلب سير العمل');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return {
    workflows,
    loading,
    error,
    refresh: fetchWorkflows
  };
}

/**
 * Hook لإدارة التفويضات
 */
export function useApprovalDelegations() {
  const [delegations, setDelegations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDelegations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApprovalService.getActiveDelegations();
      
      if (response.success && response.data) {
        setDelegations(response.data);
      } else {
        setError(response.error || 'فشل في جلب التفويضات');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createDelegation = useCallback(async (data: any) => {
    try {
      setLoading(true);
      const response = await ApprovalService.createDelegation(data);
      
      if (response.success) {
        await fetchDelegations();
        return true;
      } else {
        setError(response.error || 'فشل في إنشاء التفويض');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchDelegations]);

  const endDelegation = useCallback(async (delegationId: string) => {
    try {
      const response = await ApprovalService.endDelegation(delegationId);
      
      if (response.success) {
        await fetchDelegations();
        return true;
      } else {
        setError(response.error || 'فشل في إنهاء التفويض');
        return false;
      }
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [fetchDelegations]);

  useEffect(() => {
    fetchDelegations();
  }, [fetchDelegations]);

  return {
    delegations,
    loading,
    error,
    createDelegation,
    endDelegation,
    refresh: fetchDelegations
  };
}