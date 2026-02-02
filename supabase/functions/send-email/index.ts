import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /* ===============================
       1) قراءة الـ body بشكل صحيح
    =============================== */
    const body = await req.json();

    const data = body?.data ?? {};
    const recipient = data.recipient;
    const subject = data.subject || "Notification";
    const text = data.text || "You have a new notification";

    if (!recipient || typeof recipient !== "string") {
      throw new Error("Recipient email is required");
    }

    /* ===============================
       2) جلب Brevo API Key
    =============================== */
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is missing");
    }

    const fromName = Deno.env.get("BREVO_FROM_NAME") || "HRMS";
    const fromEmail = "no-reply@yourdomain.com"; 
    // ⚠️ غيّرها لاحقًا لدومينك الحقيقي إذا تحب

    /* ===============================
       3) إرسال الإيميل عبر Brevo
    =============================== */
    const brevoResponse = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoApiKey,
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: fromName,
            email: fromEmail,
          },
          to: [
            {
              email: recipient,
            },
          ],
          subject: subject,
          textContent: text,
        }),
      }
    );

    const brevoResultText = await brevoResponse.text();

    if (!brevoResponse.ok) {
      throw new Error(
        `Brevo error (${brevoResponse.status}): ${brevoResultText}`
      );
    }

    /* ===============================
       4) Response ناجح
    =============================== */
    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        brevo: brevoResultText,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("SEND EMAIL ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(error?.message || error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
