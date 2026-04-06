"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-client";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCheckout(plan: "setup" | "monthly" | "combo") {
    try {
      setLoadingPlan(plan);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Não foi possível identificar o utilizador.");
        setLoadingPlan(null);
        return;
      }

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          userId: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        setError(result.error || "Erro ao abrir checkout.");
        setLoadingPlan(null);
        return;
      }

      window.location.href = result.url;
    } catch (err) {
      console.error("ERRO NO CHECKOUT:", err);
      setError("Erro inesperado ao abrir checkout.");
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold mb-4">
            Escolhe como queres começar
          </h1>
          <p className="text-neutral-400">
            Podes usar sozinho, pedir setup profissional ou ter tudo completo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">

          {/* MONTHLY */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-xl font-semibold mb-2">
              Mensal
            </h2>

            <p className="text-4xl font-bold mb-4">
              49,99€
              <span className="text-lg text-neutral-400 font-normal">
                /mês
              </span>
            </p>

            <p className="text-neutral-400 text-sm mb-6">
              Para quem já sabe usar o sistema e quer acesso contínuo à app.
            </p>

            <ul className="space-y-3 text-sm text-neutral-300 mb-8">
              <li>✔ Acesso à app</li>
              <li>✔ Automação ativa</li>
              <li>✔ Atualizações do sistema</li>
              <li>✖ Sem setup</li>
              <li>✖ Sem assistência</li>
            </ul>

            <button
              onClick={() => handleCheckout("monthly")}
              disabled={loadingPlan !== null}
              className="w-full bg-white text-black py-3 rounded-xl font-semibold hover:bg-neutral-200 transition"
            >
              {loadingPlan === "monthly"
                ? "A abrir..."
                : "Começar sozinho"}
            </button>
          </div>

          {/* COMBO */}
          <div className="relative rounded-2xl border border-blue-500 bg-gradient-to-b from-blue-500/10 to-neutral-950 p-6 scale-[1.03] shadow-2xl shadow-blue-500/10">

            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                MAIS ESCOLHIDO
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-2">
              Setup + Mensal
            </h2>

            <p className="text-4xl font-bold mb-2">
              179,99€
            </p>

            <p className="text-sm text-neutral-400 mb-4">
              + 49,99€/mês após setup
            </p>

            <p className="text-neutral-300 text-sm mb-6">
              Nós configuramos tudo e deixamos o sistema a funcionar.
            </p>

            <ul className="space-y-3 text-sm text-neutral-300 mb-8">
              <li>✔ Setup completo</li>
              <li>✔ Configuração profissional</li>
              <li>✔ Automação pronta</li>
              <li>✔ Acesso à app</li>
              <li>✔ Sistema contínuo</li>
            </ul>

            <button
              onClick={() => handleCheckout("combo")}
              disabled={loadingPlan !== null}
              className="w-full bg-blue-600 py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
            >
              {loadingPlan === "combo"
                ? "A abrir..."
                : "Quero tudo pronto"}
            </button>
          </div>

          {/* SETUP */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-xl font-semibold mb-2">
              Setup Profissional
            </h2>

            <p className="text-4xl font-bold mb-4">
              179,99€
            </p>

            <p className="text-neutral-400 text-sm mb-6">
              Nós configuramos o sistema para ti e entregamos pronto.
            </p>

            <ul className="space-y-3 text-sm text-neutral-300 mb-8">
              <li>✔ Setup completo</li>
              <li>✔ Configuração</li>
              <li>✔ Sistema entregue pronto</li>
              <li>✔ Assistência inicial</li>
              <li>✖ Sem acesso mensal</li>
            </ul>

            <button
              onClick={() => handleCheckout("setup")}
              disabled={loadingPlan !== null}
              className="w-full bg-neutral-800 py-3 rounded-xl font-semibold hover:bg-neutral-700 transition"
            >
              {loadingPlan === "setup"
                ? "A abrir..."
                : "Quero só o setup"}
            </button>
          </div>

        </div>

        {error && (
          <p className="text-center text-red-500 mt-6">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}