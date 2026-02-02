import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ClipboardPaste, Users, Eraser, Wand2, Copy } from 'lucide-react';
import type { CityRow, Participant } from '../types/activityPlan';

type UiParticipantType = 'participant' | 'staff' | 'expert';

const toDbType = (t: UiParticipantType): Participant['participant_type'] => t as any;

const normalizeType = (t: any): UiParticipantType => {
  const x = String(t || '').toLowerCase();
  if (x === 'vip') return 'expert'; // vip => expert
  if (x === 'external') return 'participant';
  if (x === 'staff') return 'staff';
  if (x === 'expert') return 'expert';
  if (x === 'participant') return 'participant';
  return 'participant';
};

const parsePastedNames = (text: string) => {
  const raw = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!raw) return [];

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Excel/CSV: take first column as name
  return lines
    .map((line) => (line.split(/\t|,|;/g)[0] || '').trim())
    .filter(Boolean)
    .map((n) => n.replace(/\s+/g, ' ').trim());
};

type HotelRateRow = {
  id: string;
  city_id: string;
  hotel_name: string;
  room_type: string | null;
  pricing_basis: string;
  currency: string;
  unit_price_per_night: number;
  is_active: boolean;
};

type Props = {
  cities: CityRow[];
  participants: Participant[];

  // ✅ NEW (optional): pass hotel rates list so we can select hotel NAME (not area)
  hotelRates?: HotelRateRow[];

  onAddParticipant: () => void;
  onUpdateParticipant: (id: string, patch: Partial<Participant>) => void;
  onRemoveParticipant: (id: string) => void;

  onClearAllParticipants?: () => void;
};

// Card outside component to avoid remount
const Card = memo(({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="px-5 py-3 border-b border-gray-200">
      <div className="font-semibold text-gray-900">{title}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
));

type PendingPaste = {
  names: string[];
  type: UiParticipantType;
  cityId: string | null;
};

function ParticipantsTab({
  cities,
  participants,
  hotelRates = [],
  onAddParticipant,
  onUpdateParticipant,
  onRemoveParticipant,
  onClearAllParticipants,
}: Props) {
  const safeParticipants = Array.isArray(participants) ? participants : [];

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [bulkType, setBulkType] = useState<UiParticipantType>('participant');
  const [bulkCityId, setBulkCityId] = useState<string>('');
  const [dedupe, setDedupe] = useState(true);

  // ✅ names queue
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());

  const patch = useCallback(
    (id: string, p: Partial<Participant>) => onUpdateParticipant(id, p),
    [onUpdateParticipant]
  );

  // ✅ distribute queued names onto new blank rows
  useEffect(() => {
    if (!pendingPaste) return;

    const remaining = [...pendingPaste.names];
    if (remaining.length === 0) {
      setPendingPaste(null);
      processedIdsRef.current = new Set();
      return;
    }

    const processed = processedIdsRef.current;

    const blanks = safeParticipants.filter((p) => {
      const name = String(p.full_name || '').trim();
      return !processed.has(p.id) && name === '';
    });

    if (blanks.length === 0) return;

    for (const p of blanks) {
      if (remaining.length === 0) break;

      const name = remaining.shift()!;
      processed.add(p.id);

      onUpdateParticipant(p.id, {
        full_name: name,
        participant_type: toDbType(pendingPaste.type),
        city_id: pendingPaste.cityId,
      });
    }

    if (remaining.length === 0) {
      setPendingPaste(null);
      processedIdsRef.current = new Set();
    } else {
      setPendingPaste({ ...pendingPaste, names: remaining });
    }
  }, [safeParticipants, pendingPaste, onUpdateParticipant]);

  const applyBulkPaste = useCallback(() => {
    const names = parsePastedNames(pasteText);

    if (names.length === 0) {
      setPasteOpen(false);
      setPasteText('');
      return;
    }

    const existing = new Set(
      safeParticipants
        .map((p) => String(p.full_name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const finalNames: string[] = [];
    for (const n of names) {
      const key = n.toLowerCase();
      if (dedupe && existing.has(key)) continue;
      if (dedupe) existing.add(key);
      finalNames.push(n);
    }

    if (finalNames.length === 0) {
      setPasteOpen(false);
      setPasteText('');
      return;
    }

    processedIdsRef.current = new Set();
    setPendingPaste({
      names: finalNames,
      type: bulkType,
      cityId: bulkCityId ? bulkCityId : null,
    });

    for (let i = 0; i < finalNames.length; i++) onAddParticipant();

    setPasteOpen(false);
    setPasteText('');
  }, [pasteText, dedupe, safeParticipants, bulkType, bulkCityId, onAddParticipant]);

  const applyBulkTypeToAll = useCallback(() => {
    const dbType = toDbType(bulkType);
    safeParticipants.forEach((p) => onUpdateParticipant(p.id, { participant_type: dbType }));
  }, [bulkType, safeParticipants, onUpdateParticipant]);

  const applyBulkCityToAll = useCallback(() => {
    const city = bulkCityId ? bulkCityId : null;
    safeParticipants.forEach((p) => onUpdateParticipant(p.id, { city_id: city }));
  }, [bulkCityId, safeParticipants, onUpdateParticipant]);

  const removeDuplicates = useCallback(() => {
    const seen = new Set<string>();
    safeParticipants.forEach((p) => {
      const key = String(p.full_name || '').trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) onRemoveParticipant(p.id);
      else seen.add(key);
    });
  }, [safeParticipants, onRemoveParticipant]);

  const trimNames = useCallback(() => {
    safeParticipants.forEach((p) => {
      const n = String(p.full_name || '');
      const cleaned = n.replace(/\s+/g, ' ').trim();
      if (cleaned !== n) onUpdateParticipant(p.id, { full_name: cleaned });
    });
  }, [safeParticipants, onUpdateParticipant]);

  const clearAll = useCallback(() => {
    if (onClearAllParticipants) return onClearAllParticipants();
    safeParticipants.forEach((p) => onRemoveParticipant(p.id));
  }, [onClearAllParticipants, safeParticipants, onRemoveParticipant]);

  // ✅ NEW: Copy current participant options to all below (exclude full_name)
  const copyDown = useCallback(
    (fromIndex: number) => {
      const src = safeParticipants[fromIndex];
      if (!src) return;

      const patchForOthers: Partial<Participant> = {
        participant_type: src.participant_type,
        city_id: src.city_id ?? null,
        hotel_rate_id: src.hotel_rate_id ?? null,


        needs_transport: !!src.needs_transport,
        transport_from_city_id: src.transport_from_city_id ?? null,
        transport_to_city_id: src.transport_to_city_id ?? null,

        needs_hotel: !!src.needs_hotel,
        hotel_city_id: src.hotel_city_id ?? null,
        // ✅ if your Participant type already has hotel_rate_id, uncomment this:
        // hotel_rate_id: (src as any).hotel_rate_id ?? null,

        needs_flight: !!src.needs_flight,
        needs_airport_taxi: !!src.needs_airport_taxi,

        // Optional: copy notes? (usually NO, but you can enable)
        // notes: src.notes ?? '',
      };

      for (let i = fromIndex + 1; i < safeParticipants.length; i++) {
        const target = safeParticipants[i];
        // avoid overwriting names (we don't touch full_name)
        onUpdateParticipant(target.id, patchForOthers);
      }
    },
    [safeParticipants, onUpdateParticipant]
  );

  // ✅ hotel options filtered by participant's city (if needed)
  const getHotelOptions = useCallback(
    (cityId: string | null | undefined) => {
      const list = hotelRates.filter((h) => h.is_active);
      if (!cityId) return list;
      return list.filter((h) => h.city_id === cityId);
    },
    [hotelRates]
  );

  return (
    <Card title="Participants (Travel/Hotel Checklists + Details)">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-gray-600">
            Mark who needs Transport/Hotel using checklists, then fill their details.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPasteOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 text-sm hover:bg-gray-50"
              type="button"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste Names
            </button>

            <button
              onClick={onAddParticipant}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add Participant
            </button>
          </div>
        </div>

        {/* Bulk tools */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            Bulk:
          </div>

          <select
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value as UiParticipantType)}
            className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm"
          >
            <option value="participant">Participant</option>
            <option value="staff">Staff</option>
            <option value="expert">Expert</option>
          </select>

          <button
            onClick={applyBulkTypeToAll}
            disabled={safeParticipants.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
            type="button"
          >
            <Wand2 className="h-4 w-4" />
            Apply Type to All
          </button>

          <select
            value={bulkCityId}
            onChange={(e) => setBulkCityId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md bg-white text-sm"
          >
            <option value="">City (optional)…</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={applyBulkCityToAll}
            disabled={safeParticipants.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
            type="button"
          >
            <Wand2 className="h-4 w-4" />
            Apply City to All
          </button>

          <button
            onClick={trimNames}
            disabled={safeParticipants.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
            type="button"
          >
            <Wand2 className="h-4 w-4" />
            Trim Names
          </button>

          <button
            onClick={removeDuplicates}
            disabled={safeParticipants.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
            type="button"
          >
            <Wand2 className="h-4 w-4" />
            Remove Duplicates
          </button>

          <button
            onClick={clearAll}
            disabled={safeParticipants.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-red-700 text-sm hover:bg-red-50 disabled:opacity-60"
            type="button"
          >
            <Eraser className="h-4 w-4" />
            Clear All
          </button>
        </div>

        {/* Paste panel */}
        {pasteOpen && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm text-gray-700 font-medium mb-2">Paste Names</div>
            <div className="text-xs text-gray-600 mb-2">
              Paste one name per line (or Excel column). We’ll create participants automatically.
            </div>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-md bg-white text-sm"
              placeholder={`Example:\nAli Ahmed\nSara Karim\nMohammed Hassan`}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
                Avoid duplicates
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPasteOpen(false);
                    setPasteText('');
                  }}
                  className="px-3 py-2 rounded-md border border-gray-200 text-gray-700 text-sm hover:bg-gray-100"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={applyBulkPaste}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-800"
                  type="button"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Add Names
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {safeParticipants.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          No participants yet.
        </div>
      ) : (
        <div className="space-y-3">
          {safeParticipants.map((p, idx) => {
            const uiType = normalizeType(p.participant_type);

            return (
              <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 w-full">
                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">Type</div>
                      <select
                        value={uiType}
                        onChange={(e) =>
                          patch(p.id, { participant_type: toDbType(e.target.value as UiParticipantType) })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        <option value="participant">Participant</option>
                        <option value="staff">Staff</option>
                        <option value="expert">Expert</option>
                      </select>
                    </label>

                    <label className="text-sm md:col-span-2">
                      <div className="text-gray-600 mb-1">Full Name</div>
                      <input
                        value={p.full_name ?? ''}
                        onChange={(e) => patch(p.id, { full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        placeholder={`Participant #${idx + 1}`}
                        autoComplete="off"
                      />
                    </label>

                    <label className="text-sm">
                      <div className="text-gray-600 mb-1">City</div>
                      <select
                        value={p.city_id || ''}
                        onChange={(e) => patch(p.id, { city_id: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        <option value="">Select...</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* ✅ Needs */}
                    <div className="text-sm md:col-span-2">
                      <div className="text-gray-600 mb-1">Needs</div>
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!p.needs_transport}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              patch(p.id, {
                                needs_transport: checked,
                                transport_from_city_id: checked ? (p.transport_from_city_id || p.city_id) : null,
                                transport_to_city_id: checked ? (p.transport_to_city_id || null) : null,
                              });
                            }}
                          />
                          Transport
                        </label>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!p.needs_hotel}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              patch(p.id, {
                                needs_hotel: checked,
                                hotel_city_id: checked ? (p.hotel_city_id || p.city_id) : null,
                              });
                            }}
                          />
                          Hotel
                        </label>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!p.needs_flight}
                            onChange={(e) => patch(p.id, { needs_flight: e.target.checked })}
                          />
                          Flight
                        </label>

                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!p.needs_airport_taxi}
                            onChange={(e) => patch(p.id, { needs_airport_taxi: e.target.checked })}
                          />
                          Airport Taxi
                        </label>
                      </div>
                    </div>

                    {/* ✅ Transport details */}
                    {p.needs_transport && (
                      <>
                        <label className="text-sm">
                          <div className="text-gray-600 mb-1">Transport From</div>
                          <select
                            value={p.transport_from_city_id || ''}
                            onChange={(e) => patch(p.id, { transport_from_city_id: e.target.value || null })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                          >
                            <option value="">Select...</option>
                            {cities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm">
                          <div className="text-gray-600 mb-1">Transport To</div>
                          <select
                            value={p.transport_to_city_id || ''}
                            onChange={(e) => patch(p.id, { transport_to_city_id: e.target.value || null })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                          >
                            <option value="">Select...</option>
                            {cities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    {/* ✅ Hotel selection: Hotel Name (if hotelRates provided), otherwise fallback to Hotel City */}
                    {p.needs_hotel && (
                      <label className="text-sm md:col-span-2">
                        <div className="text-gray-600 mb-1">Hotel</div>

                        {hotelRates.length > 0 ? (
                          <select
                            value={(p as any).hotel_rate_id || ''}
                            onChange={(e) => patch(p.id, { ...( { hotel_rate_id: e.target.value || null } as any ) })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                          >
                            <option value="">Select hotel...</option>
                            {getHotelOptions(p.hotel_city_id || p.city_id).map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.hotel_name}
                                {h.room_type ? ` - ${h.room_type}` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={p.hotel_city_id || ''}
                            onChange={(e) => patch(p.id, { hotel_city_id: e.target.value || null })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-white"
                          >
                            <option value="">Select...</option>
                            {cities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </label>
                    )}

                    <label className="text-sm md:col-span-6">
                      <div className="text-gray-600 mb-1">Notes</div>
                      <input
                        value={p.notes ?? ''}
                        onChange={(e) => patch(p.id, { notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md"
                        placeholder="Optional"
                        autoComplete="off"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* ✅ NEW: Copy Down */}
                    <button
                      onClick={() => copyDown(idx)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                      type="button"
                      title="Copy these selections to all participants below"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Down
                    </button>

                    <button
                      onClick={() => onRemoveParticipant(p.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default memo(ParticipantsTab);

