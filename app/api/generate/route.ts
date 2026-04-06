import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const prompt = body.prompt;

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt em falta" },
      { status: 400 }
    );
  }

  const promptLower = String(prompt).toLowerCase();

  let businessType = "negócio local";
  let goal = "captar leads";
  let channels = ["Instagram", "WhatsApp"];
  let recommendedTools = ["ManyChat", "WhatsApp", "Google Sheets"];
  let projectName = "Lead Engine";
  let messages = {
    welcome: "Boas! Obrigado pela mensagem. Como te posso ajudar?",
    cta: "Clica abaixo para continuar no WhatsApp.",
    followUp: "Queres que eu te ajude a escolher a melhor opção para ti?",
  };

  if (promptLower.includes("barbeiro") || promptLower.includes("barbearia")) {
    businessType = "barbeiro";
    goal = "captar leads e marcar serviços";
    projectName = "Barber Lead Engine";
    messages = {
      welcome: "Boas! Obrigado pela mensagem. Procuras corte, barba ou ambos?",
      cta: "Carrega abaixo para continuar no WhatsApp.",
      followUp: "Se quiseres, posso também mostrar os horários disponíveis.",
    };
  }

  if (
    promptLower.includes("lash") ||
    promptLower.includes("cílios") ||
    promptLower.includes("cilios")
  ) {
    businessType = "lash designer";
    goal = "captar clientes e encaminhar para marcação";
    projectName = "Lash Booking Engine";
    messages = {
      welcome: "Olá! Obrigada pela mensagem. Queres saber valores, agenda ou serviços?",
      cta: "Clica abaixo para continuar no WhatsApp e marcar.",
      followUp: "Se quiseres, também posso mostrar os serviços mais procurados.",
    };
  }

  if (
    promptLower.includes("restaurante") ||
    promptLower.includes("restaurant")
  ) {
    businessType = "restaurante";
    goal = "receber pedidos e reservas";
    channels = ["Instagram", "WhatsApp", "Landing Page"];
    recommendedTools = ["ManyChat", "WhatsApp", "Google Sheets", "Landing Page"];
    projectName = "Restaurant Order Flow";
    messages = {
      welcome: "Olá! Queres fazer pedido, ver o menu ou reservar mesa?",
      cta: "Clica abaixo para continuar no WhatsApp.",
      followUp: "Se quiseres, também posso enviar o menu e os horários.",
    };
  }

  if (
    promptLower.includes("personal") ||
    promptLower.includes("fitness") ||
    promptLower.includes("treino")
  ) {
    businessType = "personal trainer";
    goal = "captar leads para avaliação e fechar novos alunos";
    projectName = "PT Lead Engine";
    messages = {
      welcome: "Boas! Queres emagrecimento, hipertrofia ou acompanhamento personalizado?",
      cta: "Clica abaixo para falar no WhatsApp.",
      followUp: "Também posso ajudar-te a encontrar o plano ideal.",
    };
  }

  const result = {
    projectName,
    businessType,
    goal,
    channels,
    recommendedTools,
    flow: [
      "Mensagem inicial automática",
      "Qualificação do lead",
      "Pergunta principal do cliente",
      "Resposta com CTA",
      "Encaminhar para WhatsApp",
      "Guardar lead"
    ],
    messages,
    landingPage: {
      headline: `Sistema para ${businessType} captar leads automaticamente`,
      subheadline: "Automação simples para transformar mensagens em clientes.",
      sections: ["Hero", "Benefícios", "Serviços", "CTA", "Contacto"]
    },
    implementationChecklist: [
      "Criar fluxo de mensagem inicial",
      "Definir perguntas de qualificação",
      "Ligar ao WhatsApp",
      "Guardar leads numa folha ou base de dados",
      "Criar landing page simples"
    ],
    nextBestAction: "Criar projeto e abrir builder"
  };

  return NextResponse.json(result);
}