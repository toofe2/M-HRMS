// src/components/NotificationBell.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Bell,
  Clock,
  MapPin,
  Plane,
  Loader2,
  Calendar,
  CheckCircle2,
  XCircle,
  User,
  Mail,
  AlertCircle,
  RefreshCw,
  X,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

type NotificationType = 'leave' | 'attendance' | 'travel' | 'document' | 'approval';

interface NotificationRow {
  id: string;
  recipient_user_id: string;

  module_name: string | null;
  notification_key: string | null;

  title: string | null;
  subject: string | null;
  body: string | null;

  data: any;
  request_id: string | null;
  approval_action_id: string | null;

  created_at: string;
}

interface NotificationState {
  notifications: NotificationRow[];
  lastUpdated: number;
}

interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  created_at: string;
}

const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: any;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

type TabKey = 'all' | 'leave' | 'attendance' | 'travel' | 'document' | 'approval' | 'email';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function initials(first?: string, last?: string) {
  const a = (first?.[0] || '').toUpperCase();
  const b = (last?.[0] || '').toUpperCase();
  return (a + b) || 'U';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function relativeTime(ts: number) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getEmailStatusIcon(status: string) {
  switch (status) {
    case 'sent':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function Badge({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'red' | 'blue' | 'green' | 'amber';
}) {
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    green: 'bg-green-50 text-green-700 ring-green-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1', map[tone])}>
      {children}
    </span>
  );
}

function TabPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition',
        active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
      )}
      type="button"
    >
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', active ? 'bg-white/15 text-white' : 'bg-red-100 text-red-700')}>
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
        <Bell className="h-5 w-5 text-gray-500" />
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function CardRow({
  icon,
  title,
  subtitle,
  metaLeft,
  metaRight,
  onClick,
  accent = 'blue',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  metaLeft?: React.ReactNode;
  metaRight?: React.ReactNode;
  onClick?: () => void;
  accent?: 'blue' | 'red' | 'amber' | 'green' | 'gray';
}) {
  const accents: Record<string, string> = {
    blue: 'ring-blue-200 bg-blue-50/60',
    red: 'ring-red-200 bg-red-50/60',
    amber: 'ring-amber-200 bg-amber-50/60',
    green: 'ring-green-200 bg-green-50/60',
    gray: 'ring-gray-200 bg-gray-50/60',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group w-full rounded-2xl p-3 text-left transition', 'bg-white ring-1 ring-gray-200 hover:shadow-sm hover:ring-gray-300')}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ring-1', accents[accent])}>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
          </div>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{subtitle}</p>}

          {(metaLeft || metaRight) && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0 text-xs text-gray-500">{metaLeft}</div>
              <div className="shrink-0 text-xs text-gray-500">{metaRight}</div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function parseNotificationData(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * ✅ تشخيص النوع (تبويبات) من data/module_name
 */
function typeFromNotification(n: NotificationRow): NotificationType {
  const data = parseNotificationData(n.data);
  const m = (n.module_name || n.notification_key || '').toString().toLowerCase();

  // approvals من أمثلتك
  if (data?.type === 'approval_request') {
    const rd = data?.request_data || {};
    if (rd?.leave_request_id) return 'leave';
    if (rd?.timesheet_id) return 'approval'; // تايم شيت نحطه تبويب approvals أو نغيره حسب رغبتك
    return 'approval';
  }

  if (m.includes('leave') || m.includes('vacation')) return 'leave';
  if (m.includes('attendance')) return 'attendance';
  if (m.includes('travel')) return 'travel';
  if (m.includes('document')) return 'document';
  if (m.includes('approval')) return 'approval';
  return 'approval';
}

/**
 * ✅ يولد الرابط الصحيح داخل صفحات الموديولات (بدون صفحة approvals مستقلة)
 * مهم: غيّر TIMESHEET_ROUTE اذا صفحتك اسمها مختلف.
 */
const TIMESHEET_ROUTE = '/timesheet'; // <-- غيّرها إذا صفحتك مثل /timesheets

function resolveActionLink(n: NotificationRow): string {
  const data = parseNotificationData(n.data);

  // إذا مخزّن رابط جاهز داخل data
  const dataLink = (data?.action_link || data?.route || data?.url || '').toString().trim();
  if (dataLink) {
    if (dataLink.startsWith('http://') || dataLink.startsWith('https://')) return dataLink;
    if (dataLink.startsWith('/')) return dataLink;
    return `/${dataLink}`;
  }

  // ✅ approvals (مثل أمثلتك)
  if (data?.type === 'approval_request') {
    const rd = data?.request_data || {};

    // 1) leave approvals داخل صفحة الإجازات
    if (rd?.leave_request_id) {
      // افتح صفحة الإجازات وخلّيها تعرف هذا طلب موافقة
      // تقدر بالصفحة تقرأ query: approval=1 و leave_request_id
      return `/vacation?approval=1&leave_request_id=${encodeURIComponent(rd.leave_request_id)}`;
    }

    // 2) timesheet approvals داخل صفحة التايم شيت
    if (rd?.timesheet_id) {
      return `${TIMESHEET_ROUTE}?approval=1&timesheet_id=${encodeURIComponent(rd.timesheet_id)}`;
    }

    // fallback approvals عامة داخل notifications
    return '/notifications?approval=1';
  }

  // fallback حسب module_name
  const m = (n.module_name || n.notification_key || '').toString().toLowerCase();
  if (m.includes('leave') || m.includes('vacation')) return '/vacation';
  if (m.includes('attendance')) return '/admin/attendance';
  if (m.includes('travel')) return '/travel';
  if (m.includes('document')) return '/document-requests';

  return '/notifications';
}

function iconByType(type: NotificationType) {
  const base = 'h-4 w-4';
  switch (type) {
    case 'leave':
      return <User className={cn(base, 'text-blue-700')} />;
    case 'attendance':
      return <MapPin className={cn(base, 'text-amber-700')} />;
    case 'travel':
      return <Plane className={cn(base, 'text-green-700')} />;
    case 'document':
      return <Mail className={cn(base, 'text-gray-700')} />;
    case 'approval':
    default:
      return <CheckSquare className={cn(base, 'text-purple-700')} />;
  }
}

function accentByType(type: NotificationType): 'blue' | 'amber' | 'green' | 'gray' | 'red' {
  switch (type) {
    case 'leave':
      return 'blue';
    case 'attendance':
      return 'amber';
    case 'travel':
      return 'green';
    case 'document':
      return 'gray';
    case 'approval':
    default:
      return 'red';
  }
}

function badgeByType(type: NotificationType) {
  switch (type) {
    case 'leave':
      return { tone: 'amber' as const, label: 'approval' };
    case 'attendance':
      return { tone: 'amber' as const, label: 'review' };
    case 'travel':
      return { tone: 'amber' as const, label: 'pending' };
    case 'document':
      return { tone: 'amber' as const, label: 'pending' };
    case 'approval':
    default:
      return { tone: 'amber' as const, label: 'action' };
  }
}

export default function NotificationBell() {
  const [notificationState, setNotificationState] = useState<NotificationState>(() => {
    try {
      const saved = localStorage.getItem('notificationState');
      if (!saved) return { notifications: [], lastUpdated: 0 };
      const parsed = JSON.parse(saved);
      return {
        notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : [],
        lastUpdated: typeof parsed?.lastUpdated === 'number' ? parsed.lastUpdated : 0,
      };
    } catch {
      return { notifications: [], lastUpdated: 0 };
    }
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [tab, setTab] = useState<TabKey>('all');

  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();

  const notifications = useMemo(
    () => (Array.isArray(notificationState.notifications) ? notificationState.notifications : []),
    [notificationState.notifications]
  );

  const totalNotifications = notifications.length;

  const sendPushNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/vite.svg', silent: false });
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    }
  }, []);

  const fetchEmailLogs = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('recipient', user.email)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error) {
      console.error('Error fetching email logs:', error);
    }
  }, [user]);

  /**
   * ✅ نجلب غير المقروء اعتماداً على notification_reads:
   * 1) نجيب read rows -> readIds
   * 2) نجيب notifications للمستخدم
   * 3) نستبعد ids اللي مقروءة
   */
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: readRows, error: readErr } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      if (readErr) throw readErr;

      const readIds: string[] = (readRows || []).map((r: any) => r.notification_id).filter(Boolean);

      let q: any = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false });

      if (readIds.length > 0) {
        // postgres in-list needs ( "id1","id2" )
        const inList = `(${readIds.map((id) => `"${id}"`).join(',')})`;
        q = q.not('id', 'in', inList);
      }

      const { data, error } = await q;
      if (error) throw error;

      setNotificationState({
        notifications: (data || []) as NotificationRow[],
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      sendPushNotification('Notification Error', 'Failed to load notifications. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, [user, sendPushNotification]);

  const debouncedFetch = useRef(debounce(fetchNotifications, 250)).current;

  useEffect(() => {
    if ('Notification' in window) Notification.requestPermission();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('notificationState', JSON.stringify(notificationState));
  }, [notificationState]);

  const filteredNotifications = useMemo(() => {
    if (tab === 'all') return notifications;
    if (tab === 'email') return [];
    return notifications.filter((n) => typeFromNotification(n) === tab);
  }, [tab, notifications]);

  const counts = useMemo(() => {
    const base = {
      leave: 0,
      attendance: 0,
      travel: 0,
      document: 0,
      approval: 0,
      email: emailLogs.length,
    };
    for (const n of notifications) {
      const t = typeFromNotification(n);
      (base as any)[t] += 1;
    }
    return base;
  }, [notifications, emailLogs.length]);

  const handleClickBell = () => {
    if (totalNotifications === 0 && !isAdmin) return;
    setIsOpen((v) => !v);
  };

  /**
   * ✅ مهم: ننتقل أولاً، بعدين نقرأ (حتى ما يصير يختفي بدون انتقال)
   * + نضيف query n=<id> حتى لو نفس الصفحة، يجبر الراوتر يسوي navigation
   */
  const handleNotificationClick = useCallback(
    (n: NotificationRow) => {
      const notifType = typeFromNotification(n);
      const baseTarget = resolveActionLink(n);

      const target =
        baseTarget.startsWith('http://') || baseTarget.startsWith('https://')
          ? baseTarget
          : baseTarget.includes('?')
          ? `${baseTarget}&n=${encodeURIComponent(n.id)}`
          : `${baseTarget}?n=${encodeURIComponent(n.id)}`;

      setIsOpen(false);

      // 1) Navigate first
      if (target.startsWith('http://') || target.startsWith('https://')) {
        window.open(target, '_blank', 'noopener,noreferrer');
      } else {
        navigate(target);
      }

      // 2) Mark as read after a short delay
      setTimeout(async () => {
        try {
          if (!user?.id) return;

          const { error } = await supabase.from('notification_reads').insert({
            user_id: user.id,
            notification_type: notifType,
            notification_id: n.id,
          });

          // ignore duplicate press
          if (error && error.code !== '23505') throw error;

          // remove from UI
          setNotificationState((prev) => ({
            ...prev,
            notifications: (prev.notifications || []).filter((x) => x.id !== n.id),
            lastUpdated: Date.now(),
          }));
        } catch (e) {
          console.error('Error marking notification as read:', e);
          fetchNotifications();
        }
      }, 150);
    },
    [navigate, user?.id, fetchNotifications]
  );

  const showPanel = !!user && (isAdmin || totalNotifications > 0);

  useEffect(() => {
    if (!user) return;

    debouncedFetch();
    fetchEmailLogs();

    const interval = setInterval(() => debouncedFetch(), 12000);

    const subs = [
      supabase
        .channel('notifications_changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${user.id}` },
          () => fetchNotifications()
        )
        .subscribe(),

      supabase
        .channel('notification_reads_changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notification_reads', filter: `user_id=eq.${user.id}` },
          () => fetchNotifications()
        )
        .subscribe(),

      supabase
        .channel('email_logs_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'email_logs', filter: `recipient=eq.${user.email}` },
          () => fetchEmailLogs()
        )
        .subscribe(),
    ];

    return () => {
      clearInterval(interval);
      subs.forEach((s) => s.unsubscribe());
    };
  }, [user, debouncedFetch, fetchNotifications, fetchEmailLogs]);

  if (!showPanel) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell */}
      <button
        onClick={handleClickBell}
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl p-2 transition',
          'text-gray-700 hover:bg-gray-100 active:scale-[0.98]',
          isOpen && 'bg-gray-100'
        )}
        aria-label={`Notifications ${totalNotifications > 0 ? `(${totalNotifications} new)` : ''}`}
        type="button"
      >
        <Bell className={cn('h-5 w-5', totalNotifications > 0 && 'animate-[pulse_2s_ease-in-out_infinite]')} />
        {totalNotifications > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            {totalNotifications}
          </span>
        )}
      </button>

      {/* Overlay for mobile */}
      {isOpen && isMobileView && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]" onClick={() => setIsOpen(false)} />
      )}

      {/* Panel */}
      {isOpen && (
        <div className={cn('z-[70]', isMobileView ? 'fixed inset-x-0 bottom-0' : 'absolute right-0 mt-3 w-[440px]')}>
          <div className={cn('overflow-hidden bg-white shadow-xl ring-1 ring-black/5', isMobileView ? 'rounded-t-3xl' : 'rounded-3xl')}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-900 text-white">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Notifications</p>
                  <p className="text-xs text-gray-500">
                    Updated {relativeTime(notificationState.lastUpdated)}
                    {totalNotifications > 0 && (
                      <span className="ml-2">
                        <Badge tone="red">{totalNotifications} new</Badge>
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    fetchEmailLogs();
                    fetchNotifications();
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-gray-200',
                    'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <TabPill active={tab === 'all'} onClick={() => setTab('all')} label="All" count={totalNotifications} />
                <TabPill active={tab === 'leave'} onClick={() => setTab('leave')} label="Leave" count={counts.leave} />
                <TabPill active={tab === 'attendance'} onClick={() => setTab('attendance')} label="Attendance" count={counts.attendance} />
                <TabPill active={tab === 'travel'} onClick={() => setTab('travel')} label="Travel" count={counts.travel} />
                <TabPill active={tab === 'document'} onClick={() => setTab('document')} label="Documents" count={counts.document} />
                <TabPill active={tab === 'approval'} onClick={() => setTab('approval')} label="Approvals" count={counts.approval} />
                <TabPill active={tab === 'email'} onClick={() => setTab('email')} label="Email" count={counts.email} />
              </div>
            </div>

            {/* Content */}
            <div className={cn('max-h-[70vh] overflow-y-auto px-4 pb-4', isMobileView ? 'pt-1' : 'pt-1')}>
              {/* Email */}
              {tab === 'email' && (
                <div className="space-y-3">
                  {emailLogs.length === 0 ? (
                    <EmptyState title="No email history" subtitle="Nothing has been sent to your email yet." />
                  ) : (
                    emailLogs.map((log) => (
                      <div key={log.id} className="rounded-2xl bg-white p-3 ring-1 ring-gray-200">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{log.subject}</p>
                            <p className="mt-1 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getEmailStatusIcon(log.status)}
                            <Badge tone={log.status === 'sent' ? 'green' : log.status === 'failed' ? 'red' : 'amber'}>{log.status}</Badge>
                          </div>
                        </div>
                        {log.error && (
                          <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 p-2 ring-1 ring-red-200">
                            <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" />
                            <p className="text-xs text-red-700">{log.error}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Notifications list */}
              {tab !== 'email' && (
                <>
                  {filteredNotifications.length === 0 && !isLoading ? (
                    <EmptyState
                      title={tab === 'all' ? "You're all caught up" : `No ${tab} notifications`}
                      subtitle={tab === 'all' ? 'No new notifications.' : 'Nothing pending right now.'}
                    />
                  ) : (
                    <div className="space-y-2">
                      {filteredNotifications.map((n) => {
                        const t = typeFromNotification(n);
                        const badge = badgeByType(t);

                        return (
                          <CardRow
                            key={n.id}
                            accent={accentByType(t)}
                            icon={
                              <div
                                className={cn('flex h-8 w-8 items-center justify-center rounded-xl bg-white ring-1', {
                                  'ring-blue-200': t === 'leave',
                                  'ring-amber-200': t === 'attendance',
                                  'ring-green-200': t === 'travel',
                                  'ring-gray-200': t === 'document',
                                  'ring-purple-200': t === 'approval',
                                })}
                              >
                                {iconByType(t)}
                              </div>
                            }
                            title={(n.title || n.subject || 'Notification').toString()}
                            subtitle={(n.body || '').toString()}
                            metaLeft={
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(n.created_at)} • {formatTime(n.created_at)}
                              </span>
                            }
                            metaRight={<Badge tone={badge.tone}>{badge.label}</Badge>}
                            onClick={() => handleNotificationClick(n)}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {isLoading && (
                <div className="mt-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading latest updates…
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                    <span className="text-sm font-bold">
                      {initials((user as any)?.user_metadata?.first_name, (user as any)?.user_metadata?.last_name)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900">Quick actions</p>
                    <p className="truncate text-[11px] text-gray-500">Open related pages</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/document-requests');
                    }}
                    className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-200"
                  >
                    Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/notifications');
                    }}
                    className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                  >
                    View all
                  </button>
                </div>
              </div>
            </div>

            {/* mobile safe area */}
            {isMobileView && <div className="h-[env(safe-area-inset-bottom)] bg-white" />}
          </div>
        </div>
      )}
    </div>
  );
}
