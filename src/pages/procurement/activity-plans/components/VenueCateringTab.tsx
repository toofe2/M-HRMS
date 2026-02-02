import React, { memo } from 'react';
import { Plus, Trash2, Coffee, Utensils } from 'lucide-react';
import type { CateringEntry, Currency, VenueEntry } from '../types/activityPlan';
import { num, safeArray } from '../lib/activityPlanCalculations';

type Props = {
  venueEntries: VenueEntry[];
  cateringEntries: CateringEntry[];

  daysDefault?: number;
  personsDefault?: number;

  // new naming (recommended)
  addVenue?: () => void;
  updateVenue?: (id: string, patch: Partial<VenueEntry>) => void;
  removeVenue?: (id: string) => void;

  addCatering?: (type: CateringEntry['type']) => void;
  updateCatering?: (id: string, patch: Partial<CateringEntry>) => void;
  removeCatering?: (id: string) => void;

  // backward compatible (optional)
  onAddVenue?: () => void;
  onUpdateVenue?: (id: string, patch: Partial<VenueEntry>) => void;
  onRemoveVenue?: (id: string) => void;

  onAddCatering?: (type: CateringEntry['type']) => void;
  onUpdateCatering?: (id: string, patch: Partial<CateringEntry>) => void;
  onRemoveCatering?: (id: string) => void;

  // may come from parent (ActivityPlanForm)
  formatCurrency?: (amount: number, currency: Currency) => string;
};

// ✅ لازم يكون خارج VenueCateringTab حتى ما يصير remount ويفقد الفوكس
const Card = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="px-5 py-3 border-b border-gray-200">
      <div className="font-semibold text-gray-900">{title}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
));


function VenueCateringTab(props: Props) {
  const { venueEntries, cateringEntries, daysDefault = 1, personsDefault = 0 } = props;

  // ✅ typed safe no-ops
  const noop = () => {};
  const noopUpdateVenue = (_id: string, _patch: Partial<VenueEntry>) => {};
  const noopUpdateCatering = (_id: string, _patch: Partial<CateringEntry>) => {};
  const noopRemove = (_id: string) => {};
  const noopAddCatering = (_type: CateringEntry['type']) => {};

  // ✅ unify handlers: new has priority, old as fallback
  const addVenue = props.addVenue || props.onAddVenue || noop;
  const updateVenue = props.updateVenue || props.onUpdateVenue || noopUpdateVenue;
  const removeVenue = props.removeVenue || props.onRemoveVenue || noopRemove;

  const addCatering = props.addCatering || props.onAddCatering || noopAddCatering;
  const updateCatering = props.updateCatering || props.onUpdateCatering || noopUpdateCatering;
  const removeCatering = props.removeCatering || props.onRemoveCatering || noopRemove;

  // ✅ currency formatting fallback (if parent didn't pass formatCurrency)
  const formatCurrency =
    props.formatCurrency ||
    ((amount: number, currency: Currency) => {
      const v = Number.isFinite(amount) ? amount : 0;
      const cur = String(currency || 'USD').toUpperCase();
      const isIqd = cur === 'IQD';

      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: cur,
          minimumFractionDigits: isIqd ? 0 : 2,
          maximumFractionDigits: isIqd ? 0 : 2,
        }).format(v);
      } catch {
        const fixed = isIqd ? String(Math.round(v)) : v.toFixed(2);
        return `${cur} ${fixed}`;
      }
    });

  const safeVenue = safeArray<VenueEntry>(venueEntries);
  const safeCatering = safeArray<CateringEntry>(cateringEntries);

  return (
    <div className="space-y-6">
      {/* Venue */}
      <Card title="Venue">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">Add venue booking costs.</div>
          <button
            onClick={addVenue}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add Venue
          </button>
        </div>

        {safeVenue.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No venue entries.
          </div>
        ) : (
          <div className="space-y-3">
            {safeVenue.map((v) => {
              const d = Math.max(1, num(v.days, daysDefault));
              const up = Math.max(0, num(v.unit_price_per_day, 0));
              const total = d * up;

              return (
                <div key={v.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full">
                      <label className="text-sm md:col-span-2">
                        <div className="text-gray-600 mb-1">Venue Name</div>
                        <input
                          value={v.venue_name ?? ''}
                          onChange={(e) => updateVenue(v.id, { venue_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          autoComplete="off"
                        />
                      </label>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Days</div>
                        <input
                          value={String(v.days ?? daysDefault)}
                          onChange={(e) => updateVenue(v.id, { days: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          inputMode="numeric"
                        />
                      </label>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Currency</div>
                        <select
                          value={v.currency}
                          onChange={(e) => updateVenue(v.id, { currency: e.target.value as Currency })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                        >
                          <option value="USD">USD</option>
                          <option value="IQD">IQD</option>
                        </select>
                      </label>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Unit Price / Day</div>
                        <input
                          value={String(v.unit_price_per_day ?? '0')}
                          onChange={(e) => updateVenue(v.id, { unit_price_per_day: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          inputMode="decimal"
                        />
                      </label>

                      <div className="text-sm">
                        <div className="text-gray-600 mb-1">Total</div>
                        <div className="px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                          {formatCurrency(total, v.currency)}
                        </div>
                      </div>

                      <label className="text-sm md:col-span-4">
                        <div className="text-gray-600 mb-1">Notes</div>
                        <input
                          value={v.notes ?? ''}
                          onChange={(e) => updateVenue(v.id, { notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          placeholder="Optional"
                          autoComplete="off"
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => removeVenue(v.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Catering */}
      <Card title="Catering (with recurrence)">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">Lunch and Coffee Break costs (Times per day supported).</div>
          <div className="flex gap-2">
            <button
              onClick={() => addCatering('lunch')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
              type="button"
            >
              <Utensils className="h-4 w-4" />
              Add Lunch
            </button>

            <button
              onClick={() => addCatering('coffee_break')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
              type="button"
            >
              <Coffee className="h-4 w-4" />
              Add Coffee Break
            </button>
          </div>
        </div>

        {safeCatering.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No catering entries.
          </div>
        ) : (
          <div className="space-y-3">
            {safeCatering.map((c) => {
              const persons = Math.max(0, num(c.persons, personsDefault));
              const d = Math.max(1, num(c.days, daysDefault));
              const t = Math.max(1, num(c.times_per_day, c.type === 'coffee_break' ? 1 : 1));
              const unitPrice = Math.max(0, num(c.unit_price, 0));

              const qty = persons;
              const frequency = d * t;
              const total = qty * frequency * unitPrice;

              return (
                <div key={c.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 w-full">
                      <div className="text-sm">
                        <div className="text-gray-600 mb-1">Type</div>
                        <div className="px-3 py-2 rounded-md border border-gray-200 bg-gray-50 font-medium">
                          {c.type === 'lunch' ? 'Lunch' : 'Coffee Break'}
                        </div>
                      </div>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Persons</div>
                        <input
                          value={String(c.persons ?? personsDefault)}
                          onChange={(e) => updateCatering(c.id, { persons: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          inputMode="numeric"
                        />
                      </label>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Days</div>
                        <input
                          value={String(c.days ?? daysDefault)}
                          onChange={(e) => updateCatering(c.id, { days: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          inputMode="numeric"
                        />
                      </label>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Times / Day</div>
                        <input
                          value={String(c.times_per_day ?? (c.type === 'coffee_break' ? 1 : 1))}
                          onChange={(e) => updateCatering(c.id, { times_per_day: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          inputMode="numeric"
                        />
                      </label>

                      <label className="text-sm">
                        <div className="text-gray-600 mb-1">Currency</div>
                        <select
                          value={c.currency}
                          onChange={(e) => updateCatering(c.id, { currency: e.target.value as Currency })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                        >
                          <option value="USD">USD</option>
                          <option value="IQD">IQD</option>
                        </select>
                      </label>

                      <label className="text-sm md:col-span-2">
                        <div className="text-gray-600 mb-1">Unit Price</div>
                        <input
                          value={String(c.unit_price ?? '0')}
                          onChange={(e) => updateCatering(c.id, { unit_price: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          inputMode="decimal"
                        />
                      </label>

                      <div className="text-sm">
                        <div className="text-gray-600 mb-1">Total</div>
                        <div className="px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                          {formatCurrency(total, c.currency)}
                          <div className="text-xs text-gray-500 mt-1">
                            Qty: {qty} · Frequency: {frequency}
                          </div>
                        </div>
                      </div>

                      <label className="text-sm md:col-span-6">
                        <div className="text-gray-600 mb-1">Notes</div>
                        <input
                          value={c.notes ?? ''}
                          onChange={(e) => updateCatering(c.id, { notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md"
                          placeholder="Optional"
                          autoComplete="off"
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => removeCatering(c.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default memo(VenueCateringTab);
