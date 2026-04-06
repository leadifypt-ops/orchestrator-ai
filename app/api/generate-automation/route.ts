import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const parsed = JSON.parse(cleaned);

  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt em falta" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY não definida" },
        { status: 500 }
      );
    }

    const messages: OpenRouterMessage[] = [
      {
        role: "system",
        content: AUTOMATION_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ];

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

    const data = (await response.json()) as OpenRouterResponse;

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "IA não devolveu conteúdo" },
        { status: 500 }
      );
    }

    const automation = safeParseAutomation(content);

    return NextResponse.json({
      ok: true,
      automation,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Erro ao gerar automação",
      },
      { status: 500 }
    );
  }
}