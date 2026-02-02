import React, { memo, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Currency, SummaryRow, Participant } from '../types/activityPlan';
import { buildTotalsByCurrency, safeArray } from '../lib/activityPlanCalculations';

type CityLike = { id: string; name: string };

type Props = {
  summaryRows: SummaryRow[];
  formatCurrency: (amount: number, currency: Currency) => string;
  header?: {
    requestNo?: string | null;
    requestDate?: string | null;
    activityStart?: string | null;
    activityEnd?: string | null;
    projectName?: string | null;
    title?: string | null;
    location?: string | null;
    requestedBy?: string | null;

    // ✅ NEW: hotel booking dates
    hotelCheckIn?: string | null;
    hotelCheckOut?: string | null;
    hotelNights?: number | null;
  };
  participants?: Participant[];
  cities?: CityLike[];
};

function SummaryTab({ summaryRows, formatCurrency, header, participants, cities }: Props) {
  const rows = safeArray<SummaryRow>(summaryRows);
  const ppl = safeArray<Participant>(participants as any);
  const cityList = safeArray<CityLike>(cities as any);

  const cityMap = useMemo(() => {
    const m: Record<string, string> = {};
    cityList.forEach((c) => {
      if (c?.id) m[c.id] = c.name || c.id;
    });
    return m;
  }, [cityList]);

  const cityName = (id: any) => {
    if (!id) return '—';
    return cityMap[String(id)] || '—';
  };

  // ===== requestedBy display (اسم بدل ايميل) =====
  const displayPersonName = (v: any) => {
    const s = (v ?? '').toString().trim();
    if (!s) return '—';

    const m = s.match(/^(.+?)\s*<[^>]+>$/);
    if (m?.[1]) return m[1].trim();

    if (s.includes('@')) {
      const local = s.split('@')[0] || s;
      const pretty = local.replace(/[._-]+/g, ' ').trim();
      return pretty ? pretty : s;
    }

    return s;
  };

  // ✅ Hotel nights fallback (بدل أيام النشاط)
  const hotelNightsFallback = useMemo(() => {
    // 1) إذا المستخدم محدد Nights يدوي
    if (typeof header?.hotelNights === 'number' && header.hotelNights > 0) return header.hotelNights;

    const s = header?.hotelCheckIn;
    const e = header?.hotelCheckOut;
    if (!s || !e) return 1;

    const ds = new Date(s);
    const de = new Date(e);

    const diff = Math.ceil((de.getTime() - ds.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [header?.hotelCheckIn, header?.hotelCheckOut, header?.hotelNights]);

  // ✅ fix hotel frequency: if 0 => use hotelNightsFallback
  const fixedRows = useMemo(() => {
    return rows.map((r) => {
      const freq = Number(r.frequency || 0);

      const isHotelRow =
        r.category === 'hotel' || String(r.item || '').toLowerCase().includes('hotel');

      if (isHotelRow) {
        // ✅ إذا frequency=0 خليها Nights الفندق (مو أيام النشاط)
        const safeFreq = freq > 0 ? freq : hotelNightsFallback;

        if (safeFreq !== r.frequency) {
          const total = (Number(r.qty) || 0) * safeFreq * (Number(r.unit_price) || 0);
          return { ...r, frequency: safeFreq, total };
        }
      }

      return r;
    });
  }, [rows, hotelNightsFallback]);

  // ===== rows separation =====
  const transportRows = useMemo(
    () => fixedRows.filter((r) => r.category === 'transport'),
    [fixedRows]
  );
  const itemRows = useMemo(
    () => fixedRows.filter((r) => r.category !== 'transport'),
    [fixedRows]
  );

  const transportTotals = useMemo(() => buildTotalsByCurrency(transportRows), [transportRows]);
  const itemsTotals = useMemo(() => buildTotalsByCurrency(itemRows), [itemRows]);
  const grandTotals = useMemo(() => buildTotalsByCurrency(fixedRows), [fixedRows]);

  const totalsLine = (totals: Record<string, number>) => {
    const entries = Object.entries(totals).filter(([_, amt]) => Number(amt || 0) !== 0);
    if (entries.length === 0) return '—';
    return entries
      .map(([cur, amt]) => `${cur}: ${formatCurrency(amt, cur as Currency)}`)
      .join(' · ');
  };

  // ===== distribute transport per participant =====
  const transportByParticipant = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const r of transportRows) {
      const ids: string[] = safeArray((r as any)?.meta?.participants);
      const currency = (r.currency || 'IQD') as string;
      const count = Math.max(1, ids.length);
      const share = (r.total || 0) / count;

      ids.forEach((pid) => {
        if (!map[pid]) map[pid] = {};
        map[pid][currency] = (map[pid][currency] || 0) + share;
      });
    }
    return map;
  }, [transportRows]);

  const getFromTo = (p: Participant) => {
    const fromId = p.transport_from_city_id || p.city_id || null;
    const toId = p.transport_to_city_id || null;
    return { fromId, toId };
  };

  const requestNoView = header?.requestNo?.trim() ? header.requestNo : 'Auto';
  const requestedByView = displayPersonName(header?.requestedBy);

  const activityDatesView =
    (header?.activityStart || '—') + (header?.activityEnd ? ` → ${header.activityEnd}` : '');

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200">
        <div className="font-semibold text-gray-900">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  const MetaRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex gap-3 py-1">
      <div className="w-36 shrink-0 text-gray-500 text-sm">{label}</div>
      <div className="text-gray-900 text-sm font-medium">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-xs text-gray-500">Request Summary (Read-only)</div>
          <div className="mt-1 text-lg font-bold text-gray-900">{header?.title || '—'}</div>

          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <MetaRow label="Request No." value={requestNoView} />
              <MetaRow label="Request Date" value={header?.requestDate || '—'} />
              <MetaRow label="Requested By" value={requestedByView} />
            </div>
            <div>
              <MetaRow label="Project" value={header?.projectName || '—'} />
              <MetaRow label="Activity Dates" value={activityDatesView} />
              <MetaRow label="Location" value={header?.location || '—'} />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 text-sm text-gray-600 bg-white">
          This page is read-only. Submitting creates a snapshot for approvals.
        </div>
      </div>

      {/* Participants */}
      <Section title={`Participants (${ppl.length})`}>
        {ppl.length === 0 ? (
          <div className="text-sm text-gray-600">No participants added.</div>
        ) : (
          <div className="overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">From</th>
                  <th className="text-left p-3">To</th>
                  <th className="text-left p-3">Transport Amount</th>
                  <th className="text-left p-3">Hotel</th>
                </tr>
              </thead>

              <tbody className="divide-y bg-white">
                {ppl.map((p) => {
                  const { fromId, toId } = getFromTo(p);
                  const perCur = transportByParticipant[p.id] || {};

                  const transportText =
                    !p.needs_transport || Object.keys(perCur).length === 0
                      ? '—'
                      : Object.entries(perCur)
                          .map(([cur, amt]) => `${cur}: ${formatCurrency(amt, cur as Currency)}`)
                          .join(' · ');

                  return (
                    <tr key={p.id}>
                      <td className="p-3 font-medium text-gray-900">{p.full_name || '—'}</td>
                      <td className="p-3">{p.participant_type || '—'}</td>
                      <td className="p-3">{p.needs_transport ? cityName(fromId) : '—'}</td>
                      <td className="p-3">{p.needs_transport ? cityName(toId) : '—'}</td>
                      <td className="p-3 font-semibold">{transportText}</td>
                      <td className="p-3">{p.needs_hotel ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td className="p-3 font-semibold text-gray-900" colSpan={4}>
                    Transport Grand Total
                  </td>
                  <td className="p-3 font-bold text-gray-900" colSpan={2}>
                    {totalsLine(transportTotals)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      {/* Items */}
      <Section title="Cost Breakdown (Items only)">
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          {itemRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-600 bg-gray-50">
              No item costs added yet.
            </div>
          ) : (
            <div className="overflow-auto bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Unit</th>
                    <th className="text-left p-3">Qty</th>
                    <th className="text-left p-3">Frequency</th>
                    <th className="text-left p-3">Unit Price</th>
                    <th className="text-left p-3">Total</th>
                    <th className="text-left p-3">Currency</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {itemRows.map((r) => (
                    <tr key={r.key}>
                      <td className="p-3 font-medium text-gray-900">{r.item}</td>
                      <td className="p-3">{r.unit}</td>
                      <td className="p-3">{r.qty}</td>
                      <td className="p-3">{r.frequency}</td>
                      <td className="p-3">{formatCurrency(r.unit_price, r.currency)}</td>
                      <td className="p-3 font-semibold">{formatCurrency(r.total, r.currency)}</td>
                      <td className="p-3">{r.currency}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td className="p-3 font-semibold text-gray-900" colSpan={5}>
                      Items Grand Total
                    </td>
                    <td className="p-3 font-bold text-gray-900" colSpan={2}>
                      {totalsLine(itemsTotals)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-1">
            <AlertCircle className="h-4 w-4 text-gray-500" />
            Note
          </div>
          <div>
            Submit Summary creates a <span className="font-semibold">read-only snapshot</span> for approvals.
          </div>
        </div>
      </Section>

      {/* Grand Total */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <div className="font-semibold text-gray-900">Grand Total</div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500 mb-1">Participants</div>
              <div className="text-lg font-bold text-gray-900">{ppl.length}</div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500 mb-1">Items Count</div>
              <div className="text-lg font-bold text-gray-900">{itemRows.length}</div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500 mb-1">Total by Currency</div>
              <div className="text-base font-bold text-gray-900">{totalsLine(grandTotals)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SummaryTab);
