import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Settings, MapPin, Car, Building2, HandCoins } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import CitiesTab from './procurement-masters/tabs/CitiesTab';
import TransportRoutesTab from './procurement-masters/tabs/TransportRoutesTab';
import HotelRatesTab from './procurement-masters/tabs/HotelRatesTab';
import ServiceRatesTab from './procurement-masters/tabs/ServiceRatesTab';

type TabKey = 'cities' | 'routes' | 'hotels' | 'services';

const TAB_STORAGE_KEY = 'procurement_masters_tab';

const TabButton = ({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: any;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-colors ${
      active
        ? 'bg-gray-900 text-white border-gray-900'
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
    }`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

function isValidTab(v: string | null): v is TabKey {
  return v === 'cities' || v === 'routes' || v === 'hotels' || v === 'services';
}

export default function AdminProcurementMasters() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = useMemo(
    () =>
      [
        { key: 'cities' as const, label: 'Cities', title: 'Cities / Governorates', icon: MapPin },
        { key: 'routes' as const, label: 'Transport Routes', title: 'Transport Routes', icon: Car },
        { key: 'hotels' as const, label: 'Hotels', title: 'Hotels & Rates', icon: Building2 },
        {
          key: 'services' as const,
          label: 'Services',
          title: 'Service Rates (Coffee Break / Lunch / Airport Taxi / Flight ...)',
          icon: HandCoins,
        },
      ] as const,
    []
  );

  const [tab, setTab] = useState<TabKey>('cities');

  // Read tab from URL (?tab=) OR localStorage on first mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTab = params.get('tab');
    if (isValidTab(urlTab)) {
      setTab(urlTab);
      localStorage.setItem(TAB_STORAGE_KEY, urlTab);
      return;
    }

    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (isValidTab(stored)) {
      setTab(stored);
      // also sync URL for consistency
      const next = new URLSearchParams(location.search);
      next.set('tab', stored);
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep URL + localStorage in sync whenever tab changes
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab);

    const params = new URLSearchParams(location.search);
    const current = params.get('tab');

    if (current !== tab) {
      params.set('tab', tab);
      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    }
  }, [tab, location.pathname, location.search, navigate]);

  const title = useMemo(() => tabs.find((t) => t.key === tab)?.title || 'Procurement Masters', [tab, tabs]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-900">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Procurement Admin Settings</h1>
                <p className="text-xs text-gray-500">Masters / constants used by Activity Plans</p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500">{title}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <TabButton
              key={t.key}
              active={tab === t.key}
              label={t.label}
              icon={t.icon}
              onClick={() => setTab(t.key)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4 pb-10">
        {tab === 'cities' && <CitiesTab />}
        {tab === 'routes' && <TransportRoutesTab />}
        {tab === 'hotels' && <HotelRatesTab />}
        {tab === 'services' && <ServiceRatesTab />}
      </main>
    </div>
  );
}
