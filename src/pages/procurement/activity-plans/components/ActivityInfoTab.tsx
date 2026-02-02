import React, { memo } from 'react';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import type { CityRow, ProjectRow, Currency } from '../types/activityPlan';

type Props = {
  projects: ProjectRow[];
  cities?: CityRow[];

  apNumber: string | null;
  baseCurrency: Currency;

  projectId: string | null;
  title: string;
  subtitle: string;
  location: string;
  startDate: string | null;
  endDate: string | null;

  days: number;
  totalParticipants: number;

  // ✅ new names (used in your ActivityPlanForm حاليا)
  onChangeProjectId?: (v: string | null) => void;
  onChangeTitle?: (v: string) => void;
  onChangeSubtitle?: (v: string) => void;
  onChangeLocation?: (v: string) => void;
  onChangeStartDate?: (v: string | null) => void;
  onChangeEndDate?: (v: string | null) => void;

  // ✅ old names (backward compatible)
  setProjectId?: (v: string | null) => void;
  setTitle?: (v: string) => void;
  setSubtitle?: (v: string) => void;
  setLocation?: (v: string) => void;
  setStartDate?: (v: string | null) => void;
  setEndDate?: (v: string | null) => void;
};

// ✅ لازم يكون خارج ActivityInfoTab حتى ما يصير remount ويفقد الفوكس
const Card = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="px-5 py-3 border-b border-gray-200">
      <div className="font-semibold text-gray-900">{title}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
));

function ActivityInfoTab(props: Props) {
  const {
    projects,
    apNumber,
    baseCurrency,
    projectId,
    title,
    subtitle,
    location,
    startDate,
    endDate,
    days,
    totalParticipants,
  } = props;

  // ✅ unify handlers: prefer onChange* then fallback to set*
  const onProjectId = props.onChangeProjectId || props.setProjectId || (() => {});
  const onTitle = props.onChangeTitle || props.setTitle || (() => {});
  const onSubtitle = props.onChangeSubtitle || props.setSubtitle || (() => {});
  const onLocation = props.onChangeLocation || props.setLocation || (() => {});
  const onStartDate = props.onChangeStartDate || props.setStartDate || (() => {});
  const onEndDate = props.onChangeEndDate || props.setEndDate || (() => {});

  return (
    <Card title="Activity Information">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm">
          <div className="text-gray-600 mb-1">Project *</div>
          <select
            value={projectId || ''}
            onChange={(e) => onProjectId(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
          >
            <option value="">Select project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Location</div>
          <div className="relative">
            <MapPin className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={location}
              onChange={(e) => onLocation(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md"
              placeholder="e.g. Baghdad, Erbil..."
              autoComplete="off"
            />
          </div>
        </label>

        <label className="text-sm md:col-span-2">
          <div className="text-gray-600 mb-1">Activity Title *</div>
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
            placeholder="e.g. FGD Session 1"
            autoComplete="off"
          />
        </label>

        <label className="text-sm md:col-span-2">
          <div className="text-gray-600 mb-1">Subtitle</div>
          <input
            value={subtitle}
            onChange={(e) => onSubtitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
            placeholder="Optional"
            autoComplete="off"
          />
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">Start Date *</div>
          <div className="relative">
            <CalendarDays className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => onStartDate(e.target.value || null)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
        </label>

        <label className="text-sm">
          <div className="text-gray-600 mb-1">End Date *</div>
          <div className="relative">
            <CalendarDays className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => onEndDate(e.target.value || null)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
        </label>

        <div className="text-sm md:col-span-2 flex flex-wrap items-center gap-4 text-gray-700">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Participants: <b>{totalParticipants}</b>
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            Days: <b>{days}</b>
          </span>
          <span className="inline-flex items-center gap-2 text-gray-500">
            AP: <b className="text-gray-700">{apNumber || '—'}</b> · Base:{' '}
            <b className="text-gray-700">{baseCurrency}</b>
          </span>
        </div>
      </div>
    </Card>
  );
}

export default memo(ActivityInfoTab);
