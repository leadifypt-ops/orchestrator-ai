import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AutomationRow = {
  id: string;
  user_id: string;
  status?: string | null;
  name?: string | null;
  project_name?: string | null;
};

async function isAuthorized(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.SCHEDULER_SECRET || ""}`;

  if (process.env.SCHEDULER_SECRET && authHeader === expected) {
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

    const { data: automations, error: automationsError } = await supabase
      .from("automations")
      .select("id, user_id, status, name, project_name")
      .eq("status", "active")
      .order("updated_at", { ascending: true });

    if (automationsError) {
      return NextResponse.json(
        { error: automationsError.message || "Erro ao buscar automações." },
        { status: 500 }
      );
    }

    if (!automations || automations.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Nenhuma automação ativa para executar.",
        processed: 0,
        created: 0,
        skipped: 0,
        results: [],
      });
    }

    const results: Array<{
      automationId: string;
      automationName: string;
      action: "created" | "skipped";
      reason: string;
      runId?: string;
    }> = [];

    let created = 0;
    let skipped = 0;

    for (const automation of automations as AutomationRow[]) {
      const automationName =
        automation.name || automation.project_name || "Automação sem nome";

      const { data: existingRun, error: existingRunError } = await supabase
        .from("automation_runs")
        .select("id, status")
        .eq("automation_id", automation.id)
        .eq("user_id", automation.user_id)
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRunError) {
        skipped += 1;

        results.push({
          automationId: automation.id,
          automationName,
          action: "skipped",
          reason:
            existingRunError.message ||
            "Erro ao verificar execução já existente.",
        });

        continue;
      }

      if (existingRun) {
        skipped += 1;

        results.push({
          automationId: automation.id,
          automationName,
          action: "skipped",
          reason: `Já existe uma execução ${existingRun.status} para esta automação.`,
          runId: existingRun.id,
        });

        continue;
      }

      const now = new Date().toISOString();

      const { data: newRun, error: createRunError } = await supabase
        .from("automation_runs")
        .insert({
          automation_id: automation.id,
          user_id: automation.user_id,
          status: "queued",
          started_at: now,
          deployment_id: crypto.randomUUID(),
          logs: [
            {
              step: 1,
              message: "Run criada automaticamente pelo scheduler.",
              timestamp: now,
            },
            {
              step: 2,
              message: "Automação ativa encontrada e colocada na fila.",
              timestamp: now,
            },
          ],
          output: {},
          result: {},
          duration_ms: 0,
        })
        .select("id, status")
        .single();

      if (createRunError || !newRun) {
        skipped += 1;

        results.push({
          automationId: automation.id,
          automationName,
          action: "skipped",
          reason: createRunError?.message || "Erro ao criar run.",
        });

        continue;
      }

      created += 1;

      results.push({
        automationId: automation.id,
        automationName,
        action: "created",
        reason: "Run criada com sucesso.",
        runId: newRun.id,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Scheduler executado com sucesso.",
      processed: automations.length,
      created,
      skipped,
      results,
    });
  } catch (error) {
    console.error("SCHEDULER_ERROR", error);

    const message =
      error instanceof Error ? error.message : "Erro interno no scheduler.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}