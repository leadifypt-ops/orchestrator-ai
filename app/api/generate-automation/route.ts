import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type SubscriptionRow = {
  plan_status: string | null;
  plan_name: string | null;
};

const AUTOMATION_SYSTEM_PROMPT = `
Tu és um arquiteto especialista em aquisição de clientes e criação de negócios automáticos.

A tua função é receber um prompt do utilizador e gerar um sistema completo de aquisição híbrida:
- Aquisição Local
- Aquisição Online

Responde SEMPRE em JSON válido.
Nunca escrevas texto fora do JSON.

ESTRUTURA OBRIGATÓRIA:

{
  "projectName": "string",
  "businessType": "string",
  "goal": "string",

  "offer": {
    "headline": "string",
    "subheadline": "string",
    "cta": "string"
  },

  "aquisicaoLocal": {
    "channel": "string",
    "steps": ["string"]
  },

  "aquisicaoOnline": {
    "channel": "string",
    "steps": ["string"]
  },

  "followups": ["string"],

  "metrics": {
    "mainGoal": "string"
  }
}
`;

function cleanJsonResponse(content: string): string {
  return content.replace(/```json/g, "").replace(/```/g, "").trim();
}

function safeParseAutomation(content: string) {
  const cleaned = cleanJsonResponse(content);
  return JSON.parse(cleaned);
}

function hasActiveAccess(planStatus: string | null | undefined) {
  return planStatus === "active" || planStatus === "trialing";
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1) Verificar utilizador autenticado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401 }
      );
    }

    // 2) Verificar subscrição/plano ativo
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan_status, plan_name")
      .eq("user_id", user.id)
      .maybeSingle<SubscriptionRow>();

    if (subscriptionError) {
      console.error("Erro ao verificar subscrição:", subscriptionError);

      return NextResponse.json(
        { error: "Erro ao verificar plano do utilizador" },
        { status: 500 }
      );
    }

    if (!subscription || !hasActiveAccess(subscription.plan_status)) {
      return NextResponse.json(
        {
          error: "Plano necessário",
          code: "PLAN_REQUIRED",
        },
        { status: 403 }
      );
    }

    // 3) Ler prompt
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt em falta" },
        { status: 400 }
      );
    }

    // 4) Verificar OpenRouter key
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY não definida" },
        { status: 500 }
      );
    }

    // 5) Preparar mensagens
    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: AUTOMATION_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt.trim(),
      },
    ];

    // 6) Chamar OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          response_format: { type: "json_object" },
          messages,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro OpenRouter:", errorText);

      return NextResponse.json(
        { error: "Erro na resposta da IA" },
        { status: 500 }
      );
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "IA não devolveu conteúdo" },
        { status: 500 }
      );
    }

    // 7) Fazer parse do JSON
    const automation = safeParseAutomation(content);

    // 8) Resposta final
    return NextResponse.json({
      ok: true,
      automation,
    });
  } catch (error) {
    console.error("Erro ao gerar automação:", error);

    return NextResponse.json(
      {
        error: "Erro ao gerar automação",
      },
      { status: 500 }
    );
  }
}