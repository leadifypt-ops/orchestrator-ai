import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const automationId = body?.automationId as string | undefined;
    const active = body?.active as boolean | undefined;

    if (!automationId || typeof active !== "boolean") {
      return NextResponse.json(
        { error: "automationId e active são obrigatórios." },
        { status: 400 }
      );
    }

    const { data: automation, error: automationError } = await supabase
      .from("automations")
      .select("id, user_id, status")
      .eq("id", automationId)
      .eq("user_id", user.id)
      .single();

    if (automationError || !automation) {
      return NextResponse.json(
        { error: "Automação não encontrada." },
        { status: 404 }
      );
    }

    const newStatus = active ? "active" : "draft";

    const { data: updatedAutomation, error: updateError } = await supabase
      .from("automations")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", automationId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Erro ao atualizar automação." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: active
        ? "Automação ativada com sucesso."
        : "Automação desativada com sucesso.",
      automation: updatedAutomation,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro interno no deploy.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}