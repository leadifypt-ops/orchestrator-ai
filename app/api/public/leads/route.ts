import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

async function processLead(payload: {
  secret?: string | null;
  automationId?: string | null;
  name?: string | null;
  phone?: string | null;
  instagram?: string | null;
  source?: string | null;
  channel?: string | null;
  message?: string | null;
  value?: string | number | null;
}) {
  const {
    secret,
    automationId,
    name,
    phone,
    instagram,
    source,
    channel,
    message,
    value,
  } = payload;

  const expectedSecret =
    process.env.LEADS_WEBHOOK_SECRET ||
    process.env.RUNNER_SECRET ||
    process.env.DISPATCH_SECRET;

  console.log("EXPECTED SECRET:", expectedSecret);
  console.log("SECRET RECEBIDO:", secret);

  if (!expectedSecret) {
    return {
      ok: false,
      status: 500,
      body: { error: "Webhook secret not configured" },
    };
  }

  if (secret !== expectedSecret) {
    return {
      ok: false,
      status: 401,
      body: { error: "Unauthorized" },
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("SUPABASE URL EXISTS:", !!supabaseUrl);
  console.log("SERVICE ROLE EXISTS:", !!serviceRoleKey);

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      ok: false,
      status: 500,
      body: { error: "Missing Supabase admin envs" },
    };
  }

  const supabase = createAdminClient(supabaseUrl, serviceRoleKey);

  let automation: any = null;
  let automationError: any = null;

  if (automationId) {
    const result = await supabase
      .from("automations")
      .select("id, user_id, name, status, webhook_url, prompt, created_at")
      .eq("id", automationId)
      .maybeSingle();

    automation = result.data;
    automationError = result.error;
  }

  if (!automation) {
    const result = await supabase
      .from("automations")
      .select("id, user_id, name, status, webhook_url, prompt, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    automation = result.data;
    automationError = result.error;
  }

  if (!automation) {
    const result = await supabase
      .from("automations")
      .select("id, user_id, name, status, webhook_url, prompt, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    automation = result.data;
    automationError = result.error;
  }

  console.log("AUTOMATION FINAL:", automation, automationError);

  if (automationError) {
    return {
      ok: false,
      status: 500,
      body: { error: automationError.message || "Erro ao procurar automação" },
    };
  }

  if (!automation) {
    return {
      ok: false,
      status: 404,
      body: { error: "No automation found" },
    };
  }

  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      name: name || "Lead Instagram",
      phone: phone || null,
      instagram: instagram || null,
      source: source || "manychat",
      channel: channel || "instagram",
      message: message || null,
      value: value || null,
      status: "new",
    })
    .select()
    .single();

  console.log("LEAD CRIADA:", lead, insertError);

  if (insertError || !lead) {
    return {
      ok: false,
      status: 500,
      body: { error: insertError?.message || "Insert failed" },
    };
  }

  const webhookUrl =
    automation.webhook_url ||
    process.env.N8N_AUTOMATION_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

  console.log("WEBHOOK URL:", webhookUrl);

  if (!webhookUrl) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        triggered: false,
        lead,
        message: "Lead criada sem webhook configurado",
      },
    };
  }

  const executionPayload = {
    event: "lead.incoming",
    trigger: "instagram_manychat",
    automation: {
      id: automation.id,
      name: automation.name,
      status: automation.status,
      prompt: automation.prompt,
    },
    lead,
    meta: {
      source: source || "manychat",
      channel: channel || "instagram",
      receivedAt: new Date().toISOString(),
    },
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(executionPayload),
  });

  const executionResult = await response.json();

  console.log("N8N RESPONSE:", executionResult);

  const nextStatus =
    executionResult?.leadStatus ||
    executionResult?.status ||
    "contacted";

  const { data: updatedLead, error: updateError } = await supabase
    .from("leads")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .select()
    .single();

  console.log("UPDATED LEAD:", updatedLead, updateError);

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      triggered: true,
      lead: updatedLead || lead,
      executionResult,
    },
  };
}

export async function POST(req: Request) {
  try {
    console.log("PUBLIC LEADS ROUTE START [POST]");

    const body = await req.json();

    console.log("BODY RECEBIDO:", body);

    const result = await processLead(body);

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.log("PUBLIC LEADS ERROR [POST]:", err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    console.log("PUBLIC LEADS ROUTE START [GET]");

    const { searchParams } = new URL(req.url);

    const secret = searchParams.get("secret");
    const automationId = searchParams.get("automationId");
    const name = searchParams.get("name");
    const phone = searchParams.get("phone");
    const instagram = searchParams.get("instagram");
    const source = searchParams.get("source");
    const channel = searchParams.get("channel");
    const message = searchParams.get("message");
    const value = searchParams.get("value");
    const redirect = searchParams.get("redirect");

    const result = await processLead({
      secret,
      automationId,
      name,
      phone,
      instagram,
      source,
      channel,
      message,
      value,
    });

    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }

    if (redirect) {
      return NextResponse.redirect(redirect);
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.log("PUBLIC LEADS ERROR [GET]:", err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}