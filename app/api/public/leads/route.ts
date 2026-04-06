import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runLeadAI } from "@/lib/ai-lead-engine";

type LeadHistoryItem = {
  role: "lead" | "assistant";
  content: string;
};

function normalizeValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function buildLeadIdentity({
  instagram,
  phone,
  name,
}: {
  instagram?: string | null;
  phone?: string | null;
  name?: string | null;
}) {
  return {
    instagram: normalizeValue(instagram),
    phone: normalizeValue(phone),
    name: normalizeValue(name),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      secret,
      automationId,
      name,
      phone,
      instagram,
      whatsapp,
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

    const identity = buildLeadIdentity({ instagram, phone, name });

    let existingLead = null;

    if (identity.instagram || identity.phone) {
      let query = supabase
        .from("leads")
        .select("*")
        .eq("automation_id", automationId)
        .not("status", "in", '("booked","lost")')
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: recentLeads } = await query;

      if (recentLeads && recentLeads.length > 0) {
        existingLead =
          recentLeads.find((lead) => {
            const leadInstagram = normalizeValue(lead.instagram);
            const leadPhone = normalizeValue(lead.phone);

            return (
              (identity.instagram && leadInstagram === identity.instagram) ||
              (identity.phone && leadPhone === identity.phone)
            );
          }) || null;
      }
    }

    let lead = existingLead;

    if (!lead) {
      const initialHistory: LeadHistoryItem[] = message
        ? [{ role: "lead", content: String(message) }]
        : [];

      const { data: insertedLead, error: insertError } = await supabase
        .from("leads")
        .insert({
          user_id: automation.user_id,
          automation_id: automationId,
          name,
          phone,
          whatsapp: whatsapp || phone || null,
          instagram,
          message,
          source,
          channel,
          status: "new",
          pipeline_stage: "new",
          ai_stage: "new",
          ai_status: "active",
          ai_history: initialHistory,
        })
        .select()
        .single();

      if (insertError || !insertedLead) {
        return NextResponse.json(
          { error: insertError?.message || "Failed to create lead" },
          { status: 500 }
        );
      }

      lead = insertedLead;
    } else {
      const currentHistory: LeadHistoryItem[] = Array.isArray(lead.ai_history)
        ? lead.ai_history
        : [];

      const updatedHistory: LeadHistoryItem[] = message
        ? [...currentHistory, { role: "lead", content: String(message) }]
        : currentHistory;

      const { data: updatedLead, error: updateLeadError } = await supabase
        .from("leads")
        .update({
          name: name || lead.name,
          phone: phone || lead.phone,
          whatsapp: whatsapp || phone || lead.whatsapp || lead.phone || null,
          instagram: instagram || lead.instagram,
          source: source || lead.source,
          channel: channel || lead.channel,
          message: message || lead.message,
          ai_history: updatedHistory,
        })
        .eq("id", lead.id)
        .select()
        .single();

      if (updateLeadError || !updatedLead) {
        return NextResponse.json(
          { error: updateLeadError?.message || "Failed to update lead" },
          { status: 500 }
        );
      }

      lead = updatedLead;
    }

    const historyBeforeAI: LeadHistoryItem[] = Array.isArray(lead.ai_history)
      ? lead.ai_history
      : [];

    const ai = await runLeadAI({
      lead: {
        ...lead,
        whatsapp: lead.whatsapp || whatsapp || phone || null,
        message: message || lead.message || "",
        ai_history: historyBeforeAI,
      },
      automation,
    });

    const updatedHistoryAfterAI: LeadHistoryItem[] = [
      ...historyBeforeAI,
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

    const mappedPipelineStage =
      ai.pipelineStage ||
      (ai.status === "booked"
        ? "booked"
        : ai.status === "lost"
        ? "lost"
        : ai.stage === "qualifying" ||
          ai.stage === "preference" ||
          ai.stage === "asking_date" ||
          ai.stage === "asking_time" ||
          ai.stage === "confirming" ||
          ai.stage === "whatsapp"
        ? "qualified"
        : "contacted");

    const { data: finalLead, error: finalUpdateError } = await supabase
      .from("leads")
      .update({
        ai_reply: ai.reply,
        ai_stage: ai.stage,
        ai_status: ai.status,
        ai_language: ai.language,
        ai_next_action: ai.nextAction,
        ai_confidence: ai.confidence,
        ai_history: updatedHistoryAfterAI,
        status: mappedLeadStatus,
        pipeline_stage: mappedPipelineStage,
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (finalUpdateError || !finalLead) {
      return NextResponse.json(
        { error: finalUpdateError?.message || "Failed to update AI fields" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      lead: finalLead,
      ai: {
        reply: ai.reply,
        stage: ai.stage,
        status: ai.status,
        nextAction: ai.nextAction,
        language: ai.language,
        confidence: ai.confidence,
        pipelineStage: mappedPipelineStage,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 }
    );
  }
}