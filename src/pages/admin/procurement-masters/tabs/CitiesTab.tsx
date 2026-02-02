import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { Card, DangerButton, InlineStatus, PrimaryButton, SecondaryButton, ReloadIcon } from '../ui';

type CityRow = {
  id: string;
  name: string;
  is_active: boolean;
};

const normalize = (s: string) => (s || '').trim().toLowerCase();

export default function CitiesTab() {
  const [rows, setRows] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [newName, setNewName] = useState('');

  // Filters
  const [onlyActive, setOnlyActive] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('cities')
        .select('id,name,is_active')
        .order('name', { ascending: true });

      if (error) throw error;
      setRows((data || []) as CityRow[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load cities.');
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
      .filter((r) => {
        if (!qq) return true;
        return normalize(r.name).includes(qq);
      })
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, onlyActive, q]);

  const addDuplicateWarning = useMemo(() => {
    const name = normalize(newName);
    if (!name) return null;
    const dup = rows.some((r) => normalize(r.name) === name);
    return dup ? 'Duplicate detected: this city already exists.' : null;
  }, [newName, rows]);

  const addCity = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;

    // Duplicate (case-insensitive)
    if (rows.some((r) => normalize(r.name) === normalize(name))) {
      setError('Duplicate detected: this city already exists.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setOk(null);

      const { data, error } = await supabase
        .from('cities')
        .insert({ name, is_active: true })
        .select('id,name,is_active')
        .single();

      if (error) throw error;

      setRows((prev) => {
        const next = [...prev, data as CityRow];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });

      setNewName('');
      setOk('City added.');
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to add city.');
    } finally {
      setSaving(false);
    }
  }, [newName, rows]);

  const updateCity = useCallback(
    async (id: string, patch: Partial<CityRow>) => {
      try {
        setSaving(true);
        setError(null);

        // If renaming, validate + prevent duplicates
        if (typeof patch.name === 'string') {
          const nextName = patch.name.trim();
          if (!nextName) {
            setError('City name cannot be empty.');
            return;
          }
          const dup = rows.some((r) => r.id !== id && normalize(r.name) === normalize(nextName));
          if (dup) {
            setError('Duplicate detected: another city already has this name.');
            return;
          }
          patch = { ...patch, name: nextName };
        }

        const { error } = await supabase.from('cities').update(patch).eq('id', id);
        if (error) throw error;

        setRows((prev) => {
          const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
          next.sort((a, b) => a.name.localeCompare(b.name));
          return next;
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to update city.');
      } finally {
        setSaving(false);
      }
    },
    [rows]
  );

  const deleteCity = useCallback(async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase.from('cities').delete().eq('id', id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== id));
      setOk('City deleted.');
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete city.');
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

  return (
    <div className="space-y-4">
      <InlineStatus error={error} ok={ok} />

      <Card title="Cities / Governorates" right={right}>
        {/* Add form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
          <label className="text-sm md:col-span-8">
            <div className="text-gray-600 mb-1">New City Name</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              placeholder="e.g., Baghdad"
            />
          </label>

          <div className="flex items-end md:col-span-4">
            <PrimaryButton onClick={addCity} disabled={saving || !newName.trim() || !!addDuplicateWarning}>
              <Plus className="h-4 w-4" />
              Add City
            </PrimaryButton>
          </div>

          {addDuplicateWarning && (
            <div className="md:col-span-12 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {addDuplicateWarning}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
          <label className="text-sm flex-1">
            <div className="text-gray-600 mb-1">Search</div>
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md"
                placeholder="Type a city name..."
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
            No cities found.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Active</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3">
                      <input
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        value={r.name}
                        disabled={saving}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))
                        }
                        onBlur={(e) => updateCity(r.id, { name: e.target.value })}
                      />
                    </td>

                    <td className="p-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!r.is_active}
                          disabled={saving}
                          onChange={(e) => updateCity(r.id, { is_active: e.target.checked })}
                        />
                        {r.is_active ? 'Yes' : 'No'}
                      </label>
                    </td>

                    <td className="p-3">
                      <DangerButton onClick={() => deleteCity(r.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DangerButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-xs text-gray-500 mt-3">
              Tip: Avoid duplicates (case-insensitive) to keep master data clean.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
