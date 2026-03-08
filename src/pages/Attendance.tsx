import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  MapPinOff,
  CalendarDays,
  RefreshCw,
  Fingerprint,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Send,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { getDistance } from 'geolib';

interface AttendanceRecord {
  id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude?: number | null;
  check_out_longitude?: number | null;
  outside_zone_place?: string | null;
  outside_zone_note?: string | null;
}

interface AttendanceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface AdjustmentRequestForm {
  requestType: 'check_in' | 'check_out';
  requestedTime: string;
  reason: string;
  requestPlace: string;
  requestNote: string;
}

interface OutsideZoneForm {
  place: string;
  note: string;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function monthLabel(year: number, monthIndex: number) {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}
function monthRangeISO(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    startDate: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-01`,
    endDate: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-01`,
  };
}
function formatTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}
function formatDateTimeLocalInput(date: string | null) {
  const value = date ? new Date(date) : new Date();
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}
function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'inside_zone':
      return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200';
    case 'outside_zone':
      return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
    case 'approved':
      return 'bg-blue-100 text-blue-800 ring-1 ring-blue-200';
    case 'rejected':
      return 'bg-rose-100 text-rose-800 ring-1 ring-rose-200';
    default:
      return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200';
  }
}

function FingerprintArt({
  progress,
  mode,
  pressing,
}: {
  progress: number;
  mode: 'checkin' | 'checkout';
  pressing: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const fillClass = mode === 'checkout' ? 'text-rose-600' : 'text-emerald-600';
  const clipTop = Math.max(0, (1 - p) * 100);
  const scanColor = mode === 'checkout' ? 'rgba(225,29,72,0.65)' : 'rgba(5,150,105,0.65)';

  return (
    <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32">
      <Fingerprint className="h-20 w-20 sm:h-24 sm:w-24 text-gray-900/85" />
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          clipPath: `inset(${clipTop}% 0 0 0)`,
          opacity: pressing ? 1 : 0,
          transition: pressing ? 'none' : 'opacity 200ms ease',
        }}
      >
        <Fingerprint className={`h-20 w-20 sm:h-24 sm:w-24 ${fillClass}`} />
      </div>
      {pressing && (
        <>
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[72%] h-[2px] rounded-full opacity-60"
            style={{ top: `${12 + p * 76}%`, background: scanColor }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[72%] h-[1px] rounded-full opacity-25"
            style={{ top: `${12 + p * 76 + 2.2}%`, background: scanColor }}
          />
        </>
      )}
    </div>
  );
}

export default function Attendance() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<AttendanceRecord | null>(null);
  const [zones, setZones] = useState<AttendanceZone[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [zonePreview, setZonePreview] = useState<'unknown' | 'inside' | 'outside'>('unknown');
  const initNow = useMemo(() => new Date(), []);
  const [filterYear, setFilterYear] = useState<number>(initNow.getFullYear());
  const [filterMonth, setFilterMonth] = useState<number>(initNow.getMonth());
  const range = useMemo(() => monthRangeISO(filterYear, filterMonth), [filterYear, filterMonth]);
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = current; y >= current - 6; y--) arr.push(y);
    return arr;
  }, []);

  const HOLD_MS = 1000;
  const [pressing, setPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [pressHint, setPressHint] = useState<string>('Hold 1s to scan');
  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<number | null>(null);

  const [showOutsideZoneModal, setShowOutsideZoneModal] = useState(false);
  const [pendingOutsideZoneData, setPendingOutsideZoneData] = useState<{ latitude: number; longitude: number } | null>(null);
  const [outsideZoneForm, setOutsideZoneForm] = useState<OutsideZoneForm>({ place: '', note: '' });

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentTargetRecord, setAdjustmentTargetRecord] = useState<AttendanceRecord | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentRequestForm>({
    requestType: 'check_in',
    requestedTime: formatDateTimeLocalInput(null),
    reason: '',
    requestPlace: '',
    requestNote: '',
  });

  const headerMessage = locationError || error || success;
  const headerType = error || locationError ? 'error' : success ? 'success' : null;

  const vibrate = (pattern: number | number[]) => {
    const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
    if (nav?.vibrate) nav.vibrate(pattern);
  };

  const ensureAudio = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctx = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtxRef.current = new Ctx();
    return audioCtxRef.current;
  };

  const tickBeep = (freq = 820, ms = 55, volume = 0.03) => {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.01);
  };

  const startScanSound = () => {
    stopScanSound();
    tickBeep(900, 45, 0.03);
    beepIntervalRef.current = window.setInterval(() => tickBeep(900, 45, 0.03), 130);
  };

  const stopScanSound = () => {
    if (beepIntervalRef.current) {
      window.clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    fetchAttendanceZones();
    fetchTodayRecord();
    fetchAttendanceHistory(range.startISO, range.endISO);
    return () => {
      clearInterval(t);
      stopScanSound();
    };
  }, []);

  useEffect(() => {
    fetchAttendanceHistory(range.startISO, range.endISO);
  }, [range.startISO, range.endISO, user?.id]);

  useEffect(() => {
    if (!zones.length || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ latitude, longitude });
        const inside = zones.some((zone) => {
          const distance = getDistance(
            { latitude, longitude },
            { latitude: zone.latitude, longitude: zone.longitude }
          );
          return distance <= zone.radius;
        });
        setZonePreview(inside ? 'inside' : 'outside');
      },
      () => setZonePreview('unknown'),
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 }
    );
  }, [zones]);

  const attendanceRecordSelect = 'id, check_in_time, check_out_time, status, check_in_latitude, check_in_longitude, check_out_latitude, check_out_longitude, outside_zone_place, outside_zone_note';

  const fetchAttendanceZones = async () => {
    try {
      const { data, error } = await supabase.from('attendance_zones').select('*').eq('is_active', true);
      if (error) throw error;
      setZones(data || []);
    } catch (e: any) {
      console.error('Error fetching zones:', e);
      setError(e.message);
    }
  };

  const fetchTodayRecord = async () => {
    if (!user) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const { data, error } = await supabase
        .from('attendance_records')
        .select(attendanceRecordSelect)
        .eq('employee_id', user.id)
        .gte('check_in_time', todayStart.toISOString())
        .lt('check_in_time', tomorrowStart.toISOString())
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentRecord(data);
    } catch (e: any) {
      console.error("Error fetching today's record:", e);
      setError(e.message);
    }
  };

  const fetchAttendanceHistory = async (startISO: string, endISO: string) => {
    if (!user) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(attendanceRecordSelect)
        .eq('employee_id', user.id)
        .gte('check_in_time', startISO)
        .lt('check_in_time', endISO)
        .order('check_in_time', { ascending: false });
      if (error) throw error;
      setAttendanceRecords(data || []);
    } catch (e: any) {
      console.error('Error fetching attendance history:', e);
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getUserLocationStrict = async (): Promise<GeolocationPosition> => {
    setLocationError(null);
    if (!navigator.geolocation) throw new Error('Geolocation is not supported by your browser');
    try {
      return await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        });
      });
    } catch (e: any) {
      if (e.code === 1) setLocationError('Location access denied. Enable location to check in/out.');
      else if (e.code === 2) setLocationError('Unable to determine your location. Check device settings.');
      else if (e.code === 3) setLocationError('Location timed out. Try again.');
      else setLocationError('An error occurred while getting your location.');
      throw e;
    }
  };

  const isWithinZone = (latitude: number, longitude: number): boolean => {
    return zones.some((zone) => {
      const distance = getDistance(
        { latitude, longitude },
        { latitude: zone.latitude, longitude: zone.longitude }
      );
      return distance <= zone.radius;
    });
  };

  const finalizeCheckIn = async (
    latitude: number,
    longitude: number,
    status: 'inside_zone' | 'outside_zone',
    outsideZoneDetails?: OutsideZoneForm
  ) => {
    if (!user?.id) throw new Error('No authenticated user found');

    const cleanedPlace = status === 'outside_zone' ? outsideZoneDetails?.place?.trim() || null : null;
    const cleanedNote = status === 'outside_zone' ? outsideZoneDetails?.note?.trim() || null : null;

    const { data: insertedRecord, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: user.id,
        check_in_time: new Date().toISOString(),
        check_in_latitude: latitude,
        check_in_longitude: longitude,
        status,
        outside_zone_place: cleanedPlace,
        outside_zone_note: cleanedNote,
        updated_at: new Date().toISOString(),
      })
      .select(attendanceRecordSelect)
      .single();

    if (insertError) throw insertError;
    if (!insertedRecord?.id) throw new Error('Attendance record was created without an id');

    const placeLooksMissing = status === 'outside_zone' && (
      insertedRecord.outside_zone_place !== cleanedPlace || insertedRecord.outside_zone_note !== cleanedNote
    );

    let finalRecord = insertedRecord as AttendanceRecord;

    if (placeLooksMissing) {
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance_records')
        .update({
          outside_zone_place: cleanedPlace,
          outside_zone_note: cleanedNote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', insertedRecord.id)
        .select(attendanceRecordSelect)
        .single();

      if (updateError) throw updateError;
      finalRecord = updatedRecord as AttendanceRecord;
    }

    if (status === 'outside_zone' && cleanedPlace && finalRecord?.outside_zone_place !== cleanedPlace) {
      throw new Error('Outside-zone place was not saved. Check that the app is using the latest Attendance.tsx file and that no older build is still cached.');
    }

    setCurrentRecord(finalRecord);
    setAttendanceRecords((prev) => [finalRecord, ...prev.filter((record) => record.id !== finalRecord.id)]);
    setOutsideZoneForm({ place: '', note: '' });
    setSuccess(status === 'outside_zone' ? 'Check-in recorded and sent for approval' : 'Check-in recorded');
    vibrate([20, 40, 20]);

    await fetchTodayRecord();
    await fetchAttendanceHistory(range.startISO, range.endISO);
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLocationError(null);
    try {
      const position = await getUserLocationStrict();
      const { latitude, longitude } = position.coords;
      setUserLocation({ latitude, longitude });
      const inside = isWithinZone(latitude, longitude);
      setZonePreview(inside ? 'inside' : 'outside');

      if (!inside) {
        setPendingOutsideZoneData({ latitude, longitude });
        setOutsideZoneForm({ place: '', note: '' });
        setShowOutsideZoneModal(true);
        return;
      }

      await finalizeCheckIn(latitude, longitude, 'inside_zone');
    } catch (e: any) {
      console.error('Error recording check-in:', e);
      if (!locationError) setError(e.message || 'Failed to record check-in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOutsideZoneCheckIn = async () => {
    if (!pendingOutsideZoneData) return;
    const cleanedPlace = outsideZoneForm.place.trim();
    const cleanedNote = outsideZoneForm.note.trim();

    if (!cleanedPlace || !cleanedNote) {
      setError('Please enter the place and note before submitting outside-zone attendance.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await finalizeCheckIn(
        pendingOutsideZoneData.latitude,
        pendingOutsideZoneData.longitude,
        'outside_zone',
        { place: cleanedPlace, note: cleanedNote }
      );

      setShowOutsideZoneModal(false);
      setPendingOutsideZoneData(null);
    } catch (e: any) {
      console.error('Error saving outside-zone check-in:', e);
      setError(e.message || 'Failed to save outside-zone attendance.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || !currentRecord) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setLocationError(null);
    try {
      const position = await getUserLocationStrict();
      const { latitude, longitude } = position.coords;
      setUserLocation({ latitude, longitude });
      const inside = isWithinZone(latitude, longitude);
      setZonePreview(inside ? 'inside' : 'outside');

      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_latitude: latitude,
          check_out_longitude: longitude,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentRecord.id);

      if (error) throw error;
      setSuccess('Check-out recorded');
      vibrate([30, 40, 30]);
      await fetchTodayRecord();
      await fetchAttendanceHistory(range.startISO, range.endISO);
    } catch (e: any) {
      console.error('Error recording check-out:', e);
      if (!locationError) setError('Failed to record check-out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdjustmentModal = (record: AttendanceRecord, requestType: 'check_in' | 'check_out') => {
    const defaultDate = requestType === 'check_in' ? record.check_in_time : record.check_out_time;
    setAdjustmentTargetRecord(record);
    setAdjustmentForm({
      requestType,
      requestedTime: formatDateTimeLocalInput(defaultDate),
      reason: '',
      requestPlace: '',
      requestNote: '',
    });
    setShowAdjustmentModal(true);
  };

  const handleSubmitAdjustmentRequest = async () => {
    if (!user || !adjustmentTargetRecord) return;
    if (!adjustmentForm.requestedTime || !adjustmentForm.reason.trim()) {
      setError('Please enter the requested time and the reason for the adjustment.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const currentTimeValue =
        adjustmentForm.requestType === 'check_in'
          ? adjustmentTargetRecord.check_in_time
          : adjustmentTargetRecord.check_out_time;

      const { error } = await supabase.from('attendance_adjustment_requests').insert([
        {
          employee_id: user.id,
          attendance_record_id: adjustmentTargetRecord.id,
          request_type: adjustmentForm.requestType,
          current_time: currentTimeValue,
          original_time: currentTimeValue,
          requested_time: new Date(adjustmentForm.requestedTime).toISOString(),
          reason: adjustmentForm.reason.trim(),
          request_place: adjustmentForm.requestPlace.trim() || null,
          request_note: adjustmentForm.requestNote.trim() || null,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      setShowAdjustmentModal(false);
      setSuccess('Adjustment request sent for admin approval.');
    } catch (e: any) {
      console.error('Error submitting adjustment request:', e);
      setError(e.message || 'Failed to submit adjustment request.');
    } finally {
      setLoading(false);
    }
  };

  const getNextAction = () => {
    if (!currentRecord?.check_in_time) return { action: 'checkin' as const, label: 'Check In', hint: 'Hold 1s to Check In' };
    if (currentRecord?.check_in_time && !currentRecord?.check_out_time)
      return { action: 'checkout' as const, label: 'Check Out', hint: 'Hold 1s to Check Out' };
    return { action: 'done' as const, label: 'Done', hint: 'Attendance completed for today' };
  };

  const resetPress = () => {
    setPressing(false);
    setPressProgress(0);
    pressStartRef.current = null;
    doneRef.current = false;
    stopScanSound();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
  };

  const onPressStart = () => {
    if (loading) return;
    const next = getNextAction();
    if (next.action === 'done') {
      setSuccess('You already completed today’s attendance');
      vibrate(20);
      return;
    }
    setError(null);
    setSuccess(null);
    setPressing(true);
    setPressHint(next.hint);
    pressStartRef.current = performance.now();
    doneRef.current = false;
    vibrate(10);
    startScanSound();

    const tick = () => {
      if (!pressStartRef.current) return;
      const elapsed = performance.now() - pressStartRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setPressProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = window.setTimeout(async () => {
      if (doneRef.current) return;
      doneRef.current = true;
      const a = getNextAction();
      if (a.action === 'checkin') await handleCheckIn();
      else if (a.action === 'checkout') await handleCheckOut();
      vibrate([15, 30, 15]);
      resetPress();
    }, HOLD_MS);
  };

  const onPressEnd = () => {
    if (!pressing) return;
    if (pressProgress < 1 && !doneRef.current) vibrate(8);
    resetPress();
  };

  const goPrevMonth = () => {
    const d = new Date(filterYear, filterMonth, 1);
    d.setMonth(d.getMonth() - 1);
    setFilterYear(d.getFullYear());
    setFilterMonth(d.getMonth());
  };

  const goNextMonth = () => {
    const d = new Date(filterYear, filterMonth, 1);
    d.setMonth(d.getMonth() + 1);
    setFilterYear(d.getFullYear());
    setFilterMonth(d.getMonth());
  };

  const nextAction = getNextAction();
  const baseRingClass = zonePreview === 'inside' ? 'text-emerald-200' : zonePreview === 'outside' ? 'text-amber-200' : 'text-gray-200';
  const progressRingClass = nextAction.action === 'checkout' ? 'text-rose-500' : 'text-emerald-500';
  const R = 54;
  const C = 2 * Math.PI * R;
  const dashOffset = C - C * pressProgress;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-gray-50 to-gray-100" />
      <style>{`
        @keyframes shimmerSweep {
          0% { transform: translateX(-120%) rotate(20deg); opacity: 0; }
          10% { opacity: 0.35; }
          50% { opacity: 0.55; }
          90% { opacity: 0.35; }
          100% { transform: translateX(120%) rotate(20deg); opacity: 0; }
        }
        .shimmer { animation: shimmerSweep 1.2s linear infinite; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 mb-5">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Attendance</h2>
              <p className="text-sm text-gray-500 mt-1">Fingerprint scan (tap & hold)</p>
            </div>
            <button
              onClick={async () => {
                setSuccess(null);
                setError(null);
                await fetchTodayRecord();
                await fetchAttendanceHistory(range.startISO, range.endISO);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
              disabled={historyLoading}
            >
              <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {headerMessage && (
              <div className={`mb-5 p-4 rounded-xl ${headerType === 'error' ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {headerType === 'error' ? (locationError ? <MapPinOff className="h-5 w-5 text-red-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />) : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm ${headerType === 'error' ? 'text-red-800' : 'text-emerald-900'}`}>{headerMessage}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-gray-50 border rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock3 className="h-5 w-5" />
                    <p className="text-sm font-medium">Current Time</p>
                  </div>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{currentTime.toLocaleTimeString()}</p>
                  <p className="text-gray-500 mt-1">
                    {currentTime.toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="bg-white border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-800">Today</p>
                    {currentRecord?.status ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(currentRecord.status)}`}>
                        {currentRecord.status.replace('_', ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">No record yet</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 border p-3">
                      <p className="text-xs text-gray-500">Check In</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{formatTime(currentRecord?.check_in_time ?? null)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 border p-3">
                      <p className="text-xs text-gray-500">Check Out</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">{formatTime(currentRecord?.check_out_time ?? null)}</p>
                    </div>
                  </div>

                  {currentRecord?.outside_zone_place && (
                    <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-900">
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        <MapPin className="h-4 w-4" />
                        Outside-zone details
                      </div>
                      <p><span className="font-medium">Place:</span> {currentRecord.outside_zone_place}</p>
                      {currentRecord.outside_zone_note && <p className="mt-1"><span className="font-medium">Note:</span> {currentRecord.outside_zone_note}</p>}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    {nextAction.action === 'checkin' ? (
                      <><ShieldCheck className="h-4 w-4" /><span>Ready for Check-in</span></>
                    ) : nextAction.action === 'checkout' ? (
                      <><ShieldAlert className="h-4 w-4" /><span>Ready for Check-out</span></>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" /><span>Completed today</span></>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {currentRecord?.check_in_time && (
                      <button
                        onClick={() => handleOpenAdjustmentModal(currentRecord, 'check_in')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50"
                      >
                        <FileText className="h-4 w-4" />
                        Request check-in adjustment
                      </button>
                    )}
                    {currentRecord && (
                      <button
                        onClick={() => handleOpenAdjustmentModal(currentRecord, 'check_out')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-50"
                      >
                        <FileText className="h-4 w-4" />
                        Request check-out adjustment
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 flex flex-col items-center justify-center">
                <div className="w-full max-w-xl">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-500">Action</p>
                    <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">{nextAction.label}</p>
                    <p className="text-sm text-gray-500 mt-2">{loading ? 'Processing...' : pressHint}</p>
                    <div className="mt-2 text-xs">
                      {zonePreview === 'inside' ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">Zone: Inside</span>
                      ) : zonePreview === 'outside' ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100">Zone: Outside</span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">Zone: Unknown</span>
                      )}
                    </div>
                  </div>

                  <div className="relative mx-auto w-80 h-80 sm:w-[360px] sm:h-[360px]">
                    <div className={`absolute inset-0 rounded-full blur-2xl transition-opacity ${pressing ? 'opacity-30' : 'opacity-20'} bg-gradient-to-br from-gray-200 via-gray-100 to-white`} />
                    <svg className="absolute inset-0" viewBox="0 0 160 160" aria-hidden="true">
                      <circle cx="80" cy="80" r={R} strokeWidth="10" className={baseRingClass} stroke="currentColor" fill="none" />
                      <circle
                        cx="80"
                        cy="80"
                        r={R}
                        strokeWidth="10"
                        strokeLinecap="round"
                        className={progressRingClass}
                        stroke="currentColor"
                        fill="none"
                        strokeDasharray={`${C} ${C}`}
                        strokeDashoffset={dashOffset}
                        style={{ transition: pressing ? 'none' : 'stroke-dashoffset 200ms ease' }}
                      />
                    </svg>

                    <button
                      onPointerDown={onPressStart}
                      onPointerUp={onPressEnd}
                      onPointerLeave={onPressEnd}
                      onPointerCancel={onPressEnd}
                      disabled={loading}
                      className={`relative z-10 w-full h-full rounded-full border shadow-xl flex flex-col items-center justify-center select-none transition-all duration-200 active:scale-[0.99] ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.92), rgba(245,246,250,0.80) 45%, rgba(238,241,248,0.95) 100%)' }}
                    >
                      {pressing && (
                        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                          <div className="shimmer absolute -left-1/2 top-0 h-full w-1/2" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)', filter: 'blur(1px)' }} />
                        </div>
                      )}
                      <FingerprintArt progress={pressProgress} mode={nextAction.action === 'checkout' ? 'checkout' : 'checkin'} pressing={pressing} />
                      <p className="mt-3 text-sm font-semibold text-gray-800">{pressing ? `Scanning… ${Math.round(pressProgress * 100)}%` : 'Hold to Scan'}</p>
                      <p className="mt-1 text-xs text-gray-500 px-10 text-center">
                        {nextAction.action === 'checkin' ? 'Keep holding for 1 second to check in' : nextAction.action === 'checkout' ? 'Keep holding for 1 second to check out' : 'No action available today'}
                      </p>
                      <div className="mt-4 text-[11px] text-gray-500 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white">Release early to cancel</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white">1s hold required</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-800">History</span>
                <span className="text-xs text-gray-500">{monthLabel(filterYear, filterMonth)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={goPrevMonth} className="px-2.5 py-2 text-sm border rounded-md hover:bg-gray-50" title="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                <select className="px-3 py-2 text-sm border rounded-md bg-white" value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>{new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' })}</option>
                  ))}
                </select>
                <select className="px-3 py-2 text-sm border rounded-md bg-white" value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={goNextMonth} className="px-2.5 py-2 text-sm border rounded-md hover:bg-gray-50" title="Next month"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-2xl bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">In</th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Out</th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Place / Note</th>
                    <th className="px-5 py-3 bg-gray-50 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Request</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyLoading ? (
                    <tr><td className="px-5 py-6 text-sm text-gray-500" colSpan={6}>Loading records...</td></tr>
                  ) : attendanceRecords.length === 0 ? (
                    <tr><td className="px-5 py-6 text-sm text-gray-500" colSpan={6}>No records for {monthLabel(filterYear, filterMonth)}.</td></tr>
                  ) : (
                    attendanceRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.check_in_time)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{formatTime(record.check_in_time)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{formatTime(record.check_out_time)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(record.status)}`}>
                            {record.status.replace('_', ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {record.outside_zone_place || record.outside_zone_note ? (
                            <div>
                              <p className="font-medium text-gray-900">{record.outside_zone_place || 'Outside zone'}</p>
                              <p className="text-xs text-gray-500 mt-1">{record.outside_zone_note || 'No note added'}</p>
                            </div>
                          ) : record.status === 'outside_zone' ? (
                            <span className="text-amber-600">Outside zone request submitted</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenAdjustmentModal(record, 'check_in')} className="px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">Edit in</button>
                            <button onClick={() => handleOpenAdjustmentModal(record, 'check_out')} className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">Edit out</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1"><Fingerprint className="h-4 w-4" />Long-press fingerprint to scan</span>
              <span className="text-gray-300">•</span>
              <span>{nextAction.action === 'checkin' ? 'Next: Check In' : nextAction.action === 'checkout' ? 'Next: Check Out' : 'Completed'}</span>
            </div>

            {userLocation && <div className="mt-2 text-[11px] text-gray-400">Location: {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}</div>}
          </div>
        </div>
      </div>

      {showOutsideZoneModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Outside zone check-in</h3>
              <button onClick={() => { setShowOutsideZoneModal(false); setPendingOutsideZoneData(null); }} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">You are outside the approved zone. Enter the place and note so the admin can review it.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
                <input
                  type="text"
                  value={outsideZoneForm.place}
                  onChange={(e) => setOutsideZoneForm((prev) => ({ ...prev, place: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Project site / client office / branch"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  rows={4}
                  value={outsideZoneForm.note}
                  onChange={(e) => setOutsideZoneForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Why are you checking in outside the zone?"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowOutsideZoneModal(false); setPendingOutsideZoneData(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500">Cancel</button>
              <button onClick={handleSaveOutsideZoneCheckIn} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700">
                <Send className="h-4 w-4 inline-block mr-2" />
                Submit for approval
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdjustmentModal && adjustmentTargetRecord && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Attendance adjustment request</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="text-gray-400 hover:text-gray-500"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request type</label>
                <select value={adjustmentForm.requestType} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, requestType: e.target.value as 'check_in' | 'check_out' }))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                  <option value="check_in">Check-in</option>
                  <option value="check_out">Check-out</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requested time</label>
                <input type="datetime-local" value={adjustmentForm.requestedTime} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, requestedTime: e.target.value }))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea rows={3} value={adjustmentForm.reason} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Explain why you need to modify the time" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place</label>
                <input type="text" value={adjustmentForm.requestPlace} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, requestPlace: e.target.value }))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Optional place" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input type="text" value={adjustmentForm.requestNote} onChange={(e) => setAdjustmentForm((prev) => ({ ...prev, requestNote: e.target.value }))} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Optional note" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowAdjustmentModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500">Cancel</button>
              <button onClick={handleSubmitAdjustmentRequest} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                <Send className="h-4 w-4 inline-block mr-2" />
                Send request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
