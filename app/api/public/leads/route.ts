import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function runLeadAI(message: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are a sales assistant for local businesses.

Your job:
- qualify lead
- ask next question
- move pipeline
- respond short

Return JSON:

{
reply: "",
stage: "",
status: "",
language: ""
}
`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const data = await res.json();

    const text = data?.choices?.[0]?.message?.content || "{}";

    return JSON.parse(text);
  } catch (e) {
    console.log("AI ERROR", e);
    return null;
  }
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

    // RUN AI
    const ai = await runLeadAI(message || "");

    if (ai) {
      await supabase
        .from("leads")
        .update({
          ai_reply: ai.reply,
          ai_stage: ai.stage,
          ai_status: ai.status,
          ai_language: ai.language,
          status: "contacted",
        })
        .eq("id", lead.id);
    }

    return NextResponse.json({
      ok: true,
      lead,
      ai,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}