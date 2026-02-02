export type TabKey = 'info' | 'participants' | 'travel' | 'venue' | 'extras' | 'summary';

export type Currency = 'USD' | 'IQD';
export type PricingMode = 'auto' | 'manual';

export type ParticipantType = 'staff' | 'external' | 'vip';

export type TransportBasis = 'per_trip' | 'per_person';
export type HotelBasis = 'per_room' | 'per_person';

export type CityRow = { id: string; name: string };
export type ProjectRow = { id: string; name: string | null };

export type TransportRouteRow = {
  id: string;
  city_a_id: string;
  city_b_id: string;
  pricing_basis_default: TransportBasis;
  currency: Currency | string;
  unit_price: number;
  is_active?: boolean;
};

export type HotelRateRow = {
  id: string;
  city_id: string;
  hotel_name: string;
  pricing_basis: HotelBasis;
  room_type: string | null;
  currency: Currency | string;
  unit_price_per_night: number;
  is_active?: boolean;
};

export type ServiceRateRow = {
  id: string;
  service_type: string;
  city_id: string | null;
  pricing_basis: 'per_day' | 'per_trip' | 'per_hour' | 'fixed';
  currency: Currency | string;
  unit_price: number;
  is_active?: boolean;
};

export type Participant = {
  id: string;
  participant_type: ParticipantType;
  full_name: string;
  city_id: string | null;

  needs_transport: boolean;
  needs_hotel: boolean;

  transport_from_city_id: string | null;
  transport_to_city_id: string | null;

  hotel_city_id: string | null;

  // ✅ اختيار الفندق بالاسم (مهم إذا أكثر من فندق بنفس المدينة)
  hotel_rate_id: string | null;

  needs_flight: boolean;
  needs_airport_taxi: boolean;

  notes: string;
};

export type VenueEntry = {
  id: string;
  venue_name: string;
  days: string;
  currency: Currency;
  unit_price_per_day: string;
  notes: string;
};

export type CateringEntry = {
  id: string;
  type: 'lunch' | 'coffee_break';
  persons: string;
  days: string;
  times_per_day: string;
  currency: Currency;
  unit_price: string;
  notes: string;
};

export type ExtraEntry = {
  id: string;
  service_type: string;
  service_rate_id: string | null;
  pricing_mode: PricingMode;

  qty: string;
  unit: string;

  currency: Currency;
  unit_price: string;

  description: string;
  notes: string;
};

export type TransportGroup = {
  key: string;
  from_city_id: string;
  to_city_id: string;
  participant_ids: string[];
  pricing_basis: TransportBasis;
  currency: Currency;
  unit_price: number;
};

export type HotelGroup = {
  key: string;
  city_id: string;
  participant_ids: string[];
  pricing_basis: HotelBasis;
  currency: Currency;
  unit_price_per_night: number;
  hotel_name: string;
  room_type: string;
  check_in: string | null;
  check_out: string | null;
  rooms: number;
};

// ✅ جديد: مجموعات للطيران وتكسي المطار
export type ServiceGroup = {
  key: string;
  service_type: 'flight' | 'airport_taxi' | string;
  city_id: string | null;
  participant_ids: string[];
  pricing_basis: ServiceRateRow['pricing_basis'];
  currency: Currency;
  unit_price: number;
};

export type SummaryRow = {
  key: string;
  category: 'transport' | 'hotel' | 'flight' | 'airport_taxi' | 'venue' | 'catering' | 'extra';
  item: string;
  unit: string;
  qty: number;
  frequency: number;
  unit_price: number;
  currency: Currency;
  total: number;
  meta?: any;
};
