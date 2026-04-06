import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, automation } = body;

    if (!prompt || !automation) {
      return NextResponse.json(
        { error: "Prompt ou automação em falta." },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Token de autenticação em falta." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Utilizador não autenticado." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("automations")
      .insert({
        user_id: user.id,
        project_name:
          automation.projectName || automation.project_name || "Sem nome",
        business_type:
          automation.businessType || automation.business_type || null,
        goal: automation.goal || null,
        prompt,
        config: automation,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message || "Erro ao guardar automação.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      automation: data,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao guardar automação." },
      { status: 500 }
    );
  }
}