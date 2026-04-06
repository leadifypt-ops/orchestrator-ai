import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      secret,
      automationId,
      name,
      phone,
      instagram,
      message,
      source,
      channel,
    } = body;

    if (secret !== "autoforge-secret") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!automationId) {
      return NextResponse.json(
        { error: "Missing automationId" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: automation } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .single();

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        user_id: automation.user_id,
        automation_id: automationId,
        name,
        phone,
        instagram,
        message,
        source,
        channel,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lead,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}