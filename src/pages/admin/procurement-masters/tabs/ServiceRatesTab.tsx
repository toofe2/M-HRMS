import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { Card, DangerButton, InlineStatus, PrimaryButton, SecondaryButton, ReloadIcon } from '../ui';

type Currency = 'USD' | 'IQD';
type PricingBasis = 'per_person' | 'per_unit' | 'per_day' | 'per_trip' | string;

type CityRow = { id: string; name: string; is_active: boolean };

type ServiceRateRow = {
  id: string;
  service_type: string;
  city_id: string | null;
  pricing_basis: PricingBasis;
  currency: Currency;
  unit_price: number;
  is_active: boolean;
};

const normalize = (s: string) => (s || '').trim().toLowerCase();

export default function ServiceRatesTab() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [rows, setRows] = useState<ServiceRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Add form
  const [serviceType, setServiceType] = useState('');
  const [cityId, setCityId] = useState<string>(''); // empty = null in DB
  const [pricingBasis, setPricingBasis] = useState<PricingBasis>('per_person');
  const [currency, setCurrency] = useState<Currency>('IQD');
  const [unitPrice, setUnitPrice] = useState('0');

  // Filters
  const [onlyActive, setOnlyActive] = useState(true);
  const [filterCityId, setFilterCityId] = useState<string>('');
  const [q, setQ] = useState('');

  const cityName = useCallback(
    (id: string | null) => {
      if (!id) return 'All Cities';
      return cities.find((c) => c.id === id)?.name || '—';
    },
    [cities]
  );

  const activeCities = useMemo(() => cities.filter((c) => c.is_active), [cities]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [cRes, sRes] = await Promise.all([
        supabase.from('cities').select('id,name,is_active').order('name', { ascending: true }),
        supabase
          .from('service_rates')
          .select('id,service_type,city_id,pricing_basis,currency,unit_price,is_active')
          .order('service_type', { ascending: true }),
      ]);

      if (cRes.error) throw cRes.error;
      if (sRes.error) throw sRes.error;

      setCities((cRes.data || []) as CityRow[]);
      setRows((sRes.data || []) as ServiceRateRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load service rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Duplicate rule (practical): same service_type + (city_id null/selected) + pricing_basis + currency
  const duplicateWarning = useMemo(() => {
    const st = normalize(serviceType);
    if (!st) return null;

    const cid = cityId ? cityId : null;
    const pb = pricingBasis;
    const cur = currency;

    const dup = rows.some(
      (r) =>
        normalize(r.service_type) === st &&
        (r.city_id ?? null) === cid &&
        r.pricing_basis === pb &&
        r.currency === cur
    );

    return dup
      ? 'Duplicate detected: same Service Type + City + Pricing Basis + Currency already exists.'
      : null;
  }, [serviceType, cityId, pricingBasis, currency, rows]);

  const canAdd = useMemo(() => {
    const st = serviceType.trim();
    if (!st) return false;

    const p = Number(unitPrice || 0);
    if (!Number.isFinite(p) || p < 0) return false;

    if (duplicateWarning) return false;
    return true;
  }, [serviceType, unitPrice, duplicateWarning]);

  const addServiceRate = useCallback(async () => {
    const st = serviceType.trim();
    if (!st) {
      setError('Service Type is required.');
      return;
    }

    if (duplicateWarning) {
      setError(duplicateWarning);
      return;
    }

    const p = Number(unitPrice || 0);
    if (!Number.isFinite(p) || p < 0) {
      setError('Unit price must be a valid non-negative number.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setOk(null);

      const payload = {
        service_type: st,
        city_id: cityId ? cityId : null,
        pricing_basis: pricingBasis,
        currency,
        unit_price: p,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('service_rates')
        .insert(payload)
        .select('id,service_type,city_id,pricing_basis,currency,unit_price,is_active')
        .single();

      if (error) throw error;

      setRows((prev) => {
        const next = [...prev, data as ServiceRateRow];
        next.sort((a, b) => (a.service_type || '').localeCompare(b.service_type || ''));
        return next;
      });

      setOk('Service rate added.');
      setTimeout(() => setOk(null), 1500);

      setServiceType('');
      setUnitPrice('0');
    } catch (e: any) {
      setError(e?.message || 'Failed to add service rate.');
    } finally {
      setSaving(false);
    }
  }, [serviceType, cityId, pricingBasis, currency, unitPrice, duplicateWarning]);

  const updateServiceRate = useCallback(
    async (id: string, patch: Partial<ServiceRateRow>) => {
      try {
        setSaving(true);
        setError(null);

        const current = rows.find((r) => r.id === id);

        const clean: any = { ...patch };
        if (typeof clean.service_type === 'string') clean.service_type = clean.service_type.trim();
        if (clean.city_id === '') clean.city_id = null;

        if (clean.service_type !== undefined && !clean.service_type) {
          setError('Service Type cannot be empty.');
          return;
        }

        if (
          typeof clean.unit_price === 'number' &&
          (!Number.isFinite(clean.unit_price) || clean.unit_price < 0)
        ) {
          setError('Unit price must be a valid non-negative number.');
          return;
        }

        // Duplicate prevention on update
        if (current) {
          const nextType = normalize(clean.service_type ?? current.service_type);
          const nextCity = (clean.city_id ?? current.city_id) ?? null;
          const nextBasis = (clean.pricing_basis ?? current.pricing_basis) as string;
          const nextCur = (clean.currency ?? current.currency) as Currency;

          const dup = rows.some(
            (r) =>
              r.id !== id &&
              normalize(r.service_type) === nextType &&
              (r.city_id ?? null) === nextCity &&
              r.pricing_basis === nextBasis &&
              r.currency === nextCur
          );

          if (dup) {
            setError('Cannot update: duplicate Service Type + City + Pricing Basis + Currency already exists.');
            return;
          }
        }

        const { error } = await supabase.from('service_rates').update(clean).eq('id', id);
        if (error) throw error;

        setRows((prev) => {
          const next = prev.map((r) => (r.id === id ? ({ ...r, ...clean } as ServiceRateRow) : r));
          next.sort((a, b) => (a.service_type || '').localeCompare(b.service_type || ''));
          return next;
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to update service rate.');
      } finally {
        setSaving(false);
      }
    },
    [rows]
  );

  const deleteServiceRate = useCallback(async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase.from('service_rates').delete().eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      setOk('Service rate deleted.');
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete service rate.');
    } finally {
      setSaving(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const qq = normalize(q);
    return rows
      .filter((r) => (onlyActive ? !!r.is_active : true))
      .filter((r) => (filterCityId ? (r.city_id ?? '') === filterCityId : true))
      .filter((r) => {
        if (!qq) return true;
        const meta = `${r.service_type} ${cityName(r.city_id)} ${r.pricing_basis} ${r.currency} ${r.unit_price}`;
        return normalize(meta).includes(qq);
      });
  }, [rows, onlyActive, filterCityId, q, cityName]);

  const right = (
    <SecondaryButton onClick={load} disabled={loading}>
      <ReloadIcon spinning={loading} />
      Refresh
    </SecondaryButton>
  );

  return (
    <div className="space-y-4">
      <InlineStatus error={error} ok={ok} />

      <Card title="Service Rates" right={right}>
        {/* Add form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
          <label className="text-sm md:col-span-3">
            <div className="text-gray-600 mb-1">Service Type</div>
            <input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              placeholder="e.g., coffee_break / lunch / airport_taxi"
            />
          </label>

          <label className="text-sm md:col-span-3">
            <div className="text-gray-600 mb-1">City (optional)</div>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="">All Cities</option>
              {activeCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <div className="text-gray-600 mb-1">Pricing Basis</div>
            <input
              value={pricingBasis}
              onChange={(e) => setPricingBasis(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              placeholder="per_person / per_unit / per_trip ..."
            />
          </label>

          <label className="text-sm md:col-span-2">
            <div className="text-gray-600 mb-1">Currency</div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="IQD">IQD</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <div className="text-gray-600 mb-1">Unit Price</div>
            <input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              inputMode="decimal"
            />
          </label>

          <div className="flex items-end md:col-span-12">
            <PrimaryButton onClick={addServiceRate} disabled={saving || loading || !canAdd}>
              <Plus className="h-4 w-4" />
              Add Service Rate
            </PrimaryButton>
          </div>

          {duplicateWarning && (
            <div className="md:col-span-12 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {duplicateWarning}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
          <label className="text-sm">
            <div className="text-gray-600 mb-1">Filter by City</div>
            <select
              value={filterCityId}
              onChange={(e) => setFilterCityId(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="">All</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.is_active ? '' : '(inactive)'}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm flex-1">
            <div className="text-gray-600 mb-1">Search</div>
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md"
                placeholder="Type / city / currency..."
              />
            </div>
          </label>

          <label className="text-sm inline-flex items-center gap-2 mt-2 md:mt-0">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
            Show active only
          </label>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No service rates found.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Service Type</th>
                  <th className="text-left p-3">City</th>
                  <th className="text-left p-3">Pricing Basis</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-left p-3">Unit Price</th>
                  <th className="text-left p-3">Active</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y bg-white">
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3">
                      <input
                        className="w-56 max-w-full px-3 py-2 border border-gray-200 rounded-md"
                        value={r.service_type}
                        disabled={saving}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, service_type: e.target.value } : x))
                          )
                        }
                        onBlur={(e) => updateServiceRate(r.id, { service_type: e.target.value })}
                      />
                    </td>

                    <td className="p-3">
                      <select
                        value={r.city_id ?? ''}
                        onChange={(e) => updateServiceRate(r.id, { city_id: e.target.value || null })}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                        disabled={saving}
                      >
                        <option value="">All Cities</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.is_active ? '' : '(inactive)'}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3">
                      <input
                        className="w-40 px-3 py-2 border border-gray-200 rounded-md"
                        value={r.pricing_basis}
                        disabled={saving}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, pricing_basis: e.target.value } : x))
                          )
                        }
                        onBlur={(e) => updateServiceRate(r.id, { pricing_basis: e.target.value })}
                      />
                    </td>

                    <td className="p-3">
                      <select
                        value={r.currency}
                        onChange={(e) => updateServiceRate(r.id, { currency: e.target.value as Currency })}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                        disabled={saving}
                      >
                        <option value="IQD">IQD</option>
                        <option value="USD">USD</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <input
                        className="w-32 px-3 py-2 border border-gray-200 rounded-md"
                        value={String(r.unit_price ?? 0)}
                        disabled={saving}
                        inputMode="decimal"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, unit_price: Number(e.target.value || 0) } : x
                            )
                          )
                        }
                        onBlur={(e) => updateServiceRate(r.id, { unit_price: Number(e.target.value || 0) })}
                      />
                    </td>

                    <td className="p-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r.is_active}
                          disabled={saving}
                          onChange={(e) => updateServiceRate(r.id, { is_active: e.target.checked })}
                        />
                        {r.is_active ? 'Yes' : 'No'}
                      </label>
                    </td>

                    <td className="p-3">
                      <DangerButton onClick={() => deleteServiceRate(r.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DangerButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs text-gray-500 mt-3">
              Tip: If you need city-specific pricing, set a city. Otherwise keep it as “All Cities”.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
