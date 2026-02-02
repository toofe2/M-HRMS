import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  MarkAsRead,
  Calendar,
  User,
  Flag
} from 'lucide-react';
import { useApprovalSystem } from '../../hooks/useApprovalSystem';
import { ApprovalNotification } from '../../types/approval';

export default function ApprovalNotificationBell() {
  const { notifications, markNotificationAsRead } = useApprovalSystem();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: ApprovalNotification) => {
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
    }
    setIsOpen(false);
    // يمكن إضافة منطق للانتقال إلى الطلب المحدد
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.is_read);
    for (const notification of unreadNotifications) {
      await markNotificationAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_request':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'escalated':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'reminder':
        return <Bell className="h-4 w-4 text-yellow-500" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - notificationDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'الآن';
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    if (diffInMinutes < 1440) return `منذ ${Math.floor(diffInMinutes / 60)} ساعة`;
    return `منذ ${Math.floor(diffInMinutes / 1440)} يوم`;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none transition-colors"
        aria-label={`الإشعارات ${unreadCount > 0 ? `(${unreadCount} جديد)` : ''}`}
      >
        <Bell className={`h-6 w-6 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 rtl:-right-auto rtl:-left-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform bg-red-600 rounded-full animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 rtl:left-auto rtl:right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Bell className="h-5 w-5 ml-2 rtl:ml-0 rtl:mr-2 text-gray-600" />
                إشعارات الموافقة
                {unreadCount > 0 && (
                  <span className="mr-2 rtl:mr-0 rtl:ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                    {unreadCount} جديد
                  </span>
                )}
              </h3>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  لا توجد إشعارات
                </h3>
                <p className="text-gray-600">
                  ستظهر إشعارات الموافقة هنا
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3 rtl:space-x-reverse">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.notification_type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${
                            !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                          }`}>
                            {notification.title}
                          </p>
                          <span className="text-xs text-gray-500 flex-shrink-0 mr-2 rtl:mr-0 rtl:ml-2">
                            {formatDate(notification.created_at)}
                          </span>
                        </div>
                        
                        <p className={`mt-1 text-sm ${
                          !notification.is_read ? 'text-gray-700' : 'text-gray-500'
                        } line-clamp-2`}>
                          {notification.message}
                        </p>
                        
                        {!notification.is_read && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              جديد
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // يمكن إضافة منطق للانتقال إلى صفحة الإشعارات الكاملة
                }}
                className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-800 py-2"
              >
                عرض جميع الإشعارات
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}