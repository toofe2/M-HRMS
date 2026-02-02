import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  Info,
  Download,
  AlertCircle,
  XCircle,
  Filter,
  RefreshCw,
  CalendarDays,
  CheckCircle2,
  Clock,
  Wallet,
  Building2,
  User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import jsPDF from 'jspdf';

/**
 * ✅ NEW DATA MODEL (Payroll Runs)
 * payroll_run_employees (per employee per run)
 * payroll_run_items (line items)
 * payroll_runs (run header: month, office, currency, status)
 */

type PayrollRunStatus =
  | 'draft'
  | 'processed'
  | 'approved'
  | 'ready_to_pay'
  | 'paid'
  | 'locked'
  | 'cancelled'
  | string;

type PayrollItemType = 'addition' | 'deduction' | string;

interface Office {
  id: string;
  name: string;
  location: string;
  timezone: string;
  is_active?: boolean;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  office_id: string | null;
  offices?: Office | null;
}

interface PayrollRun {
  id: string;
  run_month: string; // date (first day of month)
  office_id: string;
  status: PayrollRunStatus;
  currency: string | null;
  payment_method_default: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  offices?: Office | null;
}

interface PayrollRunItem {
  id: string;
  run_employee_id: string;
  type: PayrollItemType; // addition/deduction
  source: string | null;
  name: string;
  amount: number;
  note: string | null;
  created_at: string;
}

interface PayrollRunEmployee {
  id: string;
  run_id: string;
  employee_id: string;

  base_salary: number;
  total_additions: number;
  total_deductions: number;

  net_salary: number;
  calc_net_salary: number;
  variance: number;

  status: PayrollRunStatus;
  payment_method: string | null;

  payslip_snapshot: any | null;

  created_at: string;
  updated_at: string;

  // joins
  payroll_runs?: PayrollRun | null;
  profiles?: Profile | null;
  payroll_run_items?: PayrollRunItem[] | null;
}

type LineItem = { label: string; amount: number; note?: string };

/** Branding settings (stored in system_settings.setting_key = 'pdf_branding') */
type PdfBrandingSettings = {
  company_name: string;

  logo_url: string | null;
  logo_x: number;
  logo_y: number;
  logo_w: number;

  pdf_footer_text: string;
  voucher_prefix: string;

  signer_name: string;
  signer_title: string;

  signature_url: string | null;
  signature_x: number;
  signature_y: number;
  signature_w: number;
};

const DEFAULT_PDF_BRANDING: PdfBrandingSettings = {
  company_name: 'Company Payroll System',

  logo_url: null,
  logo_x: 48,
  logo_y: 40,
  logo_w: 90,

  pdf_footer_text: 'This document is system-generated. If you have questions, contact HR.',
  voucher_prefix: 'PAY',

  signer_name: 'HR',
  signer_title: 'Human Resources',

  signature_url: null,
  signature_x: 360,
  signature_y: 680,
  signature_w: 140,
};

// ---------------------
// Utils
// ---------------------
function safeNum(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function sanitizeFileName(s: string) {
  return s.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
}

function jsonSafeParse(v: any) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

// ---------------------
// PDF helpers
// ---------------------
async function urlToDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });

  return { dataUrl, width: dims.width, height: dims.height };
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return 'PNG';
}

function ensureSpace(doc: jsPDF, y: number, needed: number, topY = 56) {
  const pageH = doc.internal.pageSize.getHeight();
  const bottomMargin = 56;
  if (y + needed > pageH - bottomMargin) {
    doc.addPage();
    return topY;
  }
  return y;
}

function wrapText(doc: jsPDF, text: string, maxWidth: number) {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

type TableCol = { key: string; label: string; width: number; align?: 'left' | 'right' | 'center' };

function drawTable(
  doc: jsPDF,
  cols: TableCol[],
  rows: Record<string, string>[],
  startX: number,
  startY: number,
  options?: { headerFill?: boolean; rowMinH?: number; topY?: number }
) {
  const rowMinH = options?.rowMinH ?? 18;
  const topY = options?.topY ?? 56;

  const tableW = cols.reduce((a, c) => a + c.width, 0);
  let y = startY;

  const drawHeader = () => {
    if (options?.headerFill !== false) {
      doc.setFillColor(245, 245, 245);
      doc.rect(startX, y, tableW, 22, 'F');
    }
    doc.setDrawColor(220);
    doc.rect(startX, y, tableW, 22);

    let x = startX;
    cols.forEach((c) => {
      doc.rect(x, y, c.width, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const tx = c.align === 'right' ? x + c.width - 6 : x + 6;
      doc.text(c.label, tx, y + 14, { align: c.align || 'left' });
      x += c.width;
    });

    y += 22;
  };

  const drawRow = (r: Record<string, string>) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const cellLines = cols.map((c) => wrapText(doc, r[c.key] ?? '', c.width - 12));
    const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
    const rowH = Math.max(rowMinH, maxLines * 12 + 8);

    const nextY = ensureSpace(doc, y, rowH + 6, topY);
    if (nextY !== y) {
      y = nextY;
      drawHeader();
    }

    doc.setDrawColor(220);
    doc.rect(startX, y, tableW, rowH);

    let x = startX;
    cols.forEach((c, i) => {
      doc.rect(x, y, c.width, rowH);

      const lines = cellLines[i];
      const tx = c.align === 'right' ? x + c.width - 6 : x + 6;

      let ty = y + 14;
      lines.forEach((line) => {
        doc.text(line, tx, ty, { align: c.align || 'left' });
        ty += 12;
      });

      x += c.width;
    });

    y += rowH;
  };

  drawHeader();
  rows.forEach(drawRow);

  doc.setDrawColor(220);
  doc.line(startX, y, startX + tableW, y);

  return y + 12;
}

function buildVoucherNo(runEmployeeId: string, runMonth: string, branding: PdfBrandingSettings) {
  const ym = monthKey(runMonth).replace('-', '');
  const shortId = (runEmployeeId || '').replace(/-/g, '').slice(0, 8) || '00000000';
  return `${branding.voucher_prefix || 'PAY'}-${ym}-${shortId}`;
}

async function buildPayslipPdf(args: {
  row: PayrollRunEmployee;
  branding: PdfBrandingSettings;
  formatCurrency: (n: number, currency?: string | null) => string;
  formatDate: (d: string | null | undefined) => string;
  getEmployeeName: (r: PayrollRunEmployee) => string;
  getOfficeText: (r: PayrollRunEmployee) => string;
}) {
  const { row, branding, formatCurrency, formatDate, getEmployeeName, getOfficeText } = args;

  // ✅ Prefer snapshot (approved stage)
  const snap = row.payslip_snapshot && typeof row.payslip_snapshot === 'object' ? row.payslip_snapshot : null;
  const itemsFromSnap = Array.isArray(snap?.items) ? snap.items : null;

  const items = itemsFromSnap
    ? (itemsFromSnap as any[]).map((i) => ({
        type: String(i.type || ''),
        name: String(i.name || ''),
        amount: safeNum(i.amount),
        note: i.note ? String(i.note) : '',
      }))
    : (row.payroll_run_items || []).map((i) => ({
        type: String(i.type || ''),
        name: i.name,
        amount: safeNum(i.amount),
        note: i.note || '',
      }));

  const additions = items.filter((i) => String(i.type) === 'addition');
  const deductions = items.filter((i) => String(i.type) === 'deduction');

  const additionsTotal = safeNum(row.total_additions);
  const deductionsTotal = safeNum(row.total_deductions);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;

  // ===== LOGO =====
  let logoW = 0;
  let logoH = 0;
  const logoX = safeNum(branding.logo_x) || 48;
  const logoY = safeNum(branding.logo_y) || 40;

  if (branding.logo_url) {
    try {
      const logo = await urlToDataUrl(branding.logo_url);
      const fmt = detectImageFormat(logo.dataUrl);
      logoW = safeNum(branding.logo_w) || 90;
      logoH = logoW * (logo.height / logo.width);
      doc.addImage(logo.dataUrl, fmt, logoX, logoY, logoW, logoH);
    } catch {}
  }

  const titleX = logoW ? Math.max(marginX, logoX + logoW + 14) : marginX;

  const employeeName = getEmployeeName(row);
  const officeText = getOfficeText(row);
  const department = row.profiles?.department || '-';
  const position = row.profiles?.position || '-';
  const email = row.profiles?.email || '-';
  const runMonth = row.payroll_runs?.run_month || row.created_at || new Date().toISOString();
  const periodText = monthKey(runMonth);
  const generatedAt = new Date().toLocaleString();
  const voucherNo = buildVoucherNo(row.id, runMonth, branding);
  const currency = row.payroll_runs?.currency || 'USD';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(branding.company_name || 'Company Payroll System', titleX, 60);

  doc.setFontSize(20);
  doc.text('Payslip', titleX, 84);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${generatedAt}`, titleX, 104);
  doc.text(`Voucher No: ${voucherNo}`, pageW - marginX, 104, { align: 'right' });

  let y = 122;
  if (logoH) y = Math.max(y, logoY + logoH + 18);

  doc.setDrawColor(220);
  doc.line(marginX, y, pageW - marginX, y);
  y += 18;

  // ===== Employee Info =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Employee Information', marginX, y);
  y += 10;

  const infoCols: TableCol[] = [
    { key: 'k', label: 'Field', width: 200 },
    { key: 'v', label: 'Value', width: pageW - marginX * 2 - 200 },
  ];

  const infoRows: Record<string, string>[] = [
    { k: 'Name', v: employeeName },
    { k: 'Email', v: email },
    { k: 'Department', v: department },
    { k: 'Position', v: position },
    { k: 'Office', v: officeText },
    { k: 'Period', v: periodText },
    { k: 'Status', v: String(row.status).toUpperCase() },
  ];

  y += 10;
  y = drawTable(doc, infoCols, infoRows, marginX, y, { headerFill: true, topY: 56 });

  // ===== Summary =====
  y = ensureSpace(doc, y, 40, 56);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Payroll Summary', marginX, y);
  y += 10;

  const summaryCols: TableCol[] = [
    { key: 'label', label: 'Item', width: 320 },
    { key: 'amount', label: 'Amount', width: pageW - marginX * 2 - 320, align: 'right' },
  ];

  const summaryRows: Record<string, string>[] = [
    { label: 'Base Salary', amount: formatCurrency(row.base_salary, currency) },
    { label: 'Total Additions', amount: formatCurrency(additionsTotal, currency) },
    { label: 'Total Deductions', amount: formatCurrency(deductionsTotal, currency) },
    { label: 'Net Salary (Recorded)', amount: formatCurrency(row.net_salary, currency) },
    { label: 'Net Salary (Calculated)', amount: formatCurrency(row.calc_net_salary, currency) },
  ];

  y += 10;
  y = drawTable(doc, summaryCols, summaryRows, marginX, y, { headerFill: true, topY: 56 });

  // ===== Details =====
  const detailsCols: TableCol[] = [
    { key: 'type', label: 'Type', width: 90 },
    { key: 'label', label: 'Description', width: 330 },
    { key: 'amount', label: 'Amount', width: pageW - marginX * 2 - 420, align: 'right' },
  ];

  const detailRows = [
    ...additions.map((x) => ({
      type: 'Addition',
      label: x.note ? `${x.name} (${x.note})` : x.name,
      amount: formatCurrency(x.amount, currency),
    })),
    ...deductions.map((x) => ({
      type: 'Deduction',
      label: x.note ? `${x.name} (${x.note})` : x.name,
      amount: formatCurrency(x.amount, currency),
    })),
  ];

  if (detailRows.length) {
    y = ensureSpace(doc, y, 40, 56);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Details', marginX, y);
    y += 10;

    y = drawTable(doc, detailsCols, detailRows, marginX, y + 10, { headerFill: true, topY: 56 });
  }

  // ===== Signature =====
  y = ensureSpace(doc, y, 170, 56);

  if (branding.signature_url) {
    try {
      const sig = await urlToDataUrl(branding.signature_url);
      const fmt = detectImageFormat(sig.dataUrl);
      const sigW = safeNum(branding.signature_w) || 140;
      const sigH = sigW * (sig.height / sig.width);

      const sx = safeNum(branding.signature_x) || pageW - marginX - sigW;
      const sy = safeNum(branding.signature_y) || pageH - 180;

      doc.addImage(sig.dataUrl, fmt, sx, sy, sigW, sigH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(branding.signer_name || 'HR', sx, sy + sigH + 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(branding.signer_title || 'Human Resources', sx, sy + sigH + 30);
    } catch {}
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(branding.signer_name || 'HR', marginX, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(branding.signer_title || 'Human Resources', marginX, y);
    y += 10;
  }

  // ===== Footer =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90);

    const footerY = doc.internal.pageSize.getHeight() - 28;
    doc.text(branding.pdf_footer_text || DEFAULT_PDF_BRANDING.pdf_footer_text, marginX, footerY);

    doc.setTextColor(120);
    doc.text(`Page ${i} of ${totalPages}`, pageW - marginX, footerY, { align: 'right' });
    doc.setTextColor(0);
  }

  return doc;
}

// ---------------------
// Component
// ---------------------
export default function Payroll() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<PayrollRunEmployee[]>([]);
  const [pdfBranding, setPdfBranding] = useState<PdfBrandingSettings>(DEFAULT_PDF_BRANDING);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchAll = async (isRefresh = false) => {
    if (!user) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const brandingQ = supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'pdf_branding')
        .maybeSingle();

      // ✅ NEW: Pull from payroll_run_employees
      const payrollQ = supabase
        .from('payroll_run_employees')
        .select(
          `
          id,
          run_id,
          employee_id,
          base_salary,
          total_additions,
          total_deductions,
          net_salary,
          calc_net_salary,
          variance,
          status,
          payment_method,
          payslip_snapshot,
          created_at,
          updated_at,
          payroll_runs:run_id (
            id,
            run_month,
            office_id,
            status,
            currency,
            payment_method_default,
            notes,
            created_at,
            updated_at,
            offices:office_id (
              id,
              name,
              location,
              timezone,
              is_active
            )
          ),
          profiles:employee_id (
            id,
            first_name,
            last_name,
            email,
            department,
            position,
            office_id,
            offices:office_id (
              id,
              name,
              location,
              timezone,
              is_active
            )
          ),
          payroll_run_items (
            id,
            run_employee_id,
            type,
            source,
            name,
            amount,
            note,
            created_at
          )
        `
        )
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      const [brandingRes, payrollRes] = await Promise.all([brandingQ, payrollQ]);

      if (brandingRes.error) throw brandingRes.error;
      if (payrollRes.error) throw payrollRes.error;

      const parsed = jsonSafeParse(brandingRes.data?.setting_value);
      setPdfBranding({ ...DEFAULT_PDF_BRANDING, ...(parsed || {}) });

      setRows((payrollRes.data as PayrollRunEmployee[]) || []);
    } catch (err: any) {
      console.error('Error fetching payroll data:', err);
      setError(err?.message || 'Failed to load payroll data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeNum(amount));

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString();
  };

  const getEmployeeName = (r: PayrollRunEmployee) => {
    const p = r.profiles;
    const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
    return full || 'Employee';
  };

  const getOfficeText = (r: PayrollRunEmployee) => {
    const office = r.payroll_runs?.offices || r.profiles?.offices;
    if (!office) return '-';
    const loc = office.location ? ` — ${office.location}` : '';
    return `${office.name}${loc}`;
  };

  const getStatusBadge = (status: PayrollRunStatus) => {
    const s = String(status);
    switch (s) {
      case 'paid':
        return { cls: 'bg-green-100 text-green-800', label: 'Paid', icon: CheckCircle2 };
      case 'ready_to_pay':
        return { cls: 'bg-emerald-100 text-emerald-800', label: 'Ready', icon: CheckCircle2 };
      case 'approved':
        return { cls: 'bg-purple-100 text-purple-800', label: 'Approved', icon: CheckCircle2 };
      case 'processed':
        return { cls: 'bg-blue-100 text-blue-800', label: 'Processed', icon: Clock };
      case 'draft':
        return { cls: 'bg-gray-100 text-gray-800', label: 'Draft', icon: Clock };
      default:
        return { cls: 'bg-gray-100 text-gray-800', label: s, icon: Clock };
    }
  };

  // ✅ compute totals & breakdown from payroll_run_items
  const computed = useMemo(() => {
    return rows.map((r) => {
      const items = (r.payroll_run_items || []) as PayrollRunItem[];

      const allowanceItems: LineItem[] = []; // legacy (not used now)
      const deductionJsonItems: LineItem[] = []; // legacy (not used now)

      const additionsItems: LineItem[] = items
        .filter((i) => String(i.type) === 'addition')
        .map((i) => ({ label: i.name, amount: safeNum(i.amount), note: i.note || undefined }));

      const deductionsItems: LineItem[] = items
        .filter((i) => String(i.type) === 'deduction')
        .map((i) => ({ label: i.name, amount: safeNum(i.amount), note: i.note || undefined }));

      const additionsTotal = safeNum(r.total_additions);
      const deductionsTotal = safeNum(r.total_deductions);

      const earningsSubtotal = safeNum(r.base_salary) + additionsTotal;
      const calcNet = safeNum(r.calc_net_salary) || (earningsSubtotal - deductionsTotal);

      return {
        record: r,
        totals: { additionsTotal, deductionsTotal, earningsSubtotal, calcNet },
        breakdown: {
          allowanceItems,
          additionsItems,
          deductionJsonItems,
          deductionsItems,
        },
      };
    });
  }, [rows]);

  const years = useMemo(() => {
    const set = new Set<string>();
    computed.forEach((x) => {
      const runMonth = x.record.payroll_runs?.run_month;
      if (!runMonth) return;
      const y = new Date(runMonth).getFullYear();
      if (!Number.isNaN(y)) set.add(String(y));
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [computed]);

  const filtered = useMemo(() => {
    return computed.filter(({ record }) => {
      const runMonth = record.payroll_runs?.run_month;
      const y = runMonth ? new Date(runMonth).getFullYear() : NaN;
      const matchYear = yearFilter === 'all' ? true : String(y) === yearFilter;
      const matchStatus = statusFilter === 'all' ? true : String(record.status) === statusFilter;
      return matchYear && matchStatus;
    });
  }, [computed, yearFilter, statusFilter]);

  const latest = useMemo(() => computed[0] || null, [computed]);

  const filteredTotals = useMemo(() => {
    const totalNet = filtered.reduce((acc, x) => acc + safeNum(x.record.net_salary), 0);
    const totalAdd = filtered.reduce((acc, x) => acc + safeNum(x.totals.additionsTotal), 0);
    const totalDed = filtered.reduce((acc, x) => acc + safeNum(x.totals.deductionsTotal), 0);
    return { totalNet, totalAdd, totalDed };
  }, [filtered]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return computed.find((x) => x.record.id === selectedId) || null;
  }, [computed, selectedId]);

  const openDetails = (id: string) => {
    setSelectedId(id);
    setShowDetailsModal(true);
  };

  const downloadPdf = async (item: (typeof computed)[number]) => {
    const r = item.record;
    setPdfBusyId(r.id);
    setError(null);

    try {
      const currency = r.payroll_runs?.currency || 'USD';
      const brandingSnap: PdfBrandingSettings = { ...DEFAULT_PDF_BRANDING, ...pdfBranding };

      const doc = await buildPayslipPdf({
        row: r,
        branding: brandingSnap,
        formatCurrency,
        formatDate,
        getEmployeeName,
        getOfficeText,
      });

      doc.save(`${sanitizeFileName(getEmployeeName(r))}_${monthKey(r.payroll_runs?.run_month || r.created_at)}.pdf`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to generate payslip PDF.');
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate('/')} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>

        {/* Header + Summary */}
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">My Payroll</h2>
              <p className="mt-1 text-sm text-gray-500">View your payslips and payroll history</p>
            </div>

            <button
              onClick={() => fetchAll(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card title="Employee" icon={<User className="h-5 w-5 text-gray-400" />}>
                <div className="text-lg font-bold text-gray-900">{latest ? getEmployeeName(latest.record) : '-'}</div>
                <div className="text-xs text-gray-500 mt-1">{latest ? latest.record.profiles?.email || '-' : '-'}</div>
              </Card>

              <Card title="Latest Net Salary" icon={<Wallet className="h-5 w-5 text-gray-400" />}>
                <div className="text-2xl font-bold text-gray-900">
                  {latest ? formatCurrency(latest.record.net_salary, latest.record.payroll_runs?.currency) : '-'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {latest?.record.payroll_runs?.run_month ? `Month: ${monthKey(latest.record.payroll_runs.run_month)}` : 'No records'}
                </div>
              </Card>

              <Card title="Latest Status" icon={<CheckCircle2 className="h-5 w-5 text-gray-400" />}>
                {latest ? (
                  <span
                    className={`inline-flex mt-2 px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(latest.record.status).cls}`}
                  >
                    {getStatusBadge(latest.record.status).label}
                  </span>
                ) : (
                  <div className="text-sm text-gray-500 mt-2">-</div>
                )}
                <div className="text-xs text-gray-500 mt-2">Based on latest run</div>
              </Card>

              <Card title="Office" icon={<Building2 className="h-5 w-5 text-gray-400" />}>
                <div className="text-lg font-bold text-gray-900">{latest ? getOfficeText(latest.record) : '-'}</div>
                <div className="text-xs text-gray-500 mt-1">From run office</div>
              </Card>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Filtered totals — Net:{' '}
              <span className="font-semibold text-gray-900">{formatCurrency(filteredTotals.totalNet, latest?.record.payroll_runs?.currency)}</span>{' '}
              | Additions:{' '}
              <span className="font-semibold text-gray-900">{formatCurrency(filteredTotals.totalAdd, latest?.record.payroll_runs?.currency)}</span>{' '}
              | Deductions:{' '}
              <span className="font-semibold text-gray-900">{formatCurrency(filteredTotals.totalDed, latest?.record.payroll_runs?.currency)}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-white shadow-sm rounded-2xl overflow-hidden">
            <div className="p-4 bg-red-50">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">Something went wrong</p>
                  <p className="text-sm text-red-800 mt-1">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Year</label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="all">All</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="processed">Processed</option>
                  <option value="approved">Approved</option>
                  <option value="ready_to_pay">Ready</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    setYearFilter('all');
                    setStatusFilter('all');
                  }}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  Reset
                </button>
                <div className="hidden md:block text-xs text-gray-500">
                  Showing <span className="font-semibold text-gray-900">{filtered.length}</span> record(s)
                </div>
              </div>
            </div>

            <div className="md:hidden mt-3 text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filtered.length}</span> record(s)
            </div>
          </div>
        </div>

        {/* History */}
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Payroll History</h3>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">No payroll records</h3>
                <p className="mt-1 text-sm text-gray-500">No runs were generated for your user yet.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Month
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Base
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Additions
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Deductions
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Net
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 bg-gray-50 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                      {filtered.map((x) => {
                        const r = x.record;
                        const badge = getStatusBadge(r.status);
                        const StatusIcon = badge.icon;
                        const currency = r.payroll_runs?.currency || 'USD';
                        const month = r.payroll_runs?.run_month ? monthKey(r.payroll_runs.run_month) : '-';

                        return (
                          <tr key={r.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="font-medium">{month}</div>
                              <div className="text-xs text-gray-500">
                                {getEmployeeName(r)} • {getOfficeText(r)}
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(r.base_salary, currency)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(x.totals.additionsTotal, currency)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(x.totals.deductionsTotal, currency)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{formatCurrency(r.net_salary, currency)}</td>

                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${badge.cls}`}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {badge.label}
                              </span>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => openDetails(r.id)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
                                  title="View Details"
                                >
                                  <Info className="h-4 w-4" />
                                  <span className="text-sm font-medium">Details</span>
                                </button>

                                <button
                                  onClick={() => downloadPdf(x)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition disabled:opacity-60"
                                  title="Download PDF"
                                  disabled={pdfBusyId === r.id}
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="text-sm font-medium">{pdfBusyId === r.id ? 'Generating...' : 'PDF'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filtered.map((x) => {
                    const r = x.record;
                    const badge = getStatusBadge(r.status);
                    const StatusIcon = badge.icon;
                    const currency = r.payroll_runs?.currency || 'USD';
                    const month = r.payroll_runs?.run_month ? monthKey(r.payroll_runs.run_month) : '-';

                    return (
                      <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{month}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getEmployeeName(r)} • {getOfficeText(r)}
                            </p>
                          </div>

                          <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${badge.cls}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <Box label="Base" value={formatCurrency(r.base_salary, currency)} />
                          <Box label="Net" value={formatCurrency(r.net_salary, currency)} />
                          <Box label="Additions" value={formatCurrency(x.totals.additionsTotal, currency)} />
                          <Box label="Deductions" value={formatCurrency(x.totals.deductionsTotal, currency)} />
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => openDetails(r.id)}
                            className="w-1/2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
                          >
                            <Info className="h-4 w-4" />
                            <span className="text-sm font-medium">Details</span>
                          </button>

                          <button
                            onClick={() => downloadPdf(x)}
                            className="w-1/2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition disabled:opacity-60"
                            disabled={pdfBusyId === r.id}
                          >
                            <Download className="h-4 w-4" />
                            <span className="text-sm font-medium">{pdfBusyId === r.id ? 'Generating...' : 'PDF'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Payslip Details</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {getEmployeeName(selected.record)} • {getOfficeText(selected.record)}
                  </p>
                </div>

                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                  aria-label="Close"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Month</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {selected.record.payroll_runs?.run_month ? monthKey(selected.record.payroll_runs.run_month) : '-'}
                  </p>

                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                        selected.record.status
                      ).cls}`}
                    >
                      {getStatusBadge(selected.record.status).label}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Net Salary</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {formatCurrency(selected.record.net_salary, selected.record.payroll_runs?.currency)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Box label="Base Salary" value={formatCurrency(selected.record.base_salary, selected.record.payroll_runs?.currency)} />
                <Box label="Additions" value={formatCurrency(selected.totals.additionsTotal, selected.record.payroll_runs?.currency)} />
                <Box label="Deductions" value={formatCurrency(selected.totals.deductionsTotal, selected.record.payroll_runs?.currency)} />
                <Box label="Calculated Net" value={formatCurrency(selected.totals.calcNet, selected.record.payroll_runs?.currency)} />
              </div>

              <Section title="Additions Breakdown">
                <BreakdownList
                  items={[...selected.breakdown.additionsItems]}
                  emptyText="No additions found in this run."
                  formatCurrency={(n) => formatCurrency(n, selected.record.payroll_runs?.currency)}
                />
              </Section>

              <Section title="Deductions Breakdown">
                <BreakdownList
                  items={[...selected.breakdown.deductionsItems]}
                  emptyText="No deductions found in this run."
                  formatCurrency={(n) => formatCurrency(n, selected.record.payroll_runs?.currency)}
                />
              </Section>
            </div>

            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex gap-2">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-1/2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition"
              >
                Close
              </button>

              <button
                onClick={() => selected && downloadPdf(selected)}
                className="w-1/2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
                disabled={pdfBusyId === selected.record.id}
              >
                <Download className="h-4 w-4" />
                {pdfBusyId === selected.record.id ? 'Generating...' : 'PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** UI helpers */
function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BreakdownList({
  items,
  emptyText,
  formatCurrency,
}: {
  items: { label: string; amount: number; note?: string }[];
  emptyText: string;
  formatCurrency: (n: number) => string;
}) {
  if (!items.length) return <p className="text-sm text-gray-500">{emptyText}</p>;

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={`${sanitizeFileName(it.label)}-${idx}`} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-700">{it.label}</p>
            {it.note ? <p className="text-xs text-gray-500 mt-0.5">{it.note}</p> : null}
          </div>
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(it.amount)}</p>
        </div>
      ))}
    </div>
  );
}
