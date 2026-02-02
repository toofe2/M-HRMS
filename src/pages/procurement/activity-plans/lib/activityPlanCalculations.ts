import type {
  Currency,
  Participant,
  CityRow,
  TransportRouteRow,
  HotelRateRow,
  ServiceRateRow,
  VenueEntry,
  CateringEntry,
  ExtraEntry,
  TransportBasis,
  HotelBasis,
  TransportGroup,
  HotelGroup,
  SummaryRow,
  ServiceGroup,
} from '../types/activityPlan';

// ---------- small utilities ----------
export const safeArray = <T>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const safeStr = (v: any) => (v === null || v === undefined ? '' : String(v));
export const num = (v: any, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

export const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

// ✅ export requested by your imports
export const computeDaysInclusive = (start: string | null, end: string | null) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
};

export const dateDiffNights = (checkIn: string | null, checkOut: string | null) => {
  if (!checkIn || !checkOut) return 0;
  const s = new Date(checkIn);
  const e = new Date(checkOut);
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

export const cityName = (cities: CityRow[], id: string | null) =>
  cities.find((c) => c.id === id)?.name || '—';

export const findRoute = (routes: TransportRouteRow[], fromId: string, toId: string) => {
  const rs = safeArray<TransportRouteRow>(routes);
  return (
    rs.find(
      (r) =>
        (r.city_a_id === fromId && r.city_b_id === toId) ||
        (r.city_a_id === toId && r.city_b_id === fromId)
    ) || null
  );
};

export const bestHotelRateForCity = (hotelRates: HotelRateRow[], cityId: string | null) => {
  if (!cityId) return null;
  const hrs = safeArray<HotelRateRow>(hotelRates);
  return hrs.find((h) => h.city_id === cityId) || null;
};

// ✅ NEW: جلب الفندق بالـ ID (حتى ما ياخذ أول فندق بالمدينة)
export const hotelRateById = (hotelRates: HotelRateRow[], id: string | null) => {
  if (!id) return null;
  const hrs = safeArray<HotelRateRow>(hotelRates);
  return hrs.find((h) => h.id === id) || null;
};

// ✅ جديد: أفضل ServiceRate حسب النوع + المدينة (إذا موجودة)
export const bestServiceRate = (serviceRates: ServiceRateRow[], serviceType: string, cityId: string | null) => {
  const sr = safeArray<ServiceRateRow>(serviceRates).filter((s) => String(s.service_type) === String(serviceType));
  if (sr.length === 0) return null;

  // إذا موجود city-specific خذه أولاً
  if (cityId) {
    const byCity = sr.find((s) => s.city_id === cityId);
    if (byCity) return byCity;
  }
  // fallback: city_id null (عام)
  const general = sr.find((s) => !s.city_id);
  return general || sr[0];
};

export const buildTransportGroups = (args: {
  participants: Participant[] | any;
  routes: TransportRouteRow[] | any;
}) => {
  const participants = safeArray<Participant>(args.participants);
  const routes = safeArray<TransportRouteRow>(args.routes);

  const map = new Map<string, TransportGroup>();

  participants.forEach((p) => {
    if (!p?.needs_transport) return;

    const from = p.transport_from_city_id || p.city_id;
    const to = p.transport_to_city_id;
    if (!from || !to) return;

    const r = findRoute(routes, from, to);
    const basis: TransportBasis = (r?.pricing_basis_default as any) || 'per_trip';
    const currency: Currency = ((r?.currency as any) || 'IQD') as Currency;
    const unit_price = num(r?.unit_price, 0);

    const key = ['transport', from, to, basis, currency, unit_price].join('|');
    const ex = map.get(key);
    if (!ex) {
      map.set(key, {
        key,
        from_city_id: from,
        to_city_id: to,
        participant_ids: [p.id],
        pricing_basis: basis,
        currency,
        unit_price,
      });
    } else {
      if (!ex.participant_ids.includes(p.id)) ex.participant_ids.push(p.id);
    }
  });

  return Array.from(map.values());
};

export const buildHotelGroups = (args: {
  participants: Participant[] | any;
  hotelRates: HotelRateRow[] | any;
  checkIn: string | null;
  checkOut: string | null;
}) => {
  const participants = safeArray<Participant>(args.participants);
  const hotelRates = safeArray<HotelRateRow>(args.hotelRates);

  const map = new Map<string, HotelGroup>();

  participants.forEach((p) => {
    if (!p?.needs_hotel) return;

    // ✅ إذا المستخدم مختار فندق معين، نعتمده
    const selectedHr = (p as any).hotel_rate_id ? hotelRateById(hotelRates, (p as any).hotel_rate_id) : null;

    // المدينة تبقى fallback فقط
    const city = selectedHr?.city_id || p.hotel_city_id || p.city_id;
    if (!city) return;

    // ✅ إذا ماكو اختيار، نرجع للسلوك القديم كـ fallback
    const hr = selectedHr || bestHotelRateForCity(hotelRates, city);
    const basis: HotelBasis = (hr?.pricing_basis as any) || 'per_person';
    const currency: Currency = ((hr?.currency as any) || 'USD') as Currency;
    const unit_price = num(hr?.unit_price_per_night, 0);
    const hotel_name = hr?.hotel_name || '—';
    const room_type = hr?.room_type || '';

    const check_in = args.checkIn;
    const check_out = args.checkOut;

    // ✅ key يعتمد على hotel_rate_id حتى ما يندمجون فنادق نفس المدينة
    const key = ['hotel', city, hr?.id || hotel_name, hotel_name, basis, currency, unit_price, check_in || '', check_out || ''].join('|');

    const ex = map.get(key);
    if (!ex) {
      map.set(key, {
        key,
        city_id: city,
        participant_ids: [p.id],
        pricing_basis: basis,
        currency,
        unit_price_per_night: unit_price,
        hotel_name,
        room_type,
        check_in,
        check_out,
        rooms: 1,
      });
    } else {
      if (!ex.participant_ids.includes(p.id)) ex.participant_ids.push(p.id);
    }
  });

  return Array.from(map.values());
};

// ✅ جديد: Build groups للطيران وتكسي المطار
export const buildServiceGroups = (args: {
  participants: Participant[] | any;
  serviceRates: ServiceRateRow[] | any;
  serviceType: 'flight' | 'airport_taxi';
}) => {
  const participants = safeArray<Participant>(args.participants);
  const serviceRates = safeArray<ServiceRateRow>(args.serviceRates);
  const map = new Map<string, ServiceGroup>();

  participants.forEach((p) => {
    const need =
      args.serviceType === 'flight' ? !!p.needs_flight : args.serviceType === 'airport_taxi' ? !!p.needs_airport_taxi : false;

    if (!need) return;

    const city = p.city_id || null;
    const rate = bestServiceRate(serviceRates, args.serviceType, city);

    const pricing_basis = (rate?.pricing_basis || 'fixed') as ServiceRateRow['pricing_basis'];
    const currency: Currency = ((rate?.currency as any) || 'USD') as Currency;
    const unit_price = num(rate?.unit_price, 0);

    const key = ['service', args.serviceType, city || 'any', pricing_basis, currency, unit_price].join('|');

    const ex = map.get(key);
    if (!ex) {
      map.set(key, {
        key,
        service_type: args.serviceType,
        city_id: city,
        participant_ids: [p.id],
        pricing_basis,
        currency,
        unit_price,
      });
    } else {
      if (!ex.participant_ids.includes(p.id)) ex.participant_ids.push(p.id);
    }
  });

  return Array.from(map.values());
};

export const buildFlightGroups = (args: { participants: Participant[] | any; serviceRates: ServiceRateRow[] | any }) =>
  buildServiceGroups({ ...args, serviceType: 'flight' });

export const buildAirportTaxiGroups = (args: { participants: Participant[] | any; serviceRates: ServiceRateRow[] | any }) =>
  buildServiceGroups({ ...args, serviceType: 'airport_taxi' });

export const buildSummaryRows = (args: {
  cities: CityRow[] | any;

  transportGroups: TransportGroup[] | any;
  hotelGroups: HotelGroup[] | any;

  // ✅ جديد
  flightGroups?: ServiceGroup[] | any;
  airportTaxiGroups?: ServiceGroup[] | any;

  venueEntries: VenueEntry[] | any;
  cateringEntries: CateringEntry[] | any;
  extraEntries: ExtraEntry[] | any;
}) => {
  const cities = safeArray<CityRow>(args.cities);
  const transportGroups = safeArray<TransportGroup>(args.transportGroups);
  const hotelGroups = safeArray<HotelGroup>(args.hotelGroups);

  const flightGroups = safeArray<ServiceGroup>(args.flightGroups);
  const airportTaxiGroups = safeArray<ServiceGroup>(args.airportTaxiGroups);

  const venueEntries = safeArray<VenueEntry>(args.venueEntries);
  const cateringEntries = safeArray<CateringEntry>(args.cateringEntries);
  const extraEntries = safeArray<ExtraEntry>(args.extraEntries);

  const rows: SummaryRow[] = [];

  // Transport
  transportGroups.forEach((g) => {
    const ppl = g.participant_ids.length;
    const qty = g.pricing_basis === 'per_trip' ? 1 : ppl;
    const frequency = 1;
    const total = qty * frequency * g.unit_price;

    rows.push({
      key: g.key,
      category: 'transport',
      item: `Transport: ${cityName(cities, g.from_city_id)} → ${cityName(cities, g.to_city_id)}`,
      unit: g.pricing_basis === 'per_trip' ? 'trip' : 'person',
      qty,
      frequency,
      unit_price: g.unit_price,
      currency: g.currency,
      total,
      meta: { participants: g.participant_ids, from: g.from_city_id, to: g.to_city_id },
    });
  });

  // Hotel
  hotelGroups.forEach((g) => {
    const ppl = g.participant_ids.length;
    const nights = dateDiffNights(g.check_in, g.check_out);
    const qty = g.pricing_basis === 'per_room' ? Math.max(1, g.rooms) : ppl;
    const frequency = nights;
    const total = qty * frequency * g.unit_price_per_night;

    rows.push({
      key: g.key,
      category: 'hotel',
      item: `Hotel: ${g.hotel_name} (${cityName(cities, g.city_id)})`,
      unit: g.pricing_basis === 'per_room' ? 'room' : 'person',
      qty,
      frequency,
      unit_price: g.unit_price_per_night,
      currency: g.currency,
      total,
      meta: { participants: g.participant_ids, city: g.city_id, nights, room_type: g.room_type },
    });
  });

  // ✅ Flight
  flightGroups.forEach((g) => {
    const ppl = g.participant_ids.length;
    const qty = ppl; // per person (افتراض عملي)
    const frequency = 1;
    const total = qty * frequency * num(g.unit_price, 0);

    rows.push({
      key: g.key,
      category: 'flight',
      item: `Flight${g.city_id ? ` (${cityName(cities, g.city_id)})` : ''}`,
      unit: 'person',
      qty,
      frequency,
      unit_price: num(g.unit_price, 0),
      currency: g.currency,
      total,
      meta: { participants: g.participant_ids, city: g.city_id, pricing_basis: g.pricing_basis },
    });
  });

  // ✅ Airport Taxi
  airportTaxiGroups.forEach((g) => {
    const ppl = g.participant_ids.length;
    const qty = ppl; // per person (افتراض عملي)
    const frequency = 1;
    const total = qty * frequency * num(g.unit_price, 0);

    rows.push({
      key: g.key,
      category: 'airport_taxi',
      item: `Airport Taxi${g.city_id ? ` (${cityName(cities, g.city_id)})` : ''}`,
      unit: 'person',
      qty,
      frequency,
      unit_price: num(g.unit_price, 0),
      currency: g.currency,
      total,
      meta: { participants: g.participant_ids, city: g.city_id, pricing_basis: g.pricing_basis },
    });
  });

  // Venue
  venueEntries.forEach((v) => {
    const frequency = Math.max(1, num(v.days, 1));
    const unit_price = Math.max(0, num(v.unit_price_per_day, 0));
    const qty = 1;
    const total = qty * frequency * unit_price;

    rows.push({
      key: `venue|${v.id}`,
      category: 'venue',
      item: `Venue: ${v.venue_name || '—'}`,
      unit: 'booking',
      qty,
      frequency,
      unit_price,
      currency: v.currency,
      total,
      meta: v,
    });
  });

  // Catering
  cateringEntries.forEach((c) => {
    const persons = Math.max(0, num(c.persons, 0));
    const d = Math.max(1, num(c.days, 1));
    const tpd = Math.max(1, num(c.times_per_day, 1));
    const unit_price = Math.max(0, num(c.unit_price, 0));

    const qty = persons;
    const frequency = d * tpd;
    const total = qty * frequency * unit_price;

    rows.push({
      key: `catering|${c.id}`,
      category: 'catering',
      item: c.type === 'lunch' ? 'Lunch' : 'Coffee Break',
      unit: c.type === 'lunch' ? 'person-meal' : 'person-break',
      qty,
      frequency,
      unit_price,
      currency: c.currency,
      total,
      meta: c,
    });
  });

  // Extras
  extraEntries.forEach((x) => {
    const qty = Math.max(1, num(x.qty, 1));
    const frequency = 1;
    const unit_price = Math.max(0, num(x.unit_price, 0));
    const total = qty * frequency * unit_price;

    rows.push({
      key: `extra|${x.id}`,
      category: 'extra',
      item: x.description || `Service: ${x.service_type}`,
      unit: x.unit || 'unit',
      qty,
      frequency,
      unit_price,
      currency: x.currency,
      total,
      meta: x,
    });
  });

  return rows;
};

export const buildTotalsByCurrency = (rows: SummaryRow[] | any) => {
  const rs = safeArray<SummaryRow>(rows);
  const byCurrency: Record<string, number> = {};
  rs.forEach((r) => {
    const cur = r.currency || 'USD';
    byCurrency[cur] = (byCurrency[cur] || 0) + (r.total || 0);
  });
  return byCurrency;
};
