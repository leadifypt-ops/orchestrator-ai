import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

type LeadPayload = {
  name?: string | null;
  phone?: string | null;
  source?: string | null;
  service?: string | null;
  status?: string | null;
  value?: number | string | null;
};

type WebhookOutput = {
  ok?: boolean;
  automation?: string;
  businessType?: string;
  goal?: string;
  channel?: string;
  status?: string;
  nextAction?: string;
  lead?: LeadPayload | null;
  leadName?: string;
  leadPhone?: string;
  leadSource?: string;
  leadService?: string;
  leadStatus?: string;
  leadValue?: number | string;
  [key: string]: unknown;
};

function normalizeLeadValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function extractLeadFromWebhook(output: WebhookOutput): LeadPayload | null {
  const nestedLead = output.lead ?? null;

  const name =
    nestedLead?.name ||
    (typeof output.leadName === "string" ? output.leadName : null);

  const phone =
    nestedLead?.phone ||
    (typeof output.leadPhone === "string" ? output.leadPhone : null);

  const source =
    nestedLead?.source ||
    (typeof output.leadSource === "string" ? output.leadSource : null);

  const service =
    nestedLead?.service ||
    (typeof output.leadService === "string" ? output.leadService : null);

  const status =
    nestedLead?.status ||
    (typeof output.leadStatus === "string" ? output.leadStatus : "new");

  const value =
    nestedLead?.value !== undefined
      ? nestedLead.value
      : output.leadValue !== undefined
        ? output.leadValue
        : 0;

  const hasUsefulLeadData = !!(name || phone || source || service);

  if (!hasUsefulLeadData) {
    return null;
  }

  return {
    name: name || null,
    phone: phone || null,
    source: source || null,
    service: service || null,
    status: status || "new",
    value: normalizeLeadValue(value),
  };
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("authorization");
    const schedulerSecret = process.env.SCHEDULER_SECRET;
    const isSchedulerCall =
      !!schedulerSecret && authHeader === `Bearer ${schedulerSecret}`;

    const serverSupabase = await createServerClient();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Variáveis do Supabase em falta." },
        { status: 500 }
      );
    }

    const adminSupabase = createAdminClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    let userId: string | null = null;

    if (!isSchedulerCall) {
      const {
        data: { user },
        error: userError,
      } = await serverSupabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json(
          { error: "Não autenticado." },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    const body = await req.json();
    const automationId = body.automationId as string | undefined;

    if (!automationId) {
      return NextResponse.json(
        { error: "automationId em falta." },
        { status: 400 }
      );
    }

    const db = isSchedulerCall ? adminSupabase : serverSupabase;

    let automationQuery = db
      .from("automations")
      .select("*")
      .eq("id", automationId);

    if (userId) {
      automationQuery = automationQuery.eq("user_id", userId);
    }

    const { data: automation, error: automationError } =
      await automationQuery.single();

    if (automationError || !automation) {
      return NextResponse.json(
        { error: "Automação não encontrada." },
        { status: 404 }
      );
    }

    const config =
      automation.config ||
      automation.config_json ||
      automation.result_json ||
      automation;

    const initialLogs = [
      {
        step: 1,
        message: "Execução iniciada",
        timestamp: new Date().toISOString(),
      },
      {
        step: 2,
        message: "Automação carregada",
        timestamp: new Date().toISOString(),
      },
    ];

    const { data: run, error: createRunError } = await db
      .from("automation_runs")
      .insert({
        automation_id: automation.id,
        user_id: automation.user_id,
        status: "running",
        started_at: new Date().toISOString(),
        logs: initialLogs,
        steps: [
          { name: "init", status: "done" },
          { name: "load_automation", status: "done" },
          { name: "call_webhook", status: "running" },
        ],
      })
      .select()
      .single();

    if (createRunError || !run) {
      return NextResponse.json(
        { error: createRunError?.message || "Erro ao criar run." },
        { status: 500 }
      );
    }

    await db
      .from("automations")
      .update({
        status: "running",
        updated_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
      })
      .eq("id", automation.id);

    const webhookUrl =
      "https://orchestryai.app.n8n.cloud/webhook/execute-automation";

    let webhookResponseData: WebhookOutput | null = null;
    let webhookStatus = 200;

    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationId: automation.id,
          runId: run.id,
          userId: automation.user_id,
          automationName:
            automation.name || automation.project_name || "Automation",
          prompt: automation.prompt || null,
          config,
        }),
      });

      webhookStatus = webhookResponse.status;

      const rawText = await webhookResponse.text();

      if (rawText.trim()) {
        try {
          webhookResponseData = JSON.parse(rawText) as WebhookOutput;
        } catch {
          webhookResponseData = { raw: rawText };
        }
      } else {
        webhookResponseData = {
          ok: webhookResponse.ok,
        };
      }

      if (!webhookResponse.ok) {
        throw new Error(
          `Webhook respondeu com status ${webhookResponse.status}`
        );
      }
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao chamar webhook.";

      await db
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          error: errorMessage,
          output: {
            webhookStatus,
            webhookResponse: webhookResponseData,
          },
          result: {
            ok: false,
          },
          logs: [
            ...initialLogs,
            {
              step: 3,
              message: "Falha ao chamar webhook",
              timestamp: new Date().toISOString(),
            },
          ],
          steps: [
            { name: "init", status: "done" },
            { name: "load_automation", status: "done" },
            { name: "call_webhook", status: "failed" },
          ],
        })
        .eq("id", run.id);

      await db
        .from("automations")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          last_run_at: new Date().toISOString(),
          last_run_output: {
            ok: false,
            webhookStatus,
            webhookResponse: webhookResponseData,
            error: errorMessage,
          },
          next_action: "Verificar webhook",
        })
        .eq("id", automation.id);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    const durationMs = Date.now() - startedAt;

    const normalizedOutput: WebhookOutput = {
      ok: webhookResponseData?.ok ?? true,
      automation:
        webhookResponseData?.automation ||
        automation.name ||
        automation.project_name ||
        "Automation",
      businessType:
        webhookResponseData?.businessType ||
        automation.business_type ||
        "Business",
      goal: webhookResponseData?.goal || automation.goal || "Executar automação",
      channel: webhookResponseData?.channel || "Webhook",
      status: webhookResponseData?.status || "active",
      nextAction: webhookResponseData?.nextAction || "Deploy automation",
      ...webhookResponseData,
    };

    const extractedLead = extractLeadFromWebhook(normalizedOutput);

    let savedLead: {
      id?: string;
      name?: string | null;
      phone?: string | null;
      source?: string | null;
      service?: string | null;
      status?: string | null;
      value?: number;
    } | null = null;

    if (extractedLead) {
      const { data: createdLead, error: leadError } = await adminSupabase
        .from("leads")
        .insert({
          user_id: automation.user_id,
          automation_id: automation.id,
          name: extractedLead.name || null,
          phone: extractedLead.phone || null,
          source: extractedLead.source || normalizedOutput.channel || null,
          service: extractedLead.service || null,
          status: extractedLead.status || "new",
          value: normalizeLeadValue(extractedLead.value),
          updated_at: new Date().toISOString(),
        })
        .select("id, name, phone, source, service, status, value")
        .single();

      if (leadError) {
        console.error("LEAD_INSERT_ERROR", leadError);
      } else if (createdLead) {
        savedLead = createdLead;
      }
    }

    await db
      .from("automation_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        logs: [
          ...initialLogs,
          {
            step: 3,
            message: "Webhook chamado com sucesso",
            timestamp: new Date().toISOString(),
          },
          ...(savedLead
            ? [
                {
                  step: 4,
                  message: "Lead guardado com sucesso",
                  timestamp: new Date().toISOString(),
                },
              ]
            : []),
          {
            step: savedLead ? 5 : 4,
            message: "Execução concluída",
            timestamp: new Date().toISOString(),
          },
        ],
        steps: [
          { name: "init", status: "done" },
          { name: "load_automation", status: "done" },
          { name: "call_webhook", status: "done" },
          ...(savedLead ? [{ name: "save_lead", status: "done" }] : []),
          { name: "finish", status: "done" },
        ],
        output: {
          ...normalizedOutput,
          savedLead,
        },
        result: {
          ok: true,
          webhookStatus,
          leadSaved: !!savedLead,
        },
      })
      .eq("id", run.id);

    await db
      .from("automations")
      .update({
        status: normalizedOutput.status || "active",
        updated_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
        last_run_output: {
          ...normalizedOutput,
          savedLead,
        },
        next_action: normalizedOutput.nextAction || "Deploy automation",
      })
      .eq("id", automation.id);

    return NextResponse.json({
      ok: true,
      runId: run.id,
      webhookStatus,
      output: {
        ...normalizedOutput,
        savedLead,
      },
    });
  } catch (error) {
    console.error("EXECUTE_AUTOMATION_ERROR", error);

    return NextResponse.json(
      { error: "Erro interno ao executar automação." },
      { status: 500 }
    );
  }
}