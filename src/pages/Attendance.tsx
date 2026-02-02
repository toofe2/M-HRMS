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
}

interface AttendanceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
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

/**
 * ✅ Fingerprint (Lucide icon) with:
 * - base black fingerprint
 * - fill overlay clipped from bottom to top by progress
 * - scan line while pressing
 */
function FingerprintArt({
  progress,
  mode,
  pressing,
}: {
  progress: number; // 0..1
  mode: 'checkin' | 'checkout';
  pressing: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const fillClass = mode === 'checkout' ? 'text-rose-600' : 'text-emerald-600';
  const clipTop = Math.max(0, (1 - p) * 100);

  const scanColor =
    mode === 'checkout' ? 'rgba(225,29,72,0.65)' : 'rgba(5,150,105,0.65)';

  return (
    <div className="relative flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32">
      {/* Base */}
      <Fingerprint className="h-20 w-20 sm:h-24 sm:w-24 text-gray-900/85" />

      {/* Fill overlay */}
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

      {/* Scan line */}
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
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationError, setLocationError] = useState<string | null>(null);

  // ✅ Zone preview before scan (if permission granted)
  const [zonePreview, setZonePreview] = useState<'unknown' | 'inside' | 'outside'>('unknown');

  // ✅ filter month/year
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

  // ✅ Long press scanning
  const HOLD_MS = 1000;
  const [pressing, setPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0); // 0..1
  const [pressHint, setPressHint] = useState<string>('Hold 1s to scan');

  const pressStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  // ✅ sound while scanning (WebAudio)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<number | null>(null);

  const headerMessage = locationError || error || success;
  const headerType = error || locationError ? 'error' : success ? 'success' : null;

  const vibrate = (pattern: number | number[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav: any = navigator;
    if (nav?.vibrate) nav.vibrate(pattern);
  };

  const ensureAudio = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAttendanceHistory(range.startISO, range.endISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startISO, range.endISO, user?.id]);

  // ✅ After zones load, try to preview inside/outside (optional)
  useEffect(() => {
    if (!zones.length) return;
    if (!navigator.geolocation) return;

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
      () => {
        setZonePreview('unknown');
      },
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 }
    );
  }, [zones]);

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
        .select('*')
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
        .select('*')
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

    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser');
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        });
      });
      return position;
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

      const status = inside ? 'inside_zone' : 'outside_zone';

      const { error } = await supabase.from('attendance_records').insert([
        {
          employee_id: user.id,
          check_in_time: new Date().toISOString(),
          check_in_latitude: latitude,
          check_in_longitude: longitude,
          status,
        },
      ]);

      if (error) throw error;

      setSuccess('Check-in recorded');
      vibrate([20, 40, 20]);
      await fetchTodayRecord();
      await fetchAttendanceHistory(range.startISO, range.endISO);
    } catch (e: any) {
      console.error('Error recording check-in:', e);
      if (!locationError) setError('Failed to record check-in. Please try again.');
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

  const getNextAction = () => {
    if (!currentRecord?.check_in_time)
      return { action: 'checkin' as const, label: 'Check In', hint: 'Hold 1s to Check In' };
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

  // Rings
  const nextAction = getNextAction();
  const baseRingClass =
    zonePreview === 'inside'
      ? 'text-emerald-200'
      : zonePreview === 'outside'
      ? 'text-amber-200'
      : 'text-gray-200';

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
              <div
                className={`mb-5 p-4 rounded-xl ${
                  headerType === 'error'
                    ? 'bg-red-50 border border-red-100'
                    : 'bg-emerald-50 border border-emerald-100'
                }`}
              >
                <div className="flex">
                  <div className="flex-shrink-0">
                    {headerType === 'error' ? (
                      locationError ? (
                        <MapPinOff className="h-5 w-5 text-red-400" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      )
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm ${headerType === 'error' ? 'text-red-800' : 'text-emerald-900'}`}>
                      {headerMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left */}
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
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                          currentRecord.status
                        )}`}
                      >
                        {currentRecord.status.replace('_', ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">No record yet</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 border p-3">
                      <p className="text-xs text-gray-500">Check In</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {formatTime(currentRecord?.check_in_time ?? null)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 border p-3">
                      <p className="text-xs text-gray-500">Check Out</p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {formatTime(currentRecord?.check_out_time ?? null)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    {nextAction.action === 'checkin' ? (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        <span>Ready for Check-in</span>
                      </>
                    ) : nextAction.action === 'checkout' ? (
                      <>
                        <ShieldAlert className="h-4 w-4" />
                        <span>Ready for Check-out</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Completed today</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Center */}
              <div className="lg:col-span-8 flex flex-col items-center justify-center">
                <div className="w-full max-w-xl">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-500">Action</p>
                    <p className="text-3xl sm:text-4xl font-extrabold text-gray-900">{nextAction.label}</p>
                    <p className="text-sm text-gray-500 mt-2">{loading ? 'Processing...' : pressHint}</p>

                    <div className="mt-2 text-xs">
                      {zonePreview === 'inside' ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                          Zone: Inside
                        </span>
                      ) : zonePreview === 'outside' ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                          Zone: Outside
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                          Zone: Unknown
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative mx-auto w-80 h-80 sm:w-[360px] sm:h-[360px]">
                    <div
                      className={`absolute inset-0 rounded-full blur-2xl transition-opacity ${
                        pressing ? 'opacity-30' : 'opacity-20'
                      } bg-gradient-to-br from-gray-200 via-gray-100 to-white`}
                    />

                    {/* Rings */}
                    <svg className="absolute inset-0" viewBox="0 0 160 160" aria-hidden="true">
                      <circle
                        cx="80"
                        cy="80"
                        r={R}
                        strokeWidth="10"
                        className={baseRingClass}
                        stroke="currentColor"
                        fill="none"
                      />
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

                    {/* Fingerprint button */}
                    <button
                      onPointerDown={onPressStart}
                      onPointerUp={onPressEnd}
                      onPointerLeave={onPressEnd}
                      onPointerCancel={onPressEnd}
                      disabled={loading}
                      className={`relative z-10 w-full h-full rounded-full border shadow-xl
                        flex flex-col items-center justify-center select-none
                        transition-all duration-200 active:scale-[0.99]
                        ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      style={{
                        background:
                          'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.92), rgba(245,246,250,0.80) 45%, rgba(238,241,248,0.95) 100%)',
                      }}
                    >
                      {pressing && (
                        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
                          <div
                            className="shimmer absolute -left-1/2 top-0 h-full w-1/2"
                            style={{
                              background:
                                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
                              filter: 'blur(1px)',
                            }}
                          />
                        </div>
                      )}

                      {/* ✅ Use Lucide fingerprint with progress fill */}
                      <FingerprintArt
                        progress={pressProgress}
                        mode={nextAction.action === 'checkout' ? 'checkout' : 'checkin'}
                        pressing={pressing}
                      />

                      <p className="mt-3 text-sm font-semibold text-gray-800">
                        {pressing ? `Scanning… ${Math.round(pressProgress * 100)}%` : 'Hold to Scan'}
                      </p>

                      <p className="mt-1 text-xs text-gray-500 px-10 text-center">
                        {nextAction.action === 'checkin'
                          ? 'Keep holding for 1 second to check in'
                          : nextAction.action === 'checkout'
                          ? 'Keep holding for 1 second to check out'
                          : 'No action available today'}
                      </p>

                      <div className="mt-4 text-[11px] text-gray-500 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white">
                          Release early to cancel
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white">
                          1s hold required
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="mt-8 mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-800">History</span>
                <span className="text-xs text-gray-500">{monthLabel(filterYear, filterMonth)}</span>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={goPrevMonth} className="px-2.5 py-2 text-sm border rounded-md hover:bg-gray-50" title="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <select
                  className="px-3 py-2 text-sm border rounded-md bg-white"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }).map((_, i) => (
                    <option key={i} value={i}>
                      {new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'short' })}
                    </option>
                  ))}
                </select>

                <select
                  className="px-3 py-2 text-sm border rounded-md bg-white"
                  value={filterYear}
                  onChange={(e) => setFilterYear(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <button onClick={goNextMonth} className="px-2.5 py-2 text-sm border rounded-md hover:bg-gray-50" title="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border rounded-2xl bg-white">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      In
                    </th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Out
                    </th>
                    <th className="px-5 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {historyLoading ? (
                    <tr>
                      <td className="px-5 py-6 text-sm text-gray-500" colSpan={4}>
                        Loading records...
                      </td>
                    </tr>
                  ) : attendanceRecords.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-sm text-gray-500" colSpan={4}>
                        No records for {monthLabel(filterYear, filterMonth)}.
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(record.check_in_time)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(record.check_in_time)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(record.check_out_time)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                              record.status
                            )}`}
                          >
                            {record.status.replace('_', ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Fingerprint className="h-4 w-4" />
                Long-press fingerprint to scan
              </span>
              <span className="text-gray-300">•</span>
              <span>
                {nextAction.action === 'checkin'
                  ? 'Next: Check In'
                  : nextAction.action === 'checkout'
                  ? 'Next: Check Out'
                  : 'Completed'}
              </span>
            </div>

            {userLocation && (
              <div className="mt-2 text-[11px] text-gray-400">
                Location: {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
