import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runLeadAI } from "@/lib/ai-lead-engine";
import { sendChannelReply } from "@/lib/send-channel-reply";

type LeadHistoryItem = {
  role: "lead" | "assistant";
  content: string;
};

type LeadRow = {
  id: string;
  user_id?: string | null;
  automation_id?: string | null;
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  message?: string | null;
  source?: string | null;
  channel?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  ai_stage?: string | null;
  ai_status?: string | null;
  ai_reply?: string | null;
  ai_language?: string | null;
  ai_next_action?: string | null;
  ai_confidence?: number | null;
  ai_history?: LeadHistoryItem[] | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function normalizeValue(value?: string | null) {
  return (value || "").trim().toLowerCase();
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

    const normalizedInstagram = normalizeValue(instagram);
    const normalizedPhone = normalizeValue(phone);
    const normalizedWhatsapp = normalizeValue(whatsapp);

    let existingLead: LeadRow | null = null;

    if (normalizedInstagram) {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("automation_id", automationId)
        .eq("instagram", instagram)
        .not("status", "in", '("booked","lost")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingLead = (data as LeadRow | null) ?? null;
    }

    if (!existingLead && normalizedPhone) {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("automation_id", automationId)
        .eq("phone", phone)
        .not("status", "in", '("booked","lost")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingLead = (data as LeadRow | null) ?? null;
    }

    if (!existingLead && normalizedWhatsapp) {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("automation_id", automationId)
        .eq("whatsapp", whatsapp)
        .not("status", "in", '("booked","lost")')
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingLead = (data as LeadRow | null) ?? null;
    }

    let lead: LeadRow;

    if (existingLead) {
      const currentHistory: LeadHistoryItem[] = Array.isArray(
        existingLead.ai_history
      )
        ? existingLead.ai_history
        : [];

      const updatedHistory: LeadHistoryItem[] = message
        ? [...currentHistory, { role: "lead", content: String(message) }]
        : currentHistory;

      const { data: updatedLead, error: updateError } = await supabase
        .from("leads")
        .update({
          name: name || existingLead.name,
          phone: phone || existingLead.phone,
          whatsapp:
            whatsapp ||
            phone ||
            existingLead.whatsapp ||
            existingLead.phone ||
            null,
          instagram: instagram || existingLead.instagram,
          source: source || existingLead.source,
          channel: channel || existingLead.channel,
          message: message || existingLead.message,
          ai_history: updatedHistory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id)
        .select()
        .single();

      if (updateError || !updatedLead) {
        return NextResponse.json(
          { error: updateError?.message || "Failed to update lead" },
          { status: 500 }
        );
      }

      lead = updatedLead as LeadRow;
    } else {
      const initialHistory: LeadHistoryItem[] = message
        ? [{ role: "lead", content: String(message) }]
        : [];

      const { data: createdLead, error: createError } = await supabase
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

      if (createError || !createdLead) {
        return NextResponse.json(
          { error: createError?.message || "Failed to create lead" },
          { status: 500 }
        );
      }

      lead = createdLead as LeadRow;
    }

    const historyBeforeAI: LeadHistoryItem[] = Array.isArray(lead.ai_history)
      ? lead.ai_history
      : [];

    const ai = await runLeadAI({
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        instagram: lead.instagram,
        whatsapp: lead.whatsapp || whatsapp || phone || null,
        message: message || lead.message || "",
        status: lead.status,
        pipeline_stage: lead.pipeline_stage,
        ai_stage: lead.ai_stage,
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (finalUpdateError || !finalLead) {
      return NextResponse.json(
        {
          error: finalUpdateError?.message || "Failed to update AI fields",
        },
        { status: 500 }
      );
    }

    await sendChannelReply({
      channel: finalLead.channel,
      instagram: finalLead.instagram,
      phone: finalLead.whatsapp || finalLead.phone,
      message: finalLead.ai_reply || ai.reply,
    });

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