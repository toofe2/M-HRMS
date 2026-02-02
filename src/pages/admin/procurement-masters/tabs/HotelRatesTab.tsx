import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { Card, DangerButton, InlineStatus, PrimaryButton, SecondaryButton, ReloadIcon } from '../ui';

type Currency = 'USD' | 'IQD';
type HotelBasis = 'per_room' | 'per_person';

type CityRow = { id: string; name: string; is_active: boolean };

type HotelRateRow = {
  id: string;
  city_id: string;
  hotel_name: string;
  room_type: string | null;
  pricing_basis: HotelBasis;
  currency: Currency;
  unit_price_per_night: number;
  is_active: boolean;
};

const normalize = (s: string) => (s || '').trim().toLowerCase();

export default function HotelRatesTab() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [rows, setRows] = useState<HotelRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Add form
  const [cityId, setCityId] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [roomType, setRoomType] = useState('');
  const [basis, setBasis] = useState<HotelBasis>('per_person');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [price, setPrice] = useState('0');

  // Filters
  const [onlyActive, setOnlyActive] = useState(true);
  const [filterCityId, setFilterCityId] = useState<string>('');
  const [q, setQ] = useState('');

  const cityName = useCallback(
    (id: string) => cities.find((c) => c.id === id)?.name || '—',
    [cities]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [cRes, hRes] = await Promise.all([
        supabase.from('cities').select('id,name,is_active').order('name', { ascending: true }),
        supabase
          .from('hotel_rates')
          .select('id,city_id,hotel_name,room_type,pricing_basis,currency,unit_price_per_night,is_active')
          .order('hotel_name', { ascending: true }),
      ]);

      if (cRes.error) throw cRes.error;
      if (hRes.error) throw hRes.error;

      setCities((cRes.data || []) as CityRow[]);
      setRows((hRes.data || []) as HotelRateRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load hotel rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const qq = normalize(q);
    return rows
      .filter((r) => (onlyActive ? !!r.is_active : true))
      .filter((r) => (filterCityId ? r.city_id === filterCityId : true))
      .filter((r) => {
        if (!qq) return true;
        const city = normalize(cityName(r.city_id));
        const hotel = normalize(r.hotel_name);
        const room = normalize(r.room_type || '');
        const meta = `${hotel} ${room} ${city} ${r.currency} ${r.pricing_basis}`;
        return meta.includes(qq);
      })
      .sort((a, b) => {
        const c = cityName(a.city_id).localeCompare(cityName(b.city_id));
        if (c !== 0) return c;
        return (a.hotel_name || '').localeCompare(b.hotel_name || '');
      });
  }, [rows, onlyActive, filterCityId, q, cityName]);

  const existsDuplicate = useCallback(() => {
    const cn = normalize(hotelName);
    const rn = normalize(roomType);
    if (!cityId || !cn) return false;

    return rows.some((r) => {
      if (r.city_id !== cityId) return false;
      if (normalize(r.hotel_name) !== cn) return false;
      if (normalize(r.room_type || '') !== rn) return false;
      if (r.pricing_basis !== basis) return false;
      if (r.currency !== currency) return false;
      return true;
    });
  }, [rows, cityId, hotelName, roomType, basis, currency]);

  const addHotelRate = useCallback(async () => {
    const hn = hotelName.trim();
    const rt = roomType.trim();

    if (!cityId || !hn) {
      setError('City and Hotel name are required.');
      return;
    }

    if (existsDuplicate()) {
      setError('Duplicate detected: same City + Hotel + Room Type + Basis + Currency already exists.');
      return;
    }

    const parsedPrice = Number(price || 0);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a valid non-negative number.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setOk(null);

      const payload = {
        city_id: cityId,
        hotel_name: hn,
        room_type: rt || null,
        pricing_basis: basis,
        currency,
        unit_price_per_night: parsedPrice,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('hotel_rates')
        .insert(payload)
        .select('id,city_id,hotel_name,room_type,pricing_basis,currency,unit_price_per_night,is_active')
        .single();

      if (error) throw error;

      setRows((prev) => [...prev, data as HotelRateRow]);
      setHotelName('');
      setRoomType('');
      setPrice('0');

      setOk('Hotel rate added.');
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to add hotel rate.');
    } finally {
      setSaving(false);
    }
  }, [cityId, hotelName, roomType, basis, currency, price, existsDuplicate]);

  const updateHotelRate = useCallback(async (id: string, patch: Partial<HotelRateRow>) => {
    try {
      setSaving(true);
      setError(null);

      const cleanPatch: any = { ...patch };
      if (typeof cleanPatch.hotel_name === 'string') cleanPatch.hotel_name = cleanPatch.hotel_name.trim();
      if (typeof cleanPatch.room_type === 'string') cleanPatch.room_type = cleanPatch.room_type.trim() || null;

      const { error } = await supabase.from('hotel_rates').update(cleanPatch).eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...cleanPatch } as HotelRateRow) : r)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update hotel rate.');
    } finally {
      setSaving(false);
    }
  }, []);

  const deleteHotelRate = useCallback(async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase.from('hotel_rates').delete().eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      setOk('Hotel rate deleted.');
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete hotel rate.');
    } finally {
      setSaving(false);
    }
  }, []);

  const right = (
    <div className="flex items-center gap-2">
      <SecondaryButton onClick={load} disabled={loading}>
        <ReloadIcon spinning={loading} />
        Refresh
      </SecondaryButton>
    </div>
  );

  const activeCities = useMemo(() => cities.filter((c) => c.is_active), [cities]);

  return (
    <div className="space-y-4">
      <InlineStatus error={error} ok={ok} />

      <Card title="Hotel Rates (Per Night)" right={right}>
        {/* Add Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
          <label className="text-sm md:col-span-3">
            <div className="text-gray-600 mb-1">City</div>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
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
            <div className="text-gray-600 mb-1">Hotel Name</div>
            <input
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              placeholder="e.g., Divan Erbil"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <div className="text-gray-600 mb-1">Room Type (optional)</div>
            <input
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              placeholder="Single / Double..."
            />
          </label>

          <label className="text-sm md:col-span-2">
            <div className="text-gray-600 mb-1">Basis</div>
            <select
              value={basis}
              onChange={(e) => setBasis(e.target.value as HotelBasis)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="per_person">per_person</option>
              <option value="per_room">per_room</option>
            </select>
          </label>

          <label className="text-sm md:col-span-1">
            <div className="text-gray-600 mb-1">Currency</div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
            >
              <option value="USD">USD</option>
              <option value="IQD">IQD</option>
            </select>
          </label>

          <label className="text-sm md:col-span-1">
            <div className="text-gray-600 mb-1">Price</div>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              inputMode="decimal"
            />
          </label>

          <div className="flex items-end md:col-span-12">
            <PrimaryButton
              onClick={addHotelRate}
              disabled={saving || loading || !cityId || !hotelName.trim()}
            >
              <Plus className="h-4 w-4" />
              Add Hotel Rate
            </PrimaryButton>
          </div>

          {existsDuplicate() && (
            <div className="md:col-span-12 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Duplicate warning: the same (City + Hotel + Room Type + Basis + Currency) already exists.
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
                placeholder="Hotel / city / room / currency..."
              />
            </div>
          </label>

          <label className="text-sm inline-flex items-center gap-2 mt-2 md:mt-0">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Show active only
          </label>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-sm text-gray-600">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No hotel rates found.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">City</th>
                  <th className="text-left p-3">Hotel</th>
                  <th className="text-left p-3">Room Type</th>
                  <th className="text-left p-3">Basis</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-left p-3">Price / Night</th>
                  <th className="text-left p-3">Active</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3">
                      <select
                        value={r.city_id}
                        onChange={(e) => updateHotelRate(r.id, { city_id: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                        disabled={saving}
                      >
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.is_active ? '' : '(inactive)'}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3">
                      <input
                        className="w-64 max-w-full px-3 py-2 border border-gray-200 rounded-md"
                        value={r.hotel_name}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, hotel_name: e.target.value } : x))
                          )
                        }
                        onBlur={(e) => updateHotelRate(r.id, { hotel_name: e.target.value })}
                        disabled={saving}
                      />
                    </td>

                    <td className="p-3">
                      <input
                        className="w-44 max-w-full px-3 py-2 border border-gray-200 rounded-md"
                        value={r.room_type || ''}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id ? { ...x, room_type: e.target.value || null } : x
                            )
                          )
                        }
                        onBlur={(e) => updateHotelRate(r.id, { room_type: e.target.value })}
                        placeholder="Optional"
                        disabled={saving}
                      />
                    </td>

                    <td className="p-3">
                      <select
                        value={r.pricing_basis}
                        onChange={(e) =>
                          updateHotelRate(r.id, { pricing_basis: e.target.value as HotelBasis })
                        }
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                        disabled={saving}
                      >
                        <option value="per_person">per_person</option>
                        <option value="per_room">per_room</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <select
                        value={r.currency}
                        onChange={(e) => updateHotelRate(r.id, { currency: e.target.value as Currency })}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                        disabled={saving}
                      >
                        <option value="USD">USD</option>
                        <option value="IQD">IQD</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <input
                        className="w-32 px-3 py-2 border border-gray-200 rounded-md"
                        value={String(r.unit_price_per_night ?? 0)}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id
                                ? { ...x, unit_price_per_night: Number(e.target.value || 0) }
                                : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          updateHotelRate(r.id, { unit_price_per_night: Number(e.target.value || 0) })
                        }
                        inputMode="decimal"
                        disabled={saving}
                      />
                    </td>

                    <td className="p-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r.is_active}
                          onChange={(e) => updateHotelRate(r.id, { is_active: e.target.checked })}
                          disabled={saving}
                        />
                        {r.is_active ? 'Yes' : 'No'}
                      </label>
                    </td>

                    <td className="p-3">
                      <DangerButton onClick={() => deleteHotelRate(r.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DangerButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs text-gray-500 mt-3">
              Tip: Keep one active rate per (City + Hotel + Room Type + Basis + Currency) to avoid conflicts.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
