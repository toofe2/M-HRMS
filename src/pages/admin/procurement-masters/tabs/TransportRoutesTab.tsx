import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { Card, DangerButton, InlineStatus, PrimaryButton, SecondaryButton, ReloadIcon } from '../ui';

type Currency = 'USD' | 'IQD';
type TransportBasis = 'per_trip' | 'per_person';

type CityRow = { id: string; name: string; is_active: boolean };

type RouteRow = {
  id: string;
  city_a_id: string;
  city_b_id: string;
  pricing_basis_default: TransportBasis;
  currency: Currency;
  unit_price: number;
  is_active: boolean;
};

const normalize = (s: string) => (s || '').trim().toLowerCase();

function makeRouteKey(a: string, b: string) {
  // Treat A->B and B->A as same "route family" (bidirectional duplicate protection).
  return [a, b].sort().join('__');
}

export default function TransportRoutesTab() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Add form
  const [cityA, setCityA] = useState<string>('');
  const [cityB, setCityB] = useState<string>('');
  const [basis, setBasis] = useState<TransportBasis>('per_trip');
  const [currency, setCurrency] = useState<Currency>('IQD');
  const [unitPrice, setUnitPrice] = useState<string>('0');

  // Filters
  const [onlyActive, setOnlyActive] = useState(true);
  const [filterCityId, setFilterCityId] = useState<string>('');
  const [q, setQ] = useState('');

  const cityName = useCallback(
    (id: string) => cities.find((c) => c.id === id)?.name || '—',
    [cities]
  );

  const activeCities = useMemo(() => cities.filter((c) => c.is_active), [cities]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [cRes, rRes] = await Promise.all([
        supabase.from('cities').select('id,name,is_active').order('name', { ascending: true }),
        supabase
          .from('transport_routes')
          .select('id,city_a_id,city_b_id,pricing_basis_default,currency,unit_price,is_active')
          .order('id', { ascending: false }),
      ]);

      if (cRes.error) throw cRes.error;
      if (rRes.error) throw rRes.error;

      setCities((cRes.data || []) as CityRow[]);
      setRows((rRes.data || []) as RouteRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load transport routes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const routeDuplicateWarning = useMemo(() => {
    if (!cityA || !cityB || cityA === cityB) return null;

    const newKey = makeRouteKey(cityA, cityB);
    const existing = rows.find((r) => makeRouteKey(r.city_a_id, r.city_b_id) === newKey);

    if (!existing) return null;

    const label = `${cityName(existing.city_a_id)} → ${cityName(existing.city_b_id)}`;
    return `Duplicate route detected (including reverse): ${label}`;
  }, [cityA, cityB, rows, cityName]);

  const canAdd = useMemo(() => {
    if (!cityA || !cityB) return false;
    if (cityA === cityB) return false;

    const parsed = Number(unitPrice || 0);
    if (!Number.isFinite(parsed) || parsed < 0) return false;

    if (routeDuplicateWarning) return false;
    return true;
  }, [cityA, cityB, unitPrice, routeDuplicateWarning]);

  const addRoute = useCallback(async () => {
    if (!cityA || !cityB) {
      setError('Please select both cities.');
      return;
    }
    if (cityA === cityB) {
      setError('Please choose two different cities.');
      return;
    }
    if (routeDuplicateWarning) {
      setError(routeDuplicateWarning);
      return;
    }

    const parsedPrice = Number(unitPrice || 0);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Unit price must be a valid non-negative number.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setOk(null);

      const payload = {
        city_a_id: cityA,
        city_b_id: cityB,
        pricing_basis_default: basis,
        currency,
        unit_price: parsedPrice,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('transport_routes')
        .insert(payload)
        .select('id,city_a_id,city_b_id,pricing_basis_default,currency,unit_price,is_active')
        .single();

      if (error) throw error;

      setRows((prev) => [data as RouteRow, ...prev]);
      setOk('Route added.');
      setTimeout(() => setOk(null), 1500);

      // Optional: keep selection but reset price
      setUnitPrice('0');
    } catch (e: any) {
      setError(e?.message || 'Failed to add route.');
    } finally {
      setSaving(false);
    }
  }, [cityA, cityB, basis, currency, unitPrice, routeDuplicateWarning]);

  const updateRoute = useCallback(async (id: string, patch: Partial<RouteRow>) => {
    try {
      setSaving(true);
      setError(null);

      // Guard: if changing cities, prevent duplicates (including reverse)
      if (patch.city_a_id || patch.city_b_id) {
        const current = rows.find((r) => r.id === id);
        if (current) {
          const nextA = patch.city_a_id ?? current.city_a_id;
          const nextB = patch.city_b_id ?? current.city_b_id;
          const nextKey = makeRouteKey(nextA, nextB);

          const dup = rows.some((r) => r.id !== id && makeRouteKey(r.city_a_id, r.city_b_id) === nextKey);
          if (dup) {
            setError('Cannot update: this route (or reverse) already exists.');
            return;
          }

          if (nextA === nextB) {
            setError('Cannot update: cities must be different.');
            return;
          }
        }
      }

      const cleanPatch: any = { ...patch };
      if (typeof cleanPatch.unit_price === 'number' && (!Number.isFinite(cleanPatch.unit_price) || cleanPatch.unit_price < 0)) {
        setError('Unit price must be a valid non-negative number.');
        return;
      }

      const { error } = await supabase.from('transport_routes').update(cleanPatch).eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...cleanPatch } as RouteRow) : r)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update route.');
    } finally {
      setSaving(false);
    }
  }, [rows]);

  const deleteRoute = useCallback(async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase.from('transport_routes').delete().eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      setOk('Route deleted.');
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete route.');
    } finally {
      setSaving(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const qq = normalize(q);

    return rows
      .filter((r) => (onlyActive ? !!r.is_active : true))
      .filter((r) => (filterCityId ? r.city_a_id === filterCityId || r.city_b_id === filterCityId : true))
      .filter((r) => {
        if (!qq) return true;
        const a = normalize(cityName(r.city_a_id));
        const b = normalize(cityName(r.city_b_id));
        const meta = `${a} ${b} ${r.currency} ${r.pricing_basis_default} ${r.unit_price}`;
        return meta.includes(qq);
      })
      .sort((x, y) => {
        const xa = cityName(x.city_a_id).localeCompare(cityName(y.city_a_id));
        if (xa !== 0) return xa;
        const xb = cityName(x.city_b_id).localeCompare(cityName(y.city_b_id));
        if (xb !== 0) return xb;
        return (x.currency || '').localeCompare(y.currency || '');
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

      <Card title="Transport Routes (City → City)" right={right}>
        {/* Add Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
          <label className="text-sm md:col-span-3">
            <div className="text-gray-600 mb-1">From</div>
            <select
              value={cityA}
              onChange={(e) => setCityA(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="">Select...</option>
              {activeCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-3">
            <div className="text-gray-600 mb-1">To</div>
            <select
              value={cityB}
              onChange={(e) => setCityB(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="">Select...</option>
              {activeCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            <div className="text-gray-600 mb-1">Basis</div>
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value as TransportBasis)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="per_trip">per_trip</option>
              <option value="per_person">per_person</option>
            </select>
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
            <PrimaryButton onClick={addRoute} disabled={saving || loading || !canAdd}>
              <Plus className="h-4 w-4" />
              Add Route
            </PrimaryButton>
          </div>

          {routeDuplicateWarning && (
            <div className="md:col-span-12 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {routeDuplicateWarning}
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
                placeholder="City / currency / basis..."
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
            No routes found.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Route</th>
                  <th className="text-left p-3">Basis</th>
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
                      {cityName(r.city_a_id)} → {cityName(r.city_b_id)}
                    </td>

                    <td className="p-3">
                      <select
                        value={r.pricing_basis_default}
                        onChange={(e) =>
                          updateRoute(r.id, { pricing_basis_default: e.target.value as TransportBasis })
                        }
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                        disabled={saving}
                      >
                        <option value="per_trip">per_trip</option>
                        <option value="per_person">per_person</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <select
                        value={r.currency}
                        onChange={(e) => updateRoute(r.id, { currency: e.target.value as Currency })}
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
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, unit_price: Number(e.target.value || 0) } : x
                            )
                          )
                        }
                        onBlur={(e) => updateRoute(r.id, { unit_price: Number(e.target.value || 0) })}
                        inputMode="decimal"
                        disabled={saving}
                      />
                    </td>

                    <td className="p-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r.is_active}
                          onChange={(e) => updateRoute(r.id, { is_active: e.target.checked })}
                          disabled={saving}
                        />
                        {r.is_active ? 'Yes' : 'No'}
                      </label>
                    </td>

                    <td className="p-3">
                      <DangerButton onClick={() => deleteRoute(r.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DangerButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs text-gray-500 mt-3">
              Tip: Keep a single active route per (From, To) to avoid conflicting prices (reverse direction is also treated as duplicate).
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
