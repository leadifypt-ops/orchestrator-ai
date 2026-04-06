import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runLeadAI } from "@/lib/ai-lead-engine";

type LeadHistoryItem = {
  role: "lead" | "assistant";
  content: string;
};

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { data: automation, error: automationError } = await supabase
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .single();

    if (automationError || !automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    const initialHistory: LeadHistoryItem[] = [];

    if (message) {
      initialHistory.push({
        role: "lead",
        content: String(message),
      });
    }

    const { data: lead, error: leadError } = await supabase
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
        ai_stage: "new",
        ai_status: "active",
        ai_history: initialHistory,
      })
      .select()
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: leadError?.message || "Failed to create lead" },
        { status: 500 }
      );
    }

    const ai = await runLeadAI({
      lead: {
        ...lead,
        ai_history: initialHistory,
      },
      automation,
    });

    const updatedHistory: LeadHistoryItem[] = [
      ...initialHistory,
      {
        role: "assistant",
        content: ai.reply,
      },
    ];

    const mappedLeadStatus =
      ai.status === "booked"
        ? "booked"
        : ai.status === "lost"
        ? "lost"
        : "contacted";

    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({
        ai_reply: ai.reply,
        ai_stage: ai.stage,
        ai_status: ai.status,
        ai_language: ai.language,
        ai_next_action: ai.nextAction,
        ai_confidence: ai.confidence,
        ai_history: updatedHistory,
        status: mappedLeadStatus,
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lead: updatedLead,
      ai: {
        reply: ai.reply,
        stage: ai.stage,
        status: ai.status,
        nextAction: ai.nextAction,
        language: ai.language,
        confidence: ai.confidence,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}