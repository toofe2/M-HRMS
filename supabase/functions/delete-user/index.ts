// supabase/functions/delete-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-target-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(payload: unknown) {
  // ✅ 200 دائمًا حتى ما يصير non-2xx
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function readJsonBodySafely(req: Request): Promise<any> {
  // ✅ اقرأ النص مرة وحدة، لأن body stream ينقري مرة وحدة فقط
  try {
    const raw = await req.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return respond({ ok: false, status: 405, error: "Method not allowed" });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return respond({
        ok: false,
        status: 500,
        error: "Missing environment variables",
        details: {
          hasUrl: Boolean(SUPABASE_URL),
          hasAnon: Boolean(SUPABASE_ANON_KEY),
          hasServiceRole: Boolean(SERVICE_ROLE_KEY),
        },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return respond({ ok: false, status: 401, error: "Unauthorized", details: "Missing Authorization header" });
    }

    // caller client
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    const caller = userData?.user;

    if (userErr || !caller) {
      return respond({ ok: false, status: 401, error: "Unauthorized", details: userErr?.message ?? "No user" });
    }

    // ✅ 1) اقرأ target_user_id من Query Param
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("target_user_id") ?? url.searchParams.get("id") ?? undefined;

    // ✅ 2) اقرأ من Header (احتياط)
    const fromHeader = req.headers.get("x-target-user-id") ?? undefined;

    // ✅ 3) اقرأ من Body (إذا وصل)
    const body = await readJsonBodySafely(req);
    const fromBody: string | undefined =
      body?.target_user_id ?? body?.targetUserId ?? body?.user_id ?? body?.id;

    const target_user_id = fromQuery || fromHeader || fromBody;

    if (!target_user_id) {
      return respond({
        ok: false,
        status: 400,
        error: "Missing target_user_id",
        details: {
          receivedKeys: body ? Object.keys(body) : [],
          queryHasId: Boolean(fromQuery),
          headerHasId: Boolean(fromHeader),
        },
      });
    }

    if (!isValidUuid(target_user_id)) {
      return respond({ ok: false, status: 400, error: "Invalid target_user_id", details: "Not a valid UUID" });
    }

    if (target_user_id === caller.id) {
      return respond({ ok: false, status: 400, error: "You cannot delete your own account" });
    }

    // service role
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [profileRes, adminRoleRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("is_admin").eq("id", caller.id).maybeSingle(),
      supabaseAdmin.from("admin_roles").select("user_id").eq("user_id", caller.id).maybeSingle(),
    ]);

    const isAdmin = Boolean(profileRes.data?.is_admin) || Boolean(adminRoleRes.data?.user_id);
    if (!isAdmin) {
      return respond({
        ok: false,
        status: 403,
        error: "Forbidden",
        details: {
          viaProfiles: Boolean(profileRes.data?.is_admin),
          viaAdminRoles: Boolean(adminRoleRes.data?.user_id),
        },
      });
    }

    // 1) cleanup
    const { error: rpcErr } = await supabaseAdmin.rpc("rpc_delete_user", { target_user_id });
    if (rpcErr) {
      return respond({ ok: false, status: 400, error: "RPC failed", details: rpcErr.message });
    }

    // 2) delete auth user
    const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
    if (authDeleteErr) {
      return respond({ ok: false, status: 400, error: "Failed to delete auth user", details: authDeleteErr.message });
    }

    return respond({ ok: true });
  } catch (e) {
    return respond({ ok: false, status: 500, error: "Server error", details: String(e) });
  }
});
