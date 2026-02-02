import React, { memo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Currency, ExtraEntry, ServiceRateRow } from '../types/activityPlan';
import { num, safeArray } from '../lib/activityPlanCalculations';

type Props = {
  serviceRates: ServiceRateRow[];
  extraEntries: ExtraEntry[];

  onAddExtra: () => void;
  onUpdateExtra: (id: string, patch: Partial<ExtraEntry>) => void;
  onRemoveExtra: (id: string) => void;

  formatCurrency: (amount: number, currency: Currency) => string;
};

// ✅ لازم يكون خارج ExtrasTab حتى ما يصير remount ويفقد الفوكس
const Card = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="px-5 py-3 border-b border-gray-200">
      <div className="font-semibold text-gray-900">{title}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
));

function ExtrasTab({ serviceRates, extraEntries, onAddExtra, onUpdateExtra, onRemoveExtra, formatCurrency }: Props) {
  const rates = safeArray<ServiceRateRow>(serviceRates);
  const extras = safeArray<ExtraEntry>(extraEntries);

  const applicableServiceRates = (serviceType: string) => rates.filter((s) => s.service_type === serviceType);

  return (
    <Card title="Extras (Services)">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">Auto pricing uses Service Rates.</div>

        <button
          onClick={onAddExtra}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add Extra
        </button>
      </div>

      {extras.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No extras.
        </div>
      ) : (
        <div className="space-y-3">
          {extras.map((x) => {
            const qty = Math.max(1, num(x.qty, 1));
            const total = qty * Math.max(0, num(x.unit_price, 0));

            return (
              <div key={x.id} className="rounded-lg border border-gray-200 p-4 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 w-full">
                    <label className="text-sm md:col-span-2">
                      <div className="text-gray-600 mb-1">Service Type</div>
                      <select
                        value={x.service_type}
                        onChange={(e) => {
                          const st = e.target.value;
                          const sr = applicableServiceRates(st)[0] || null;

                          onUpdateExtra(x.id, {
                            service_type: st,
                            service_rate_id: sr?.id || null,
                            currency: ((sr?.currency as any) || x.currency) as any,
                            unit_price: sr ? String(num(sr.unit_price, 0)) : x.unit_price,
                            unit:
                              sr?.pricing_basis === 'per_day'
                                ? 'day'
                                : sr?.pricing_basis === 'per_trip'
                                ? 'trip'
                                : sr?.pricing_basis === 'per_hour'
                                ? 'hour'
                                : 'fixed',
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        <option value="photographer">photographer</option>
                        <option value="rapporteur">rapporteur</option>
                        <option value="airport_taxi">airport_taxi</option>
                        <option value="local_taxi">local_taxi</option>
                        <option value="printing">printing</option>
                        <option value="other">other</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">Pricing</div>
                      <select
                        value={x.pricing_mode}
                        onChange={(e) => onUpdateExtra(x.id, { pricing_mode: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        <option value="auto">Auto</option>
                        <option value="manual">Manual</option>
                      </select>
                    </label>

                    <label className="text-sm md:col-span-2">
                      <div className="text-gray-600 mb-1">Description</div>
                      <input
                        value={x.description ?? ''}
                        onChange={(e) => onUpdateExtra(x.id, { description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        placeholder="e.g. Photographer for 2 days"
                        autoComplete="off"
                      />
                    </label>

                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">Qty</div>
                      <input
                        value={String(x.qty ?? '1')}
                        onChange={(e) => onUpdateExtra(x.id, { qty: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        inputMode="numeric"
                      />
                    </label>

                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">Unit</div>
                      <input
                        value={x.unit ?? ''}
                        onChange={(e) => onUpdateExtra(x.id, { unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        autoComplete="off"
                      />
                    </label>

                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">Currency</div>
                      <select
                        value={x.currency}
                        onChange={(e) => onUpdateExtra(x.id, { currency: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        <option value="USD">USD</option>
                        <option value="IQD">IQD</option>
                      </select>
                    </label>

                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">Unit Price</div>
                      <input
                        value={String(x.unit_price ?? '0')}
                        onChange={(e) => onUpdateExtra(x.id, { unit_price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        inputMode="decimal"
                      />
                    </label>

                    <div className="text-sm">
                      <div className="text-gray-600 mb-1">Total</div>
                      <div className="px-3 py-2 rounded-md border border-gray-200 bg-gray-50">
                        {formatCurrency(total, x.currency)}
                      </div>
                    </div>

                    <label className="text-sm md:col-span-6">
                      <div className="text-gray-600 mb-1">Notes</div>
                      <input
                        value={x.notes ?? ''}
                        onChange={(e) => onUpdateExtra(x.id, { notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        placeholder="Optional"
                        autoComplete="off"
                      />
                    </label>
                  </div>

                  <button
                    onClick={() => onRemoveExtra(x.id)}
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
  );
}

export default memo(ExtrasTab);
