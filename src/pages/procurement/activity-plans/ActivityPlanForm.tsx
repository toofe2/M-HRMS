// src/pages/procurement/activity-plans/ActivityPlanForm.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Users,
  FileText,
  Car,
  Building2,
  ClipboardList,
  Trash2,
  Eye,
} from 'lucide-react';

import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import NotificationBell from '../../../components/NotificationBell';
import SettingsButton from '../../../components/SettingsButton';
import OptimizedImage from '../../../components/OptimizedImage';

import ActivityInfoTab from './components/ActivityInfoTab';
import ParticipantsTab from './components/ParticipantsTab';
import TravelHotelTab from './components/TravelHotelTab';
import VenueCateringTab from './components/VenueCateringTab';
import ExtrasTab from './components/ExtrasTab';
import SummaryTab from './components/SummaryTab';

import { ApprovalService } from '../../../services/approvalService';

import type {
  TabKey,
  Currency,
  CityRow,
  ProjectRow,
  TransportRouteRow,
  HotelRateRow,
  ServiceRateRow,
  Participant,
  VenueEntry,
  CateringEntry,
  ExtraEntry,
  SummaryRow,
  TransportGroup,
  HotelGroup,
  ServiceGroup,
} from './types/activityPlan';

import {
  uid,
  computeDaysInclusive,
  buildTransportGroups,
  buildHotelGroups,
  buildSummaryRows,
  buildTotalsByCurrency,
  safeArray,
  num,
} from './lib/activityPlanCalculations';

import { upsertDraft, createSummaryRequest } from './lib/draftSummaryService';

type PRRow = {
  id: string;
  request_no: string | null;
  status: string | null;
  linked_draft_id: string | null;
  requested_by_user_id: string | null;
  created_at: string;
};

function lower(x: any) {
  return String(x ?? '').toLowerCase();
}

function isLockedStatus(st: string) {
  const v = lower(st);
  return v === 'submitted' || v === 'pending' || v === 'approved';
}

function isEditableStatus(st: string) {
  const v = lower(st);
  return v === 'draft' || v === 'rejected' || v === '' || v === 'null' || v === 'undefined';
}

export default function ActivityPlanForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const { user } = useAuthStore();

  const [tab, setTab] = useState<TabKey>('info');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  // ✅ PR Summary status (linked to draft)
  const [prId, setPrId] = useState<string | null>(null);
  const [prNo, setPrNo] = useState<string | null>(null);
  const [prStatus, setPrStatus] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // masters
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [routes, setRoutes] = useState<TransportRouteRow[]>([]);
  const [hotelRates, setHotelRates] = useState<HotelRateRow[]>([]);
  const [serviceRates, setServiceRates] = useState<ServiceRateRow[]>([]);

  // Activity Plan Info
  const [apNumber, setApNumber] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // ✅ Travel/Hotel booking controls
  const [hotelCheckIn, setHotelCheckIn] = useState<string | null>(null);
  const [hotelCheckOut, setHotelCheckOut] = useState<string | null>(null);
  const [hotelNights, setHotelNights] = useState<number | null>(null);

  const baseCurrency: Currency = 'USD';

  // data
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [venueEntries, setVenueEntries] = useState<VenueEntry[]>([]);
  const [cateringEntries, setCateringEntries] = useState<CateringEntry[]>([]);
  const [extraEntries, setExtraEntries] = useState<ExtraEntry[]>([]);

  // -----------------------------
  // Load master data
  useEffect(() => {
    if (!user) return;

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [projRes, cityRes, routeRes, hotelRes, serviceRes] = await Promise.all([
          supabase.from('projects').select('id,name').order('name', { ascending: true }),
          supabase.from('cities').select('id,name').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('transport_routes').select('*').eq('is_active', true),
          supabase.from('hotel_rates').select('*').eq('is_active', true),
          supabase.from('service_rates').select('*').eq('is_active', true),
        ]);

        if (projRes.error) throw projRes.error;
        if (cityRes.error) throw cityRes.error;
        if (routeRes.error) throw routeRes.error;
        if (hotelRes.error) throw hotelRes.error;
        if (serviceRes.error) throw serviceRes.error;

        if (!mounted) return;

        setProjects(safeArray<ProjectRow>(projRes.data as any));
        setCities(safeArray<CityRow>(cityRes.data as any));
        setRoutes(safeArray<TransportRouteRow>(routeRes.data as any));
        setHotelRates(safeArray<HotelRateRow>(hotelRes.data as any));
        setServiceRates(safeArray<ServiceRateRow>(serviceRes.data as any));

        // ✅ Generate AP number only for NEW
        if (!isEdit) {
          const { data: apNo, error: apNoErr } = await supabase.rpc('next_document_number', { p_doc_type: 'AP' });
          if (!apNoErr && mounted) setApNumber(String(apNo));
        }
      } catch (e: any) {
        console.error(e);
        if (mounted) setError(e?.message || 'Failed to load master data');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, isEdit]);

  // -----------------------------
  // ✅ Load draft when editing
  useEffect(() => {
    if (!user?.id) return;
    if (!isEdit || !id) return;

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('activity_plan_drafts')
          .select('id, title, draft_payload, owner_user_id, is_archived, created_at, updated_at')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!mounted) return;

        const payload = (data as any)?.draft_payload || {};
        const info = payload?.info || {};

        setDraftId((data as any)?.id || id);

        setApNumber(payload?.ap_number ? String(payload.ap_number) : null);
        setProjectId(info?.project_id ?? null);

        const t = (info?.title ?? (data as any)?.title ?? '').toString();
        setTitle(t);
        setSubtitle((info?.subtitle ?? '').toString());
        setLocation((info?.location ?? '').toString());

        setStartDate(info?.start_date ?? null);
        setEndDate(info?.end_date ?? null);

        // ✅ load booking controls
        setHotelCheckIn(info?.hotel_check_in ?? null);
        setHotelCheckOut(info?.hotel_check_out ?? null);
        setHotelNights(typeof info?.hotel_nights === 'number' ? info.hotel_nights : null);

        setParticipants(safeArray<Participant>(payload?.participants));
        setVenueEntries(safeArray<VenueEntry>(payload?.venueEntries));
        setCateringEntries(safeArray<CateringEntry>(payload?.cateringEntries));
        setExtraEntries(safeArray<ExtraEntry>(payload?.extraEntries));
        setLastDraftSavedAt((data as any)?.updated_at ? String((data as any)?.updated_at) : null);
      } catch (e: any) {
        console.error(e);
        if (mounted) setError(e?.message || 'Failed to load draft');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, isEdit, id]);

  // -----------------------------
  // ✅ Load latest PR summary linked to this draft (for locking & buttons)
  useEffect(() => {
    if (!user?.id) return;
    const dId = draftId || (isEdit ? id || null : null);
    if (!dId) return;

    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('procurement_summary_requests')
          .select('id, request_no, status, linked_draft_id, requested_by_user_id, created_at')
          .eq('linked_draft_id', dId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        const r = (data || [])[0] as PRRow | undefined;

        if (!mounted) return;

        setPrId(r?.id || null);
        setPrNo(r?.request_no || null);
        setPrStatus(r?.status || null);
      } catch (e: any) {
        // مو قاتل، بس نخلي الحالة فارغة
        console.error(e);
        if (!mounted) return;
        setPrId(null);
        setPrNo(null);
        setPrStatus(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id, draftId, isEdit, id]);

  // ✅ Default booking dates follow activity dates (only if user hasn’t set them)
  useEffect(() => {
    if (!hotelCheckIn && startDate) setHotelCheckIn(startDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  useEffect(() => {
    if (!hotelCheckOut && endDate) setHotelCheckOut(endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDate]);

  // -----------------------------
  // Derived values
  const days = useMemo(() => computeDaysInclusive(startDate, endDate), [startDate, endDate]);
  const totalParticipants = useMemo(() => safeArray(participants).length, [participants]);

  const formatCurrency = useCallback((amount: number, currency: Currency) => {
    const n = Number(amount || 0);
    const cur: Currency = (currency || 'USD') as Currency;

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: cur === 'IQD' ? 0 : 2,
      }).format(n);
    } catch {
      return `${cur} ${n.toFixed(cur === 'IQD' ? 0 : 2)}`;
    }
  }, []);

  const transportGroups: TransportGroup[] = useMemo(() => {
    return buildTransportGroups({ participants, routes }) as any;
  }, [participants, routes]);

  const hotelGroups: HotelGroup[] = useMemo(() => {
    return buildHotelGroups({
      participants,
      hotelRates,
      startDate,
      endDate,
      hotelCheckIn,
      hotelCheckOut,
      hotelNights,
    } as any) as any;
  }, [participants, hotelRates, startDate, endDate, hotelCheckIn, hotelCheckOut, hotelNights]);

  // -----------------------------
  // ✅ Auto groups from service rates (flight / airport taxi)
  const getBestServiceRate = useCallback(
    (service_type: string, city_id: string | null) => {
      const list = safeArray<ServiceRateRow>(serviceRates);
      const cityMatch = list.find((r) => r.service_type === service_type && r.city_id === city_id);
      if (cityMatch) return cityMatch;
      const generic = list.find(
        (r) => r.service_type === service_type && (r.city_id === null || r.city_id === undefined)
      );
      if (generic) return generic;
      return list.find((r) => r.service_type === service_type) || null;
    },
    [serviceRates]
  );

  const buildAutoServiceGroups = useCallback(
    (service_type: 'airport_taxi' | 'flight') => {
      const ps = safeArray<Participant>(participants);
      const map = new Map<string, ServiceGroup>();

      ps.forEach((p) => {
        const needed = service_type === 'airport_taxi' ? !!p.needs_airport_taxi : !!p.needs_flight;
        if (!needed) return;

        const cityId = p.city_id || p.hotel_city_id || null;
        const rate = getBestServiceRate(service_type, cityId);
        const currency: Currency = ((rate?.currency as any) || 'USD') as Currency;
        const unit_price = num(rate?.unit_price, 0);

        const key = [service_type, cityId || '—', currency, unit_price].join('|');

        const ex = map.get(key);
        if (!ex) {
          map.set(key, {
            key,
            city_id: cityId,
            participant_ids: [p.id],
            currency,
            unit_price,
            service_type,
          } as any);
        } else {
          if (!ex.participant_ids.includes(p.id)) ex.participant_ids.push(p.id);
        }
      });

      return Array.from(map.values());
    },
    [participants, getBestServiceRate]
  );

  const airportTaxiGroups = useMemo(() => buildAutoServiceGroups('airport_taxi'), [buildAutoServiceGroups]);
  const flightGroups = useMemo(() => buildAutoServiceGroups('flight'), [buildAutoServiceGroups]);

  // base summary rows from existing calculators
  const baseSummaryRows = useMemo(() => {
    return buildSummaryRows({
      transportGroups,
      hotelGroups,
      venueEntries,
      cateringEntries,
      extraEntries,
      cities,
    }) as any;
  }, [transportGroups, hotelGroups, venueEntries, cateringEntries, extraEntries, cities]);

  // ✅ add flight/taxi to summary
  const summaryRows: SummaryRow[] = useMemo(() => {
    const rows = safeArray<SummaryRow>(baseSummaryRows);

    const addGroupAsRow = (g: ServiceGroup) => {
      const ppl = (g.participant_ids || []).length;
      const total = ppl * num(g.unit_price, 0);

      rows.push({
        key: g.key,
        category: 'extra' as any,
        item: g.service_type === 'airport_taxi' ? 'Airport Taxi (Auto)' : 'Flight (Auto)',
        unit: 'person',
        qty: ppl,
        frequency: 1,
        unit_price: num(g.unit_price, 0),
        currency: g.currency,
        total,
        meta: { auto: true, service_type: g.service_type, city_id: g.city_id, participants: g.participant_ids },
      } as any);
    };

    airportTaxiGroups.forEach(addGroupAsRow);
    flightGroups.forEach(addGroupAsRow);

    return rows;
  }, [baseSummaryRows, airportTaxiGroups, flightGroups]);

  // -----------------------------
  // ✅ Permissions / locking rules
  const isOwner = useMemo(() => {
    return !!user?.id; // draft owner enforced in table policies عادة
  }, [user?.id]);

  const lockForm = useMemo(() => {
    // إذا PR موجود وحالته submitted/pending/approved => lock
    if (prStatus && isLockedStatus(prStatus)) return true;
    return false;
  }, [prStatus]);

  const canEdit = useMemo(() => {
    if (!isOwner) return false;
    if (!prStatus) return true; // no PR yet => editable
    return isEditableStatus(prStatus);
  }, [isOwner, prStatus]);

  const canSave = canEdit && !lockForm;
  const canSubmit = canEdit && !lockForm;
  const canDelete = canEdit && !lockForm && (!!draftId || !!id);

  // -----------------------------
  // Validation
  const validate = useCallback(() => {
    if (!projectId) return 'Project is required';
    if (!title.trim()) return 'Activity title is required';
    if (!startDate || !endDate) return 'Start and end dates are required';
    if (days <= 0) return 'Invalid dates (end date must be after start date)';
    return null;
  }, [projectId, title, startDate, endDate, days]);

  // -----------------------------
  // Participants handlers
  const onAddParticipant = useCallback(() => {
    if (!canEdit) return;
    setParticipants((prev) => [
      ...safeArray(prev),
      {
        id: uid(),
        participant_type: 'external',
        full_name: '',
        city_id: null,

        needs_transport: false,
        needs_hotel: false,

        transport_from_city_id: null,
        transport_to_city_id: null,

        hotel_city_id: null,
        hotel_rate_id: null,

        needs_flight: false,
        needs_airport_taxi: false,

        notes: '',
      } as any,
    ]);
  }, [canEdit]);

  const onUpdateParticipant = useCallback(
    (pid: string, patch: Partial<Participant>) => {
      if (!canEdit) return;
      setParticipants((prev) => safeArray(prev).map((p) => (p.id === pid ? { ...p, ...patch } : p)));
    },
    [canEdit]
  );

  const onRemoveParticipant = useCallback(
    (pid: string) => {
      if (!canEdit) return;
      setParticipants((prev) => safeArray(prev).filter((p) => p.id !== pid));
    },
    [canEdit]
  );

  const onClearAllParticipants = useCallback(() => {
    if (!canEdit) return;
    setParticipants([]);
  }, [canEdit]);

  // Venue handlers
  const onAddVenue = useCallback(() => {
    if (!canEdit) return;
    setVenueEntries((prev) => [
      ...safeArray(prev),
      {
        id: uid(),
        venue_name: '',
        days: String(days || 1),
        currency: 'USD',
        unit_price_per_day: '0',
        notes: '',
      } as any,
    ]);
  }, [days, canEdit]);

  const onUpdateVenue = useCallback(
    (vid: string, patch: Partial<VenueEntry>) => {
      if (!canEdit) return;
      setVenueEntries((prev) => safeArray(prev).map((v) => (v.id === vid ? { ...v, ...patch } : v)));
    },
    [canEdit]
  );

  const onRemoveVenue = useCallback(
    (vid: string) => {
      if (!canEdit) return;
      setVenueEntries((prev) => safeArray(prev).filter((v) => v.id !== vid));
    },
    [canEdit]
  );

  // Catering handlers
  const onAddCatering = useCallback(
    (type: CateringEntry['type']) => {
      if (!canEdit) return;
      setCateringEntries((prev) => [
        ...safeArray(prev),
        {
          id: uid(),
          type,
          persons: String(totalParticipants || 0),
          days: String(days || 1),
          times_per_day: type === 'coffee_break' ? '2' : '1',
          currency: 'USD',
          unit_price: '0',
          notes: '',
        } as any,
      ]);
    },
    [days, totalParticipants, canEdit]
  );

  const onUpdateCatering = useCallback(
    (cid: string, patch: Partial<CateringEntry>) => {
      if (!canEdit) return;
      setCateringEntries((prev) => safeArray(prev).map((c) => (c.id === cid ? { ...c, ...patch } : c)));
    },
    [canEdit]
  );

  const onRemoveCatering = useCallback(
    (cid: string) => {
      if (!canEdit) return;
      setCateringEntries((prev) => safeArray(prev).filter((c) => c.id !== cid));
    },
    [canEdit]
  );

  // Extras handlers
  const onAddExtra = useCallback(() => {
    if (!canEdit) return;
    setExtraEntries((prev) => [
      ...safeArray(prev),
      {
        id: uid(),
        service_type: 'photographer',
        service_rate_id: null,
        pricing_mode: 'auto',
        qty: '1',
        unit: 'day',
        currency: 'USD',
        unit_price: '0',
        description: '',
        notes: '',
      } as any,
    ]);
  }, [canEdit]);

  const onUpdateExtra = useCallback(
    (eid: string, patch: Partial<ExtraEntry>) => {
      if (!canEdit) return;
      setExtraEntries((prev) => safeArray(prev).map((x) => (x.id === eid ? { ...x, ...patch } : x)));
    },
    [canEdit]
  );

  const onRemoveExtra = useCallback(
    (eid: string) => {
      if (!canEdit) return;
      setExtraEntries((prev) => safeArray(prev).filter((x) => x.id !== eid));
    },
    [canEdit]
  );

  // -----------------------------
  // Draft payload builder
  const buildDraftPayload = useCallback(() => {
    return {
      version: 1,
      ap_number: apNumber,
      info: {
        project_id: projectId,
        title,
        subtitle,
        location,
        start_date: startDate,
        end_date: endDate,
        base_currency: baseCurrency,

        hotel_check_in: hotelCheckIn,
        hotel_check_out: hotelCheckOut,
        hotel_nights: hotelNights,
      },
      participants,
      venueEntries,
      cateringEntries,
      extraEntries,
    };
  }, [
    apNumber,
    projectId,
    title,
    subtitle,
    location,
    startDate,
    endDate,
    baseCurrency,
    hotelCheckIn,
    hotelCheckOut,
    hotelNights,
    participants,
    venueEntries,
    cateringEntries,
    extraEntries,
  ]);

  // Save Draft
  const saveDraft = useCallback(async () => {
    if (!user?.id) {
      setError('You must be logged in');
      return;
    }
    if (!canSave) return;

    try {
      setSaving(true);
      setError(null);
      setOkMsg(null);

      const payload = buildDraftPayload();

      const row = await upsertDraft({
        draftId: draftId || (isEdit ? id || null : null),
        ownerUserId: user.id,
        title: title.trim() || 'Activity Plan Draft',
        payload,
      });

      setDraftId(row.id);
      setLastDraftSavedAt(new Date().toISOString());
      setOkMsg('Draft saved');
      setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }, [user?.id, canSave, draftId, buildDraftPayload, title, isEdit, id]);

  // Delete (only draft/rejected)
  const deleteDraftAndRequest = useCallback(async () => {
    if (!user?.id) return;
    if (!canDelete) return;

    const dId = draftId || (isEdit ? id || null : null);
    if (!dId) return;

    if (!confirm('Delete this draft? This cannot be undone.')) return;

    try {
      setDeleting(true);
      setError(null);

      // delete summary requests linked to this draft (draft/rejected only)
      await supabase.from('procurement_summary_requests').delete().eq('linked_draft_id', dId);

      // delete the draft
      const { error } = await supabase.from('activity_plan_drafts').delete().eq('id', dId);
      if (error) throw error;

      setOkMsg('Deleted');
      setTimeout(() => setOkMsg(null), 1500);

      navigate('/procurement/activity-plans');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete draft');
    } finally {
      setDeleting(false);
    }
  }, [user?.id, canDelete, draftId, isEdit, id, navigate]);

  // Submit Summary
  const submitSummary = useCallback(async () => {
    if (!user?.id) {
      setError('You must be logged in');
      return;
    }
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setError(null);
      setOkMsg(null);

      const v = validate();
      if (v) {
        setError(v);
        return;
      }

      // ensure draft exists
      let ensuredDraftId = draftId || (isEdit ? id || null : null);
      if (!ensuredDraftId) {
        const payload = buildDraftPayload();
        const row = await upsertDraft({
          draftId: null,
          ownerUserId: user.id,
          title: title.trim() || 'Activity Plan Draft',
          payload,
        });
        ensuredDraftId = row.id;
        setDraftId(row.id);
      }

      const totalsByCurrency = buildTotalsByCurrency(summaryRows);
      const projectName = projects.find((p) => p.id === projectId)?.name || '—';

      const summaryPayload = {
        version: 1,
        header: {
          request_date: new Date().toISOString().slice(0, 10),
          activity_start: startDate,
          activity_end: endDate,
          requested_by: {
            user_id: user.id,
            email: user.email || null,
            name: (user.user_metadata?.full_name as string) || user.email || '—',
          },
          project: { id: projectId, name: projectName },
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          location: location.trim() || null,
          base_currency: baseCurrency,
        },
        overview: {
          days,
          total_participants: totalParticipants,
        },
        participants,
        cost_items: summaryRows,
        totals_by_currency: totalsByCurrency,
      };

      // create PR summary request
      const created = await createSummaryRequest({
        requestedByUserId: user.id,
        linkedDraftId: ensuredDraftId!,
        summaryPayload,
        totalsByCurrency,
      });

      // create approval request
      const ar = await ApprovalService.createRequest({
        page_name: 'procurement_summary',
        request_data: { summary_request_id: created.id, request_no: created.request_no },
        priority: 'normal',
      });

      if (!ar.success) throw new Error(ar.error || 'Failed to create approval request');

      // set state
      setPrId(created.id);
      setPrNo(created.request_no);
      setPrStatus('submitted');

      setOkMsg(`Submitted for approval: ${created.request_no}`);
      setTimeout(() => setOkMsg(null), 2500);

      // go to details page مباشرة
      navigate(`/procurement/activity-plans/${created.id}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to submit summary');
    } finally {
      setSubmitting(false);
    }
  }, [
    user?.id,
    user?.email,
    user?.user_metadata,
    canSubmit,
    validate,
    draftId,
    buildDraftPayload,
    title,
    subtitle,
    location,
    startDate,
    endDate,
    baseCurrency,
    days,
    totalParticipants,
    participants,
    summaryRows,
    projects,
    projectId,
    isEdit,
    id,
    navigate,
  ]);

  // -----------------------------
  const TabButton = useCallback(
    ({ k, label, icon: Icon }: { k: TabKey; label: string; icon: any }) => (
      <button
        onClick={() => setTab(k)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border ${
          tab === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
        type="button"
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
    ),
    [tab]
  );

  const statusChip = useMemo(() => {
    const st = lower(prStatus);
    if (!st) return null;

    const base = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border';
    if (st === 'draft') return { cls: `${base} bg-gray-50 text-gray-700 border-gray-200`, text: 'DRAFT' };
    if (st === 'submitted' || st === 'pending')
      return { cls: `${base} bg-yellow-50 text-yellow-800 border-yellow-200`, text: st.toUpperCase() };
    if (st === 'approved') return { cls: `${base} bg-green-50 text-green-800 border-green-200`, text: 'APPROVED' };
    if (st === 'rejected') return { cls: `${base} bg-red-50 text-red-700 border-red-200`, text: 'REJECTED' };

    return { cls: `${base} bg-gray-50 text-gray-700 border-gray-200`, text: st.toUpperCase() };
  }, [prStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/procurement/activity-plans')}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-6"
                type="button"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Activity Plan' : 'New Activity Plan'}</h1>
                  {statusChip && <span className={statusChip.cls}>{statusChip.text}</span>}
                  {lockForm && (
                    <span className="text-xs text-gray-500 border border-gray-200 bg-gray-50 px-2 py-1 rounded-full">
                      Read-Only
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  {apNumber ? `AP: ${apNumber}` : 'AP: —'} · Base currency: {baseCurrency}
                  {prNo ? ` · PR: ${prNo}` : ''}
                  {lastDraftSavedAt ? ` · Saved: ${new Date(lastDraftSavedAt).toLocaleString()}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationBell />
              <SettingsButton />

              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100">
                  {user?.user_metadata?.profile_image_url || user?.user_metadata?.avatar_url ? (
                    <OptimizedImage
                      src={user.user_metadata.profile_image_url || user.user_metadata.avatar_url}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="h-8 w-8 object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-700 text-sm font-medium">{user?.email?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <span className="text-gray-700 text-sm">{user?.email}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {prId && (
                  <button
                    onClick={() => navigate(`/procurement/activity-plans/${prId}`)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white text-gray-900 text-sm font-medium border border-gray-300 hover:bg-gray-50"
                    type="button"
                  >
                    <Eye className="h-4 w-4" />
                    View PR
                  </button>
                )}

                {canDelete && (
                  <button
                    onClick={deleteDraftAndRequest}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white text-red-700 text-sm font-medium border border-red-200 hover:bg-red-50 disabled:opacity-60"
                    type="button"
                  >
                    {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                )}

                <button
                  onClick={saveDraft}
                  disabled={!canSave || saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-gray-900 text-sm font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                  type="button"
                  title={!canSave ? 'Locked (submitted/pending/approved)' : 'Save'}
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>

                <button
                  onClick={submitSummary}
                  disabled={!canSubmit || submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
                  type="button"
                  title={!canSubmit ? 'Locked (submitted/pending/approved)' : 'Send'}
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {(error || okMsg) && (
          <div
            className={`rounded-md border px-4 py-3 ${
              error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {error ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              <span className="text-sm">{error || okMsg}</span>
            </div>
          </div>
        )}

        {lockForm && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 px-4 py-3 text-sm">
            هذا الطلب <b>{String(prStatus).toUpperCase()}</b> — الفورم صار قراءة فقط. إذا صار <b>Rejected</b> يرجع التعديل تلقائياً.
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap gap-2">
          <TabButton k="info" label="Info" icon={FileText} />
          <TabButton k="participants" label="Participants" icon={Users} />
          <TabButton k="travel" label="Travel & Hotel" icon={Car} />
          <TabButton k="venue" label="Venue & Catering" icon={Building2} />
          <TabButton k="extras" label="Extras" icon={ClipboardList} />
          <TabButton k="summary" label="Summary" icon={FileText} />
        </div>

        {/* INFO */}
        {tab === 'info' && (
          <ActivityInfoTab
            projects={safeArray(projects)}
            cities={safeArray(cities)}
            apNumber={apNumber}
            baseCurrency={baseCurrency}
            projectId={projectId}
            title={title}
            subtitle={subtitle}
            location={location}
            startDate={startDate}
            endDate={endDate}
            days={days}
            totalParticipants={totalParticipants}
            setProjectId={canEdit ? setProjectId : () => {}}
            setTitle={canEdit ? setTitle : () => {}}
            setSubtitle={canEdit ? setSubtitle : () => {}}
            setLocation={canEdit ? setLocation : () => {}}
            setStartDate={canEdit ? setStartDate : () => {}}
            setEndDate={canEdit ? setEndDate : () => {}}
          />
        )}

        {/* PARTICIPANTS */}
        {tab === 'participants' && (
          <ParticipantsTab
            cities={safeArray(cities)}
            participants={safeArray(participants)}
            onAddParticipant={onAddParticipant}
            onUpdateParticipant={onUpdateParticipant}
            onRemoveParticipant={onRemoveParticipant}
            onClearAllParticipants={onClearAllParticipants}
          />
        )}

        {/* TRAVEL & HOTEL */}
        {tab === 'travel' && (
          <TravelHotelTab
            cities={safeArray(cities)}
            transportGroups={safeArray(transportGroups)}
            hotelGroups={safeArray(hotelGroups)}
            hotelCheckIn={hotelCheckIn}
            hotelCheckOut={hotelCheckOut}
            hotelNights={hotelNights}
            onChangeHotelCheckIn={canEdit ? setHotelCheckIn : () => {}}
            onChangeHotelCheckOut={canEdit ? setHotelCheckOut : () => {}}
            onChangeHotelNights={canEdit ? setHotelNights : () => {}}
            flightGroups={flightGroups as any}
            airportTaxiGroups={airportTaxiGroups as any}
            formatCurrency={formatCurrency}
          />
        )}

        {/* VENUE & CATERING */}
        {tab === 'venue' && (
          <VenueCateringTab
            venueEntries={safeArray(venueEntries)}
            cateringEntries={safeArray(cateringEntries)}
            daysDefault={days || 1}
            personsDefault={totalParticipants || 0}
            addVenue={onAddVenue}
            updateVenue={onUpdateVenue}
            removeVenue={onRemoveVenue}
            addCatering={onAddCatering}
            updateCatering={onUpdateCatering}
            removeCatering={onRemoveCatering}
            formatCurrency={formatCurrency}
          />
        )}

        {/* EXTRAS */}
        {tab === 'extras' && (
          <ExtrasTab
            serviceRates={safeArray(serviceRates)}
            extraEntries={safeArray(extraEntries)}
            onAddExtra={onAddExtra}
            onUpdateExtra={onUpdateExtra}
            onRemoveExtra={onRemoveExtra}
            formatCurrency={formatCurrency}
          />
        )}

        {/* SUMMARY */}
        {tab === 'summary' && (
          <SummaryTab
            summaryRows={safeArray(summaryRows)}
            participants={safeArray(participants)}
            cities={cities}
            header={{
              requestNo: prNo,
              requestDate: new Date().toISOString().slice(0, 10),
              activityStart: startDate,
              activityEnd: endDate,
              projectName: projects.find((p) => p.id === projectId)?.name || '—',
              title: title,
              location: location,
              requestedBy: (user?.user_metadata?.full_name as string) || user?.email || '—',
            }}
            formatCurrency={formatCurrency}
          />
        )}
      </main>
    </div>
  );
}
