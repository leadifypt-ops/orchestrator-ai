"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SimulateLeadButtonProps = {
  automationId: string;
};

const TEST_MESSAGES = [
  "Quero marcar",
  "Amanhã",
  "15h",
  "Sim, confirma",
  "Obrigado",
];

export default function SimulateLeadButton({
  automationId,
}: SimulateLeadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  async function handleSimulateLead() {
    try {
      setLoading(true);
      setMessage(null);

      const currentMessage = TEST_MESSAGES[step] || TEST_MESSAGES[0];

      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret: "autoforge-secret",
          automationId,
          source: "test",
          channel: "instagram",
          name: "Lead Teste",
          phone: "912345678",
          instagram: "@lead.teste",
          whatsapp: "912345678",
          message: currentMessage,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Erro ao simular lead."
        );
      }

      const nextStep =
        step + 1 < TEST_MESSAGES.length ? step + 1 : TEST_MESSAGES.length - 1;

      setStep(nextStep);

      setMessage(
        `Mensagem enviada: "${currentMessage}". Próximo clique vai enviar: "${
          TEST_MESSAGES[nextStep]
        }"`
      );

      router.refresh();
      setTimeout(() => router.refresh(), 1200);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao simular lead."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleResetSimulation() {
    setStep(0);
    setMessage('Simulação reiniciada. Próximo clique vai enviar: "Quero marcar"');
  }

  const currentPreview = TEST_MESSAGES[step] || TEST_MESSAGES[0];

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Teste rápido
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Simular lead
          </h2>

          <p className="mt-2 text-sm text-zinc-400">
            Simula uma conversa contínua com a mesma lead para testar a IA até
            booked ou lost.
          </p>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-300">
            Próxima mensagem:{" "}
            <span className="font-medium text-white">"{currentPreview}"</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSimulateLead}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "A enviar..." : "Simular lead"}
          </button>

          <button
            type="button"
            onClick={handleResetSimulation}
            disabled={loading}
            className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reiniciar teste
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-300">
          {message}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Sequência do teste
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {TEST_MESSAGES.map((item, index) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1 text-xs ${
                index === step
                  ? "bg-white text-black"
                  : index < step
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {index + 1}. {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}