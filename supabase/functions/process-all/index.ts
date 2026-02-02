// supabase/functions/process-all/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EmailLog = {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  error?: string | null;
  retry_count?: number | null;
  last_retry?: string | null;
  metadata?: { text?: string; html?: string } | null;
  created_at?: string | null;
};

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM_NAME = Deno.env.get("BREVO_FROM_NAME") ?? "HRMS";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeString(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendViaBrevo(email: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromEmail: string;
}) {
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is missing in Edge Secrets");

  const payload = {
    sender: { email: email.fromEmail, name: BREVO_FROM_NAME },
    to: [{ email: email.to }],
    subject: email.subject,
    textContent: email.text ?? "",
    htmlContent: email.html ?? "",
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message || data?.code || `Brevo error (${res.status})`;
    throw new Error(msg);
  }

  return data; // messageId
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // إعدادات التشغيل
    const BATCH = 50; // عدد الإيميلات بكل دفعة
    const RETRY_LIMIT = 5; // أقصى عدد محاولات
    const ONLY_LAST_24H = false; // خليها true إذا تريد نفس صفحة المونيتور

    // smtp_settings فقط لجلب from_email
    const { data: smtpData, error: smtpError } = await supabase
      .from("smtp_settings")
      .select("from_email")
      .eq("is_active", true)
      .maybeSingle();

    if (smtpError || !smtpData?.from_email) {
      throw new Error("SMTP settings not configured (from_email missing)");
    }

    let query = supabase
      .from("email_logs")
      .select("id, recipient, subject, status, error, retry_count, last_retry, metadata, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH);

    if (ONLY_LAST_24H) {
      const d = new Date();
      d.setHours(d.getHours() - 24);
      query = query.gte("created_at", d.toISOString());
    }

    // تجاهل اللي retry_count واصل الحد
    query = query.or(`retry_count.is.null,retry_count.lt.${RETRY_LIMIT}`);

    const { data: pending, error: eErr } = await query;

    if (eErr) throw new Error(`Failed to fetch pending emails: ${eErr.message}`);

    if (!pending || pending.length === 0) {
      return json({ message: "No pending emails", processed: 0, success: 0, failed: 0, skipped: 0 });
    }

    let success = 0;
    let failed = 0;
    let skipped = 0;

    const failures: Array<{ id: string; recipient: string; error: string }> = [];

    for (const email of pending as EmailLog[]) {
      // تحقق سريع
      const to = safeString(email.recipient).trim();
      const subject = safeString(email.subject).trim();
      const text = safeString(email.metadata?.text ?? "");
      const html = safeString(email.metadata?.html ?? "");

      if (!to || !isEmailLike(to) || !subject) {
        // خلّيه failed مباشرة
        await supabase
          .from("email_logs")
          .update({
            status: "failed",
            error: !to
              ? "Missing recipient"
              : !isEmailLike(to)
              ? "Invalid recipient email"
              : "Missing subject",
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        failed++;
        failures.push({ id: email.id, recipient: to || "(empty)", error: "Invalid email log data" });
        continue;
      }

      // قفل السجل: pending -> processing
      const { data: locked, error: lockErr } = await supabase
        .from("email_logs")
        .update({
          status: "processing",
          last_retry: new Date().toISOString(),
          retry_count: (email.retry_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (lockErr) {
        failed++;
        failures.push({ id: email.id, recipient: to, error: `Lock error: ${lockErr.message}` });
        continue;
      }

      if (!locked) {
        // أحد ثاني سبق وقفلها
        skipped++;
        continue;
      }

      try {
        // إذا النص والـ html فارغين، لا نرسل رسالة فاضية
        const safeText = text || (html ? "" : "Notification from HRMS");
        const safeHtml = html || (text ? "" : "<p>Notification from HRMS</p>");

        await sendViaBrevo({
          to,
          subject,
          text: safeText,
          html: safeHtml,
          fromEmail: smtpData.from_email,
        });

        await supabase
          .from("email_logs")
          .update({
            status: "sent",
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        success++;
      } catch (err: any) {
        const msg = String(err?.message || err);

        await supabase
          .from("email_logs")
          .update({
            status: "failed",
            error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        failed++;
        failures.push({ id: email.id, recipient: to, error: msg });
      }

      // delay بسيط
      await new Promise((r) => setTimeout(r, 80));
    }

    return json({
      message: `Processed ${pending.length} emails`,
      processed: pending.length,
      success,
      failed,
      skipped,
      // نخليها حتى تعرضها بالواجهة (اختياري)
      failures: failures.slice(0, 20),
    });
  } catch (err: any) {
    return json({ error: String(err?.message || err) }, 500);
  }
});
