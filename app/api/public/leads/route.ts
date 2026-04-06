import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type LeadPayload = {
  secret?: string | null;
  automationId?: string | null;
  name?: string | null;
  phone?: string | null;
  instagram?: string | null;
  source?: string | null;
  channel?: string | null;
  message?: string | null;
  value?: string | number | null;
};

async function processLead(payload: LeadPayload) {
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

  let response: Response | null = null;
  let executionResult: any = null;

  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(executionPayload),
    });

    const text = await response.text();

    try {
      executionResult = text ? JSON.parse(text) : { ok: true };
    } catch {
      executionResult = {
        ok: response.ok,
        raw: text,
      };
    }
  } catch (error) {
    executionResult = {
      ok: false,
      error: "Webhook request failed",
    };
  }

  const nextStatus =
    executionResult?.leadStatus ||
    executionResult?.status ||
    (response?.ok ? "contacted" : "new");

  const { data: updatedLead, error: updateError } = await supabase
    .from("leads")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .select()
    .single();

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      triggered: true,
      lead: updatedLead || lead,
      executionResult,
      webhookOk: response?.ok ?? false,
      updateError: updateError?.message || null,
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await processLead(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Internal error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
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
    return NextResponse.json(
      {
        error: "Internal error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}