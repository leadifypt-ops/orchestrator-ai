type LeadAIInput = {
  lead: {
    id: string;
    name?: string | null;
    phone?: string | null;
    instagram?: string | null;
    message?: string | null;
    status?: string | null;
    ai_stage?: string | null;
    ai_history?: Array<{ role: string; content: string }> | null;
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

type LeadAIResult = {
  reply: string;
  stage:
    | "new"
    | "qualifying"
    | "preference"
    | "asking_date"
    | "asking_time"
    | "confirming"
    | "whatsapp"
    | "booked"
    | "lost";
  status: "active" | "booked" | "lost";
  nextAction: string;
  language: string;
  confidence: number;
};

function detectLanguage(text: string) {
  const value = text.toLowerCase();

  if (
    value.includes("hola") ||
    value.includes("precio") ||
    value.includes("quiero") ||
    value.includes("mañana") ||
    value.includes("gracias")
  ) {
    return "es";
  }

  if (
    value.includes("hello") ||
    value.includes("price") ||
    value.includes("tomorrow") ||
    value.includes("thanks") ||
    value.includes("book")
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

export async function runLeadAI({
  lead,
  automation,
}: LeadAIInput): Promise<LeadAIResult> {
  const message = (lead.message || "").trim();
  const aiHistory = Array.isArray(lead.ai_history) ? lead.ai_history : [];
  const language = detectLanguage(message);

  const businessType =
    automation?.business_type ||
    automation?.businessType ||
    (automation?.config_json as Record<string, unknown> | null)?.businessType ||
    (automation?.result_json as Record<string, unknown> | null)?.businessType ||
    "negócio local";

  const goal =
    automation?.goal ||
    (automation?.config_json as Record<string, unknown> | null)?.goal ||
    (automation?.result_json as Record<string, unknown> | null)?.goal ||
    "qualificar a lead, oferecer marcação e dar opção de WhatsApp";

  const systemPrompt = `
You are an AI sales assistant for a local business.

Your job:
- reply in the SAME language as the lead
- qualify the lead
- keep the conversation natural and short
- ask only one useful question at a time
- offer 2 paths when appropriate:
  1) continue booking here
  2) continue on WhatsApp
- move toward BOOKED or LOST
- never sound robotic
- never mention that you are an AI
- if the lead asks for price, service, availability or booking, help directly
- if there is not enough information, ask the next best short question
- if the lead wants WhatsApp, set stage = "whatsapp"
- if the lead confirms a booking, set stage = "booked" and status = "booked"
- if the lead clearly rejects, stops, or is not interested, set stage = "lost" and status = "lost"

Business type: ${businessType}
Goal: ${goal}

Current AI stage: ${lead.ai_stage || "new"}

Return ONLY valid JSON with this exact shape:
{
  "reply": "string",
  "stage": "new | qualifying | preference | asking_date | asking_time | confirming | whatsapp | booked | lost",
  "status": "active | booked | lost",
  "nextAction": "string",
  "language": "pt | en | es",
  "confidence": 0.0
}
`;

  const historyText =
    aiHistory.length > 0
      ? JSON.stringify(aiHistory.slice(-10), null, 2)
      : "[]";

  const userPrompt = `
Lead data:
- name: ${lead.name || ""}
- instagram: ${lead.instagram || ""}
- phone: ${lead.phone || ""}
- latest_message: ${message}
- current_status: ${lead.status || "new"}

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
        temperature: 0.4,
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

    const parsed = safeJsonParse<LeadAIResult>(content, {
      reply:
        language === "en"
          ? "Thanks. Can you tell me what service you want?"
          : language === "es"
          ? "Perfecto. ¿Qué servicio buscas?"
          : "Perfeito. Qual serviço procuras?",
      stage: "qualifying",
      status: "active",
      nextAction:
        language === "en"
          ? "Ask which service the lead wants."
          : language === "es"
          ? "Preguntar qué servicio busca."
          : "Perguntar qual serviço a lead procura.",
      language,
      confidence: 0.5,
    });

    return {
      reply: parsed.reply || "Perfeito. Qual serviço procuras?",
      stage: parsed.stage || "qualifying",
      status: parsed.status || "active",
      nextAction: parsed.nextAction || "Continuar conversa",
      language: parsed.language || language,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    if (language === "en") {
      return {
        reply: "Thanks. What service are you looking for? You can also continue here or on WhatsApp.",
        stage: "qualifying",
        status: "active",
        nextAction: "Ask which service the lead wants.",
        language: "en",
        confidence: 0.35,
      };
    }

    if (language === "es") {
      return {
        reply: "Perfecto. ¿Qué servicio buscas? También podemos seguir aquí o por WhatsApp.",
        stage: "qualifying",
        status: "active",
        nextAction: "Preguntar qué servicio busca.",
        language: "es",
        confidence: 0.35,
      };
    }

    return {
      reply: "Perfeito. Qual serviço procuras? Também podemos continuar aqui ou no WhatsApp.",
      stage: "qualifying",
      status: "active",
      nextAction: "Perguntar qual serviço a lead procura.",
      language: "pt",
      confidence: 0.35,
    };
  }
}