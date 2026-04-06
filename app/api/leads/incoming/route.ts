import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

type IncomingLeadBody = {
  automationId?: string | null;
  source?: string | null;
  channel?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  service?: string | null;
  message?: string | null;
  value?: number | null;
  payload?: Record<string, unknown> | null;
};

type AutomationRow = {
  id: string;
  user_id: string;
  name: string | null;
  status: string | null;
  webhook_url: string | null;
  prompt?: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}

async function safeReadJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractExecutionOk(result: unknown, httpOk: boolean): boolean {
  if (!httpOk) return false;

  if (!result) return true;

  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;

    if (typeof obj.ok === "boolean") return obj.ok;

    if (
      typeof obj.webhookResponse === "object" &&
      obj.webhookResponse !== null &&
      typeof (obj.webhookResponse as Record<string, unknown>).ok === "boolean"
    ) {
      return (obj.webhookResponse as Record<string, unknown>).ok as boolean;
    }
  }

  return true;
}

function resolveLeadStatus(result: unknown): string {
  if (typeof result === "object" && result !== null) {
    const obj = result as Record<string, unknown>;

    if (typeof obj.leadStatus === "string" && obj.leadStatus.trim()) {
      return obj.leadStatus.trim().toLowerCase();
    }

    if (typeof obj.status === "string" && obj.status.trim()) {
      return obj.status.trim().toLowerCase();
    }

    if (
      typeof obj.webhookResponse === "object" &&
      obj.webhookResponse !== null
    ) {
      const nested = obj.webhookResponse as Record<string, unknown>;

      if (typeof nested.leadStatus === "string" && nested.leadStatus.trim()) {
        return nested.leadStatus.trim().toLowerCase();
      }

      if (typeof nested.status === "string" && nested.status.trim()) {
        return nested.status.trim().toLowerCase();
      }
    }
  }

  return "contacted";
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as IncomingLeadBody;

    const automationId = normalizeText(body.automationId);
    const source = normalizeText(body.source) ?? "webhook";
    const channel = normalizeText(body.channel) ?? "external";
    const name = normalizeText(body.name);
    const email = normalizeText(body.email);
    const phone = normalizeText(body.phone);
    const instagram = normalizeText(body.instagram);
    const whatsapp = normalizeText(body.whatsapp);
    const service = normalizeText(body.service);
    const message = normalizeText(body.message);
    const value = normalizeNumber(body.value);

    const payload =
      body.payload && typeof body.payload === "object" ? body.payload : body;

    const hasMinimumLeadData =
      !!name || !!email || !!phone || !!instagram || !!whatsapp || !!message;

    if (!hasMinimumLeadData) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Lead inválida. Envia pelo menos um destes campos: name, email, phone, instagram, whatsapp ou message.",
        },
        { status: 400 }
      );
    }

    let selectedAutomation: AutomationRow | null = null;

    if (automationId) {
      const { data: automation, error: automationError } = await supabase
        .from("automations")
        .select("id, user_id, name, status, webhook_url, prompt")
        .eq("id", automationId)
        .eq("user_id", user.id)
        .single();

      if (automationError || !automation) {
        return NextResponse.json(
          { ok: false, error: "Automação não encontrada." },
          { status: 404 }
        );
      }

      selectedAutomation = automation as AutomationRow;
    } else {
      const { data: activeAutomation } = await supabase
        .from("automations")
        .select("id, user_id, name, status, webhook_url, prompt")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeAutomation) {
        selectedAutomation = activeAutomation as AutomationRow;
      }
    }

    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        user_id: user.id,
        automation_id: selectedAutomation?.id ?? automationId ?? null,
        source,
        channel,
        name,
        email,
        phone,
        instagram,
        whatsapp,
        service,
        message,
        status: "new",
        value,
        payload,
      })
      .select("*")
      .single();

    if (insertError || !lead) {
      return NextResponse.json(
        {
          ok: false,
          error: insertError?.message ?? "Erro ao guardar lead.",
        },
        { status: 500 }
      );
    }

    if (!selectedAutomation) {
      return NextResponse.json({
        ok: true,
        message: "Lead recebida com sucesso, mas sem automação ativa para disparar.",
        triggered: false,
        lead,
      });
    }

    const n8nWebhookUrl =
      normalizeText(selectedAutomation.webhook_url) ??
      normalizeText(process.env.N8N_AUTOMATION_WEBHOOK_URL) ??
      normalizeText(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL);

    if (!n8nWebhookUrl) {
      return NextResponse.json({
        ok: true,
        message: "Lead recebida com sucesso, mas sem webhook configurado.",
        triggered: false,
        lead,
      });
    }

    const executionPayload = {
      event: "lead.incoming",
      trigger: "incoming_lead",
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      automation: {
        id: selectedAutomation.id,
        name: selectedAutomation.name,
        status: selectedAutomation.status,
        prompt: selectedAutomation.prompt ?? null,
      },
      lead,
      meta: {
        source,
        channel,
        receivedAt: new Date().toISOString(),
      },
    };

    let executionResult: unknown = null;
    let executionHttpOk = false;

    try {
      const n8nResponse = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(executionPayload),
      });

      executionHttpOk = n8nResponse.ok;
      executionResult = await safeReadJson(n8nResponse);
    } catch (error) {
      await supabase
        .from("leads")
        .update({
          status: "new",
          updated_at: new Date().toISOString(),
          payload: {
            ...(payload ?? {}),
            execution: {
              ok: false,
              webhookUrl: n8nWebhookUrl,
              error: error instanceof Error ? error.message : "Erro ao chamar n8n",
            },
          },
        })
        .eq("id", lead.id)
        .eq("user_id", user.id);

      return NextResponse.json(
        {
          ok: false,
          error: "Lead guardada, mas houve erro ao chamar o n8n.",
          lead,
          triggered: false,
        },
        { status: 500 }
      );
    }

    const executionOk = extractExecutionOk(executionResult, executionHttpOk);
    const nextLeadStatus = executionOk ? resolveLeadStatus(executionResult) : "new";

    const { data: updatedLead, error: updateLeadError } = await supabase
      .from("leads")
      .update({
        status: nextLeadStatus,
        updated_at: new Date().toISOString(),
        payload: {
          ...(payload ?? {}),
          execution: {
            ok: executionOk,
            webhookUrl: n8nWebhookUrl,
            response: executionResult,
          },
        },
      })
      .eq("id", lead.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateLeadError) {
      return NextResponse.json({
        ok: true,
        message: "Lead recebida e automação executada, mas houve erro ao atualizar o pipeline.",
        triggered: executionOk,
        lead,
        executionResult,
      });
    }

    if (!executionOk) {
      return NextResponse.json(
        {
          ok: false,
          error: "Lead guardada, mas a execução da automação falhou.",
          lead: updatedLead,
          triggered: false,
          executionResult,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Lead recebida, automação executada e pipeline atualizado com sucesso.",
      triggered: true,
      lead: updatedLead,
      automation: {
        id: selectedAutomation.id,
        name: selectedAutomation.name,
        status: selectedAutomation.status,
      },
      executionResult,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Erro interno ao processar lead." },
      { status: 500 }
    );
  }
}