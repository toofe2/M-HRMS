import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function ChangePasswordCard() {
  const { user } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!currentPassword && !!newPassword && newPassword === confirmPassword && newPassword.length >= 8;
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const email = user?.email;
    if (!email) {
      setError('Cannot determine your account email. Please sign out and sign in again.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    try {
      setSaving(true);

      // ✅ Re-authenticate to ensure the user knows their current password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) {
        // Most common message: Invalid login credentials
        throw new Error('Current password is incorrect.');
      }

      // ✅ Update password for the currently authenticated user
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password updated successfully.');
    } catch (err: any) {
      console.error('Error changing password:', err);
      setError(err?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    value,
    onChange,
    show,
    setShow,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    setShow: (v: boolean) => void;
    placeholder?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
          <KeyRound className="h-5 w-5" />
        </div>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-10 pr-12 py-2 border rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Security</h3>
        <p className="mt-1 text-sm text-gray-500">Change your account password</p>
      </div>

      {(error || success) && (
        <div className={`p-4 ${error ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {error ? (
                <AlertCircle className="h-5 w-5 text-red-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm ${error ? 'text-red-700' : 'text-green-700'}`}>{error || success}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            setShow={setShowCurrent}
            placeholder="Enter current password"
          />
          <Field
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            setShow={setShowNew}
            placeholder="At least 8 characters"
          />
          <Field
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            setShow={setShowConfirm}
            placeholder="Repeat new password"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-gray-500">
            Tip: Use a strong password (mix letters, numbers, and symbols).
          </p>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${
              canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <KeyRound className="h-5 w-5 mr-2" />
                Update Password
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
