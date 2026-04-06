import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId em falta." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_status: "active",
        plan_name: "monthly",
      })
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Plano ativado com sucesso.",
    });
  } catch (error) {
    console.error("activate-plan error:", error);

    return NextResponse.json(
      { error: "Erro interno ao ativar plano." },
      { status: 500 }
    );
  }
}