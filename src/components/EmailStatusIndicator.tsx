import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface EmailStatus {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

export default function EmailStatusIndicator() {
  const { user, isAdmin } = useAuthStore();
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin) return;

    const fetchEmailStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('email_logs')
          .select('status')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

        if (error) throw error;

        const status = {
          total: data?.length || 0,
          sent: data?.filter(log => log.status === 'sent').length || 0,
          failed: data?.filter(log => log.status === 'failed').length || 0,
          pending: data?.filter(log => log.status === 'pending').length || 0
        };

        setEmailStatus(status);
        setIsVisible(status.total > 0);
      } catch (error) {
        console.error('Error fetching email status:', error);
      }
    };

    // Initial fetch
    fetchEmailStatus();

    // Set up real-time subscription
    const subscription = supabase
      .channel('email_logs_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_logs'
      }, () => {
        fetchEmailStatus();
      })
      .subscribe();

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchEmailStatus, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [user, isAdmin]);

  if (!isVisible || !isAdmin) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Email Status</span>
        </div>
        
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-600 font-medium">{emailStatus.sent}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-600 font-medium">{emailStatus.pending}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-600 font-medium">{emailStatus.failed}</span>
          </div>
        </div>

        {emailStatus.pending > 0 && (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        Last 24 hours • Auto-refresh every 10s
      </div>
    </div>
  );
}