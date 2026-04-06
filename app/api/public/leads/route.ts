import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    console.log("PUBLIC LEADS ROUTE START");

    const body = await req.json();

    console.log("BODY RECEBIDO:", body);

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
    } = body;

    const expectedSecret =
      process.env.LEADS_WEBHOOK_SECRET ||
      process.env.RUNNER_SECRET ||
      process.env.DISPATCH_SECRET;

    console.log("EXPECTED SECRET:", expectedSecret);
    console.log("SECRET RECEBIDO:", secret);

    if (!expectedSecret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("SUPABASE URL EXISTS:", !!supabaseUrl);
    console.log("SERVICE ROLE EXISTS:", !!serviceRoleKey);

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase admin envs" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: automationError.message || "Erro ao procurar automação" },
        { status: 500 }
      );
    }

    if (!automation) {
      return NextResponse.json(
        { error: "No automation found" },
        { status: 404 }
      );
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
      return NextResponse.json(
        { error: insertError?.message || "Insert failed" },
        { status: 500 }
      );
    }

    const webhookUrl =
      automation.webhook_url ||
      process.env.N8N_AUTOMATION_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    console.log("WEBHOOK URL:", webhookUrl);

    if (!webhookUrl) {
      return NextResponse.json({
        ok: true,
        triggered: false,
        lead,
        message: "Lead criada sem webhook configurado",
      });
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

    return NextResponse.json({
      ok: true,
      triggered: true,
      lead: updatedLead || lead,
      executionResult,
    });
  } catch (err) {
    console.log("PUBLIC LEADS ERROR:", err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}