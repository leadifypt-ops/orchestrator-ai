import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
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
    const name = body.name as string | undefined;
    const prompt = body.prompt as string | undefined;
    const webhook_url = body.webhook_url as string | undefined;
    const config_json = body.config_json;

    if (!automationId) {
      return NextResponse.json(
        { error: "automationId em falta." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof name === "string") updatePayload.name = name;
    if (typeof prompt === "string") updatePayload.prompt = prompt;
    if (typeof webhook_url === "string") updatePayload.webhook_url = webhook_url;
    if (config_json !== undefined) updatePayload.config_json = config_json;

    const { data, error } = await supabase
      .from("automations")
      .update(updatePayload)
      .eq("id", automationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao atualizar automação." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      automation: data,
    });
  } catch (error) {
    console.error("UPDATE_AUTOMATION_ERROR", error);

    return NextResponse.json(
      { error: "Erro interno ao atualizar automação." },
      { status: 500 }
    );
  }
}