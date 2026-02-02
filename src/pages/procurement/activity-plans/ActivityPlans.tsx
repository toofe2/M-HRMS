// src/pages/procurement/activity-plans/ActivityPlans.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  FileText,
  Eye,
  CalendarDays,
  Hash,
  Edit3,
  MapPin,
  Building2,
  Users,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';
import { useAuthStore } from '../../../store/authStore';

type DraftRow = {
  id: string;
  owner_user_id: string | null;
  title: string | null;
  draft_payload: any; // jsonb
  is_archived: boolean | null;
  created_at: string;
  updated_at: string;
};

function safeJson<T = any>(v: any): T | null {
  try {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') return v as T;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return null;
      return JSON.parse(s) as T;
    }
    return null;
  } catch {
    return null;
  }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB');
  } catch {
    return d;
  }
}

export default function ActivityPlans() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('activity_plan_drafts')
        .select('id, owner_user_id, title, draft_payload, is_archived, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data || []) as DraftRow[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load activity plan drafts');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (!showArchived && r.is_archived) return false;

      const payload = safeJson<any>(r.draft_payload) || (r.draft_payload || null);
      const apNumber = (payload?.ap_number as string) || '';
      const info = payload?.info || {};
      const title = (r.title || info?.title || '').toString();
      const subtitle = (info?.subtitle || '').toString();
      const location = (info?.location || '').toString();

      const matchQ =
        !needle ||
        title.toLowerCase().includes(needle) ||
        subtitle.toLowerCase().includes(needle) ||
        location.toLowerCase().includes(needle) ||
        apNumber.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle);

      return matchQ;
    });
  }, [rows, q, showArchived]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/procurement')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
                type="button"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Activity Plans</h1>
                <p className="text-xs text-gray-500">Drafts saved in activity_plan_drafts</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationBell />
              <SettingsButton />

              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100">
                  {user?.user_metadata?.profile_image_url || user?.user_metadata?.avatar_url ? (
                    <OptimizedImage
                      src={user.user_metadata.profile_image_url || user.user_metadata.avatar_url}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="h-8 w-8 object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-700 text-sm font-medium">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-gray-700 text-sm">{user?.email}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search AP number, title, location..."
                  className="w-full md:w-96 pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived
              </label>

              <button
                onClick={fetchData}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <button
              onClick={() => navigate('/procurement/activity-plans/new')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
              type="button"
            >
              <Plus className="h-4 w-4" />
              New Activity Plan
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">All Drafts</h3>
              <p className="text-sm text-gray-500">{filtered.length} record(s)</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <div className="text-gray-900 font-medium">No drafts found</div>
              <div className="text-sm text-gray-500 mt-1">Create a new Activity Plan to get started.</div>
              <button
                onClick={() => navigate('/procurement/activity-plans/new')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                type="button"
              >
                <Plus className="h-4 w-4" />
                New Activity Plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const payload = safeJson<any>(r.draft_payload) || (r.draft_payload || null);
                const apNumber = (payload?.ap_number as string) || `AP-${r.id.slice(0, 8)}`;
                const info = payload?.info || {};

                const title = (r.title || info?.title || 'Untitled Activity Plan') as string;
                const subtitle = (info?.subtitle || '') as string;
                const location = (info?.location || '') as string;
                const projectId = (info?.project_id || '') as string;
                const start = info?.start_date || null;
                const end = info?.end_date || null;

                const participantsCount = Array.isArray(payload?.participants) ? payload.participants.length : 0;

                return (
                  <div key={r.id} className="p-5 hover:bg-gray-50">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
                            <Hash className="h-4 w-4 text-gray-400" />
                            {apNumber}
                          </span>

                          {r.is_archived ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200">
                              ARCHIVED
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 text-gray-900 font-medium truncate">{title}</div>
                        {subtitle ? <div className="text-sm text-gray-500 truncate">{subtitle}</div> : null}

                        <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-4 w-4 text-gray-400" />
                            {fmtDate(start)} → {fmtDate(end)}
                          </span>

                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="h-4 w-4 text-gray-400" />
                            {location || '—'}
                          </span>

                          <span className="inline-flex items-center gap-1 truncate">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {projectId ? `Project: ${projectId.slice(0, 8)}…` : 'No project'}
                          </span>

                          <span className="inline-flex items-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            {participantsCount}
                          </span>
                        </div>

                        <div className="mt-2 text-xs text-gray-500">
                          Updated: <span className="text-gray-700 font-medium">{fmtDate(r.updated_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* ✅ Open = Details */}
                        <button
                          onClick={() => navigate(`/procurement/activity-plans/${r.id}`)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-white"
                          type="button"
                        >
                          <Eye className="h-4 w-4" />
                          Open
                        </button>

                        {/* ✅ Edit = Form */}
                        <button
                          onClick={() => navigate(`/procurement/activity-plans/${r.id}/edit`)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
                          type="button"
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
