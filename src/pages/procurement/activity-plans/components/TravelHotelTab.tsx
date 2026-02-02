import React, { memo } from 'react';
import type { CityRow, Currency, HotelGroup, TransportGroup, ServiceGroup } from '../types/activityPlan';
import { num } from '../lib/activityPlanCalculations';

type Props = {
  cities: CityRow[];
  transportGroups: TransportGroup[];
  hotelGroups: HotelGroup[];

  // ✅ Hotel booking dates (صاروا optional حتى ما ينكسر إذا الأب ما يرسلهم)
  hotelCheckIn?: string | null;
  hotelCheckOut?: string | null;
  onChangeHotelCheckIn?: (v: string | null) => void;
  onChangeHotelCheckOut?: (v: string | null) => void;

  // ✅ Nights (optional)
  hotelNights?: number | null;
  onChangeHotelNights?: (n: number | null) => void;

  // ✅ جديد
  flightGroups?: ServiceGroup[];
  airportTaxiGroups?: ServiceGroup[];

  formatCurrency: (amount: number, currency: Currency) => string;
};

function TravelHotelTab(props: Props) {
  const {
    cities,
    transportGroups,
    hotelGroups,
    formatCurrency,
  } = props;

  // ✅ fallbacks + no-ops (حتى ما يصير TypeError)
  const hotelCheckIn = props.hotelCheckIn ?? null;
  const hotelCheckOut = props.hotelCheckOut ?? null;
  const hotelNights = props.hotelNights ?? null;

  const onChangeHotelCheckIn = props.onChangeHotelCheckIn || (() => {});
  const onChangeHotelCheckOut = props.onChangeHotelCheckOut || (() => {});
  const onChangeHotelNights = props.onChangeHotelNights || (() => {});

  const flightGroups = Array.isArray(props.flightGroups) ? props.flightGroups : [];
  const airportTaxiGroups = Array.isArray(props.airportTaxiGroups) ? props.airportTaxiGroups : [];

  const cityName = (id: string | null) => cities.find((c) => c.id === id)?.name || '—';

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200">
        <div className="font-semibold text-gray-900">{title}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  const safeTransport = Array.isArray(transportGroups) ? transportGroups : [];
  const safeHotel = Array.isArray(hotelGroups) ? hotelGroups : [];

  const dateDiffNights = (checkInX: string | null, checkOutX: string | null) => {
    if (!checkInX || !checkOutX) return 0;
    const s = new Date(checkInX);
    const e = new Date(checkOutX);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const computedNights = dateDiffNights(hotelCheckIn, hotelCheckOut);
  const nightsValue = typeof hotelNights === 'number' ? hotelNights : computedNights;

  const ServiceTable = ({ rows, title }: { rows: ServiceGroup[]; title: string }) => {
    if (rows.length === 0) {
      return (
        <Card title={title}>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No needs yet.
          </div>
        </Card>
      );
    }

    return (
      <Card title={title}>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Service</th>
                <th className="text-left p-3">City</th>
                <th className="text-left p-3">People</th>
                <th className="text-left p-3">Unit Price</th>
                <th className="text-left p-3">Currency</th>
                <th className="text-left p-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {rows.map((g) => {
                const ppl = (g.participant_ids || []).length;
                const unitPrice = num(g.unit_price, 0);
                const total = ppl * unitPrice; // per person
                return (
                  <tr key={g.key}>
                    <td className="p-3">{g.service_type === 'flight' ? 'Flight' : 'Airport Taxi'}</td>
                    <td className="p-3">{g.city_id ? cityName(g.city_id) : '—'}</td>
                    <td className="p-3">{ppl}</td>
                    <td className="p-3">{formatCurrency(unitPrice, g.currency)}</td>
                    <td className="p-3">{g.currency}</td>
                    <td className="p-3 font-semibold">{formatCurrency(total, g.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* ✅ Booking control */}
      <Card title="Hotel Booking Dates">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <label className="text-sm">
            <div className="text-gray-600 mb-1">Check-in</div>
            <input
              type="date"
              value={hotelCheckIn || ''}
              onChange={(e) => onChangeHotelCheckIn(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">Check-out</div>
            <input
              type="date"
              value={hotelCheckOut || ''}
              onChange={(e) => onChangeHotelCheckOut(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </label>

          <div className="text-sm text-gray-700">
            <div className="text-gray-600 mb-1">Nights</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={Number.isFinite(nightsValue) ? String(nightsValue) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return onChangeHotelNights(null);
                  const n = Math.max(0, Math.floor(num(v, 0)));
                  onChangeHotelNights(n);
                }}
                className="w-24 px-3 py-2 border border-gray-200 rounded-md"
              />

              <button
                type="button"
                onClick={() => onChangeHotelNights(null)}
                className="px-3 py-2 text-xs rounded-md border border-gray-200 hover:bg-gray-50"
                title="Reset to auto"
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Transport (Auto merged)">
        {safeTransport.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No transport needs yet. Mark participants as Needs Transport and set From/To.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Route</th>
                  <th className="text-left p-3">Basis</th>
                  <th className="text-left p-3">People</th>
                  <th className="text-left p-3">Unit Price</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-left p-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {safeTransport.map((g) => {
                  const ppl = (g.participant_ids || []).length;
                  const qty = g.pricing_basis === 'per_trip' ? 1 : ppl;
                  const total = qty * num(g.unit_price, 0);
                  return (
                    <tr key={g.key}>
                      <td className="p-3">{cityName(g.from_city_id)} → {cityName(g.to_city_id)}</td>
                      <td className="p-3">{g.pricing_basis}</td>
                      <td className="p-3">{ppl}</td>
                      <td className="p-3">{formatCurrency(num(g.unit_price, 0), g.currency)}</td>
                      <td className="p-3">{g.currency}</td>
                      <td className="p-3 font-semibold">{formatCurrency(total, g.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Hotels (Auto merged)">
        {safeHotel.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
            No hotel needs yet. Mark participants as Needs Hotel and set Hotel City.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Hotel</th>
                  <th className="text-left p-3">City</th>
                  <th className="text-left p-3">Basis</th>
                  <th className="text-left p-3">People</th>
                  <th className="text-left p-3">Nights</th>
                  <th className="text-left p-3">Unit Price/Night</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-left p-3">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y bg-white">
                {safeHotel.map((g) => {
                  const ppl = (g.participant_ids || []).length;

                  const nights =
                    Number.isFinite(nightsValue) && nightsValue > 0
                      ? Number(nightsValue)
                      : dateDiffNights(g.check_in, g.check_out);

                  const qty = g.pricing_basis === 'per_room' ? Math.max(1, num(g.rooms, 1)) : ppl;
                  const total = qty * nights * num(g.unit_price_per_night, 0);

                  return (
                    <tr key={g.key}>
                      <td className="p-3">{g.hotel_name}</td>
                      <td className="p-3">{cityName(g.city_id)}</td>
                      <td className="p-3">{g.pricing_basis}</td>
                      <td className="p-3">{ppl}</td>
                      <td className="p-3">{nights}</td>
                      <td className="p-3">{formatCurrency(num(g.unit_price_per_night, 0), g.currency)}</td>
                      <td className="p-3">{g.currency}</td>
                      <td className="p-3 font-semibold">{formatCurrency(total, g.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ServiceTable title="Flights (Auto merged)" rows={flightGroups} />
      <ServiceTable title="Airport Taxi (Auto merged)" rows={airportTaxiGroups} />
    </div>
  );
}

export default memo(TravelHotelTab);
