type LeadHistoryItem = {
  role: "lead" | "assistant";
  content: string;
};

type LeadAIInput = {
  lead: {
    id: string;
    name?: string | null;
    phone?: string | null;
    instagram?: string | null;
    whatsapp?: string | null;
    message?: string | null;
    status?: string | null;
    pipeline_stage?: string | null;
    ai_stage?: string | null;
    ai_history?: LeadHistoryItem[] | null;
  };
  automation?: {
    id?: string;
    name?: string | null;
    business_type?: string | null;
    businessType?: string | null;
    goal?: string | null;
    channel?: string | null;
    config_json?: Record<string, unknown> | null;
    result_json?: Record<string, unknown> | null;
  } | null;
};

export type LeadAIResult = {
  reply: string;
  stage: string;
  status: string;
  nextAction: string;
  language: string;
  confidence: number;
  pipelineStage: string;
};

function detectLanguage(text: string): "pt" | "en" | "es" {
  const value = text.toLowerCase();

  if (
    value.includes("hola") ||
    value.includes("precio") ||
    value.includes("quiero") ||
    value.includes("mañana") ||
    value.includes("gracias") ||
    value.includes("reserva")
  ) {
    return "es";
  }

  if (
    value.includes("hello") ||
    value.includes("price") ||
    value.includes("tomorrow") ||
    value.includes("thanks") ||
    value.includes("book") ||
    value.includes("reservation")
  ) {
    return "en";
  }

  return "pt";
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function getRecordString(
  record: Record<string, unknown> | null | undefined,
  key: string
): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function getBusinessType(
  automation?: LeadAIInput["automation"]
): string {
  return (
    automation?.business_type ||
    automation?.businessType ||
    getRecordString(automation?.config_json, "businessType") ||
    getRecordString(automation?.result_json, "businessType") ||
    "negócio local"
  );
}

function getGoal(automation?: LeadAIInput["automation"]): string {
  return (
    automation?.goal ||
    getRecordString(automation?.config_json, "goal") ||
    getRecordString(automation?.result_json, "goal") ||
    "qualificar a lead, oferecer marcação aqui e dar opção de WhatsApp"
  );
}

function getFallbackResult(language: "pt" | "en" | "es"): LeadAIResult {
  if (language === "en") {
    return {
      reply:
        "Perfect. What service are you looking for? You can also continue here or on WhatsApp.",
      stage: "qualifying",
      status: "active",
      nextAction: "Ask which service the lead wants.",
      language: "en",
      confidence: 0.35,
      pipelineStage: "contacted",
    };
  }

  if (language === "es") {
    return {
      reply:
        "Perfecto. ¿Qué servicio buscas? También podemos seguir aquí o por WhatsApp.",
      stage: "qualifying",
      status: "active",
      nextAction: "Preguntar qué servicio busca.",
      language: "es",
      confidence: 0.35,
      pipelineStage: "contacted",
    };
  }

  return {
    reply:
      "Perfeito. Qual serviço procuras? Também podemos continuar aqui ou no WhatsApp.",
    stage: "qualifying",
    status: "active",
    nextAction: "Perguntar qual serviço a lead procura.",
    language: "pt",
    confidence: 0.35,
    pipelineStage: "contacted",
  };
}

export async function runLeadAI({
  lead,
  automation,
}: LeadAIInput): Promise<LeadAIResult> {
  const message = (lead.message || "").trim();
  const aiHistory = Array.isArray(lead.ai_history) ? lead.ai_history : [];
  const language = detectLanguage(message);

  const businessType = getBusinessType(automation);
  const goal = getGoal(automation);

  const systemPrompt = `
You are an elite sales assistant for a local business.

Rules:
- Reply in the SAME language as the lead.
- Keep replies short, natural and conversion-focused.
- Ask only ONE useful question at a time.
- Your goal is to move the lead toward:
  1) booking here
  2) or continuing on WhatsApp
- If the lead asks for booking, availability, date or time, help directly.
- If the lead chooses WhatsApp, set stage = "whatsapp".
- If the lead confirms the booking, set stage = "booked" and status = "booked".
- If the lead is not interested, rejects, cancels or the conversation is clearly dead, set stage = "lost" and status = "lost".
- Do NOT mention AI.
- Do NOT be robotic.
- You must move the pipeline logically.

Business type: ${businessType}
Goal: ${goal}

Current lead status: ${lead.status || "new"}
Current pipeline stage: ${lead.pipeline_stage || "new"}
Current AI stage: ${lead.ai_stage || "new"}

You must return ONLY valid JSON with this exact shape:
{
  "reply": "string",
  "stage": "new | qualifying | preference | asking_date | asking_time | confirming | whatsapp | booked | lost",
  "status": "active | booked | lost",
  "nextAction": "string",
  "language": "pt | en | es",
  "confidence": 0.0,
  "pipelineStage": "new | contacted | qualified | booked | lost"
}
`;

  const historyText =
    aiHistory.length > 0
      ? JSON.stringify(aiHistory.slice(-20), null, 2)
      : "[]";

  const userPrompt = `
Lead data:
- name: ${lead.name || ""}
- instagram: ${lead.instagram || ""}
- whatsapp: ${lead.whatsapp || ""}
- phone: ${lead.phone || ""}
- latest_message: ${message}
- current_status: ${lead.status || "new"}
- current_pipeline_stage: ${lead.pipeline_stage || "new"}
- current_ai_stage: ${lead.ai_stage || "new"}

Conversation history:
${historyText}
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    const parsed = safeJsonParse<LeadAIResult>(
      content,
      getFallbackResult(language)
    );

    return {
      reply: parsed.reply || getFallbackResult(language).reply,
      stage: parsed.stage || "qualifying",
      status: parsed.status || "active",
      nextAction: parsed.nextAction || "Continuar conversa",
      language: parsed.language || language,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      pipelineStage:
        parsed.pipelineStage ||
        (parsed.status === "booked"
          ? "booked"
          : parsed.status === "lost"
          ? "lost"
          : parsed.stage === "qualifying" ||
            parsed.stage === "preference" ||
            parsed.stage === "asking_date" ||
            parsed.stage === "asking_time" ||
            parsed.stage === "confirming" ||
            parsed.stage === "whatsapp"
          ? "qualified"
          : "contacted"),
    };
  } catch {
    return getFallbackResult(language);
  }
}