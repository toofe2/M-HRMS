import React, { useState, useRef, useEffect } from 'react';
import { Settings, User, Bell, Shield, Moon, Sun, LogOut, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    // TODO: Implement dark mode functionality
  };

  const menuItems = [
    {
      icon: User,
      label: 'Profile Settings',
      onClick: () => navigate('/personal-info'),
    },
    {
      icon: Bell,
      label: 'Notification Settings',
      onClick: () => {/* TODO: Implement notification settings */},
    },
    {
      icon: isDarkMode ? Sun : Moon,
      label: isDarkMode ? 'Light Mode' : 'Dark Mode',
      onClick: handleToggleDarkMode,
    },
    {
      icon: Star,
      label: 'Request Approval',
      onClick: () => navigate('/request-approval'),
    },
    ...(isAdmin ? [{
      icon: Shield,
      label: 'Admin Settings',
      onClick: () => navigate('/admin/settings'),
    }] : []),
    {
      icon: LogOut,
      label: 'Sign Out',
      onClick: signOut,
      className: 'text-red-600 hover:text-red-700',
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        title="Settings"
      >
        <Settings className="h-6 w-6" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg z-50">
          <div className="py-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-gray-50 ${
                  item.className || 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
