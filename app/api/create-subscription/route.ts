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

    const { data: existingSubscription, error: findError } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json(
        { error: findError.message },
        { status: 500 }
      );
    }

    if (existingSubscription) {
      return NextResponse.json({
        ok: true,
        message: "Subscription já existe.",
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_status: "inactive",
        plan_name: "free",
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Subscription criada com sucesso.",
    });
  } catch (error) {
    console.error("create-subscription error:", error);

    return NextResponse.json(
      { error: "Erro interno ao criar subscription." },
      { status: 500 }
    );
  }
}