import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RunRow = {
  id: string;
  automation_id: string;
  user_id: string;
  status?: string | null;
  logs?: unknown;
};

type AutomationRow = {
  id: string;
  user_id: string;
  name?: string | null;
  project_name?: string | null;
  prompt?: string | null;
  status?: string | null;
  config_json?: Record<string, unknown> | null;
  result_json?: Record<string, unknown> | null;
};

function normalizeLogs(logs: unknown) {
  return Array.isArray(logs) ? logs : [];
}

function getRunnerSecret() {
  return (
    process.env.RUNNER_SECRET ||
    process.env.SCHEDULER_SECRET ||
    process.env.DISPATCH_SECRET ||
    ""
  );
}

async function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const secret = getRunnerSecret();
  const expected = `Bearer ${secret}`;

  if (secret && authHeader === expected) {
    return true;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return !!user;
}

export async function POST(req: NextRequest) {
  try {
    const authorized = await isAuthorized(req);

    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: queuedRun, error: queuedRunError } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queuedRunError) {
      return NextResponse.json(
        { error: queuedRunError.message || "Erro ao buscar run queued." },
        { status: 500 }
      );
    }

    if (!queuedRun) {
      return NextResponse.json({
        ok: true,
        message: "Nenhuma run queued encontrada.",
        processed: 0,
      });
    }

    const run = queuedRun as RunRow;
    const startedAt = new Date().toISOString();
    const baseLogs = normalizeLogs(run.logs);

    const runningLogs = [
      ...baseLogs,
      {
        step: 3,
        message: "Runner encontrou a run e iniciou execução.",
        timestamp: startedAt,
      },
    ];

    const { error: setRunningError } = await supabase
      .from("automation_runs")
      .update({
        status: "running",
        started_at: startedAt,
        logs: runningLogs,
      })
      .eq("id", run.id)
      .eq("status", "queued");

    if (setRunningError) {
      return NextResponse.json(
        { error: setRunningError.message || "Erro ao mudar run para running." },
        { status: 500 }
      );
    }

    const { data: automation, error: automationError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", run.automation_id)
      .eq("user_id", run.user_id)
      .single();

    if (automationError || !automation) {
      const failedAt = new Date().toISOString();

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: failedAt,
          error: "Automação não encontrada.",
          logs: [
            ...runningLogs,
            {
              step: 4,
              message: "Falha: automação não encontrada.",
              timestamp: failedAt,
            },
          ],
          duration_ms: 0,
        })
        .eq("id", run.id);

      return NextResponse.json(
        { error: "Automação não encontrada para esta run." },
        { status: 404 }
      );
    }

    const automationRow = automation as AutomationRow;
    const automationStatus = (automationRow.status || "").toLowerCase();

    if (automationStatus !== "active") {
      const skippedAt = new Date().toISOString();

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: skippedAt,
          error: "Automação não está active.",
          logs: [
            ...runningLogs,
            {
              step: 4,
              message: `Falha: automação está com status "${automationRow.status || "draft"}".`,
              timestamp: skippedAt,
            },
          ],
          result: {
            ok: false,
            reason: "automation_not_active",
          },
          duration_ms: 0,
        })
        .eq("id", run.id);

      return NextResponse.json(
        { error: "A automação desta run já não está active." },
        { status: 400 }
      );
    }

    const config = automationRow.config_json || automationRow.result_json || {};

    const webhookUrl =
      process.env.N8N_AUTOMATION_WEBHOOK_URL ||
      process.env.AUTOMATION_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ||
      "";

    if (!webhookUrl) {
      const failedAt = new Date().toISOString();

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: failedAt,
          error: "Webhook URL não configurada.",
          logs: [
            ...runningLogs,
            {
              step: 4,
              message: "Falha: webhook URL não configurada.",
              timestamp: failedAt,
            },
          ],
          result: {
            ok: false,
            reason: "missing_webhook_url",
          },
          duration_ms: 0,
        })
        .eq("id", run.id);

      return NextResponse.json(
        { error: "Webhook URL não configurada no .env.local." },
        { status: 500 }
      );
    }

    const beforeWebhookAt = new Date().toISOString();
    const runLogs = [
      ...runningLogs,
      {
        step: 4,
        message: "Payload preparado para envio ao webhook.",
        timestamp: beforeWebhookAt,
      },
    ];

    await supabase
      .from("automation_runs")
      .update({
        logs: runLogs,
      })
      .eq("id", run.id);

    const payload = {
      runId: run.id,
      automationId: automationRow.id,
      userId: automationRow.user_id,
      automationName:
        automationRow.name || automationRow.project_name || "Automação",
      prompt: automationRow.prompt || "",
      config,
      triggeredBy: "runner",
      triggeredAt: new Date().toISOString(),
      runtime: {
        engine: "Execution Engine V2",
        mode: "continuous",
      },
    };

    const execStartedMs = Date.now();
    let webhookResponseStatus = 0;
    let webhookResponseBody: unknown = null;

    try {
      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      webhookResponseStatus = webhookRes.status;

      const text = await webhookRes.text();

      try {
        webhookResponseBody = text ? JSON.parse(text) : {};
      } catch {
        webhookResponseBody = text || {};
      }

      if (!webhookRes.ok) {
        const failedAt = new Date().toISOString();

        await supabase
          .from("automation_runs")
          .update({
            status: "failed",
            finished_at: failedAt,
            error: `Webhook respondeu com status ${webhookRes.status}.`,
            logs: [
              ...runLogs,
              {
                step: 5,
                message: `Falha: webhook respondeu com status ${webhookRes.status}.`,
                timestamp: failedAt,
              },
            ],
            output: {
              webhookStatus: webhookRes.status,
              webhookResponse: webhookResponseBody,
            },
            result: {
              ok: false,
              webhookStatus: webhookRes.status,
            },
            duration_ms: Date.now() - execStartedMs,
          })
          .eq("id", run.id);

        return NextResponse.json(
          { error: `Webhook respondeu com status ${webhookRes.status}.` },
          { status: 500 }
        );
      }

      const completedAt = new Date().toISOString();

      await supabase
        .from("automation_runs")
        .update({
          status: "completed",
          finished_at: completedAt,
          logs: [
            ...runLogs,
            {
              step: 5,
              message: "Webhook executado com sucesso.",
              timestamp: completedAt,
            },
          ],
          output: {
            webhookStatus: webhookRes.status,
            webhookResponse: webhookResponseBody,
          },
          result: {
            ok: true,
            webhookStatus: webhookRes.status,
            response: webhookResponseBody,
          },
          duration_ms: Date.now() - execStartedMs,
        })
        .eq("id", run.id);

      return NextResponse.json({
        ok: true,
        runId: run.id,
        automationId: automationRow.id,
        status: "completed",
        webhookStatus: webhookResponseStatus,
        output: webhookResponseBody,
      });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro ao chamar webhook de execução.";

      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: failedAt,
          error: errorMessage,
          logs: [
            ...runLogs,
            {
              step: 5,
              message: "Falha ao chamar webhook de execução.",
              timestamp: failedAt,
            },
          ],
          output: {
            webhookStatus: webhookResponseStatus,
            webhookResponse: webhookResponseBody,
          },
          result: {
            ok: false,
          },
          duration_ms: Date.now() - execStartedMs,
        })
        .eq("id", run.id);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error("RUNNER_ERROR", error);

    const message =
      error instanceof Error ? error.message : "Erro interno no runner.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}