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

    if (!automationId) {
      return NextResponse.json(
        { error: "automationId em falta." },
        { status: 400 }
      );
    }

    const { data: automation, error } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("user_id", user.id)
      .single();

    if (error || !automation) {
      return NextResponse.json(
        { error: "Automação não encontrada." },
        { status: 404 }
      );
    }

    const payload = {
      ...automation,
      id: undefined,
      created_at: undefined,
      updated_at: new Date().toISOString(),
      status: "draft",
      deployed: false,
      name: automation.name
        ? `${automation.name} (Cópia)`
        : automation.project_name
        ? `${automation.project_name} (Cópia)`
        : "Automação (Cópia)",
    };

    const { data: duplicated, error: duplicateError } = await supabase
      .from("automations")
      .insert({
        ...payload,
        user_id: user.id,
      })
      .select()
      .single();

    if (duplicateError) {
      return NextResponse.json(
        { error: duplicateError.message || "Erro ao duplicar automação." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      automation: duplicated,
    });
  } catch (error) {
    console.error("DUPLICATE_AUTOMATION_ERROR", error);
    return NextResponse.json(
      { error: "Erro interno ao duplicar automação." },
      { status: 500 }
    );
  }
}