import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface LeaveBalance {
  leave_type_name: string;
  total_allowance: number;
  used_days: number;
  available_days: number;
  carry_forward_days: number;
}

interface LeaveBalanceHook {
  balances: LeaveBalance[];
  loading: boolean;
  error: string | null;
  refreshBalances: () => Promise<void>;
  getBalance: (leaveTypeName: string) => LeaveBalance | null;
  getAvailableDays: (leaveTypeName: string) => number;
}

export function useLeaveBalance(): LeaveBalanceHook {
  const { user } = useAuthStore();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const currentYear = new Date().getFullYear();

      // جلب رصيد الإجازات من الجدول الجديد
      const { data, error: fetchError } = await supabase
        .from('employee_leave_balances_view')
        .select('*')
        .eq('employee_id', user.id)
        .eq('year', currentYear);

      if (fetchError) throw fetchError;

      setBalances(data || []);
    } catch (err: any) {
      console.error('Error fetching leave balances:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    await fetchBalances();
  };

  const getBalance = (leaveTypeName: string): LeaveBalance | null => {
    return balances.find(balance => 
      balance.leave_type_name.toLowerCase() === leaveTypeName.toLowerCase()
    ) || null;
  };

  const getAvailableDays = (leaveTypeName: string): number => {
    const balance = getBalance(leaveTypeName);
    return balance ? balance.available_days : 0;
  };

  useEffect(() => {
    if (user) {
      fetchBalances();
    }
  }, [user]);

  // الاستماع للتغييرات في رصيد الإجازات
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('employee_leave_balances_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employee_leave_balances',
        filter: `employee_id=eq.${user.id}`
      }, () => {
        fetchBalances();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return {
    balances,
    loading,
    error,
    refreshBalances,
    getBalance,
    getAvailableDays
  };
}