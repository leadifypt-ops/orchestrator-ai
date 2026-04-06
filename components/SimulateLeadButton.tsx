"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SimulateLeadButtonProps = {
  automationId: string;
};

export default function SimulateLeadButton({
  automationId,
}: SimulateLeadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSimulateLead() {
    try {
      setLoading(true);
      setMessage(null);

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
          message: "Quero saber preços",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || data?.message || "Erro ao simular lead."
        );
      }

      setMessage("Lead de teste enviada com sucesso.");
      router.refresh();
      setTimeout(() => router.refresh(), 1500);
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
            Envia uma lead fake para esta automação e testa o fluxo sem
            Instagram e sem ManyChat Pro.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSimulateLead}
          disabled={loading}
          className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "A enviar..." : "Simular lead"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-300">
          {message}
        </div>
      ) : null}
    </div>
  );
}