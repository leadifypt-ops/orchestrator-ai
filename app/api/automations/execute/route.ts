import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const automationId = body.automationId as string | undefined;

    if (!automationId) {
      return NextResponse.json(
        { error: "automationId em falta." },
        { status: 400 }
      );
    }

    const { data: automation, error: automationError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("user_id", user.id)
      .single();

    if (automationError || !automation) {
      return NextResponse.json(
        { error: "Automação não encontrada." },
        { status: 404 }
      );
    }

    const initialLogs = [
      {
        step: 1,
        message: "Execução iniciada",
        timestamp: new Date().toISOString(),
      },
    ];

    const { data: run, error: createRunError } = await supabase
      .from("automation_runs")
      .insert({
        automation_id: automation.id,
        user_id: user.id,
        status: "running",
        started_at: new Date().toISOString(),
        logs: initialLogs,
        steps: [
          { name: "init", status: "done" },
          { name: "load_automation", status: "running" },
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

    await supabase
      .from("automations")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", automation.id)
      .eq("user_id", user.id);

    const finalLogs = [
      ...initialLogs,
      {
        step: 2,
        message: "Automação carregada com sucesso",
        timestamp: new Date().toISOString(),
      },
      {
        step: 3,
        message: "Configuração validada",
        timestamp: new Date().toISOString(),
      },
      {
        step: 4,
        message: "Execução simulada concluída",
        timestamp: new Date().toISOString(),
      },
    ];

    const durationMs = Date.now() - startedAt;

    const { error: updateRunError } = await supabase
      .from("automation_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        logs: finalLogs,
        duration_ms: durationMs,
        steps: [
          { name: "init", status: "done" },
          { name: "load_automation", status: "done" },
          { name: "validate_config", status: "done" },
          { name: "execute", status: "done" },
        ],
        output: {
          ok: true,
          simulated: true,
          automationName:
            automation.name || automation.project_name || "Automation",
        },
        result: {
          ok: true,
          simulated: true,
        },
      })
      .eq("id", run.id)
      .eq("user_id", user.id);

    if (updateRunError) {
      return NextResponse.json(
        { error: updateRunError.message || "Erro ao atualizar run." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      runId: run.id,
    });
  } catch (error) {
    console.error("EXECUTE_AUTOMATION_ERROR", error);
    return NextResponse.json(
      { error: "Erro interno ao executar automação." },
      { status: 500 }
    );
  }
}