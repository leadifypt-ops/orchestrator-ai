"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-client";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCheckout(
    plan: "setup" | "monthly" | "combo" | "founders"
  ) {
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
    <div className="min-h-screen bg-[#050505] text-white px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-white/70">
            Sistema que transforma mensagens em clientes
          </div>

          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Escolhe a forma certa de começar
          </h1>

          <p className="mt-5 text-base leading-7 text-white/60 md:text-lg">
            A plataforma foi pensada para negócios que querem captar mais
            clientes com automação, organização e acompanhamento real. Podes
            começar sozinho, pedir implementação profissional ou entrar no
            Programa Fundadores com uma condição especial nesta fase.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.18em] text-white/40">
                Mensal
              </p>

              <h2 className="mt-3 text-2xl font-semibold">Usar sozinho</h2>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Para quem quer acesso contínuo à plataforma e prefere montar e
                gerir tudo por conta própria.
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-semibold">49,99€</span>
                <span className="pb-1 text-sm text-white/45">/mês</span>
              </div>
            </div>

            <ul className="mb-8 space-y-3 text-sm text-white/75">
              <li>✔ Acesso à app</li>
              <li>✔ Criação de automações</li>
              <li>✔ Dashboard e gestão</li>
              <li>✔ Atualizações do sistema</li>
              <li>✖ Sem setup incluído</li>
              <li>✖ Sem implementação por nós</li>
            </ul>

            <button
              onClick={() => handleCheckout("monthly")}
              disabled={loadingPlan !== null}
              className="w-full rounded-2xl bg-white px-5 py-3 font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPlan === "monthly" ? "A abrir..." : "Começar sozinho"}
            </button>
          </div>

          <div className="relative rounded-3xl border border-blue-500/40 bg-gradient-to-b from-blue-500/15 via-blue-500/5 to-white/[0.03] p-8 shadow-2xl shadow-blue-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="rounded-full border border-blue-400/30 bg-blue-600 px-4 py-1 text-xs font-medium text-white">
                MAIS VANTAJOSO
              </div>
            </div>

            <div className="mb-6 mt-4">
              <p className="text-sm uppercase tracking-[0.18em] text-blue-200/70">
                Programa Fundadores · 15 vagas
              </p>

              <h2 className="mt-3 text-2xl font-semibold text-white">
                Entrada completa
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/70">
                Criado para os primeiros clientes que querem começar já com a
                estrutura montada, implementação feita por nós e acesso contínuo
                à plataforma.
              </p>
            </div>

            <div className="mb-6 space-y-4">
              <div>
                <p className="text-sm text-white/50">Setup inicial</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-sm text-white/35 line-through">
                    179,99€
                  </span>
                  <span className="text-4xl font-semibold text-white">130€</span>
                </div>
              </div>

              <div>
                <p className="text-sm text-white/50">Acesso mensal</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-sm text-white/35 line-through">
                    49,99€
                  </span>
                  <span className="text-3xl font-semibold text-white">
                    39,99€
                  </span>
                  <span className="text-sm text-white/45">/mês</span>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
              Esta condição especial está disponível apenas no formato completo:
              setup inicial + acesso mensal contínuo. Depois desta fase, mantém-se
              apenas o valor normal do combo.
            </div>

            <ul className="mb-8 space-y-3 text-sm text-white/80">
              <li>✔ Setup completo feito por nós</li>
              <li>✔ Acesso contínuo à app</li>
              <li>✔ Estrutura inicial pronta</li>
              <li>✔ Automação configurada</li>
              <li>✔ Acompanhamento inicial</li>
              <li>✔ Melhor condição de entrada</li>
            </ul>

            <button
              onClick={() => handleCheckout("founders")}
              disabled={loadingPlan !== null}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPlan === "founders" ? "A abrir..." : "Garantir vaga"}
            </button>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs font-medium text-white/80">
                VALOR NORMAL
              </div>
            </div>

            <div className="mb-6 mt-4">
              <p className="text-sm uppercase tracking-[0.18em] text-white/40">
                Combo normal
              </p>

              <h2 className="mt-3 text-2xl font-semibold">Tudo pronto</h2>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Para quem quer implementação profissional e acesso contínuo,
                fora da condição especial do Programa Fundadores.
              </p>
            </div>

            <div className="mb-6 space-y-3">
              <div>
                <p className="text-sm text-white/45">Setup inicial</p>
                <div className="text-3xl font-semibold">179,99€</div>
              </div>

              <div>
                <p className="text-sm text-white/45">Acesso mensal</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-semibold">49,99€</span>
                  <span className="pb-1 text-sm text-white/45">/mês</span>
                </div>
              </div>
            </div>

            <ul className="mb-8 space-y-3 text-sm text-white/75">
              <li>✔ Setup completo</li>
              <li>✔ Configuração profissional</li>
              <li>✔ Acesso à plataforma</li>
              <li>✔ Sistema contínuo</li>
              <li>✔ Base pronta para operação</li>
              <li>✖ Sem condição promocional</li>
            </ul>

            <button
              onClick={() => handleCheckout("combo")}
              disabled={loadingPlan !== null}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPlan === "combo" ? "A abrir..." : "Quero o combo completo"}
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.18em] text-white/40">
                Setup
              </p>

              <h2 className="mt-3 text-2xl font-semibold">Implementação inicial</h2>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Para quem quer apenas a implementação da estrutura inicial, sem
                acesso mensal contínuo incluído.
              </p>
            </div>

            <div className="mb-6">
              <div className="text-4xl font-semibold">179,99€</div>
            </div>

            <ul className="mb-8 space-y-3 text-sm text-white/75">
              <li>✔ Setup completo</li>
              <li>✔ Configuração inicial</li>
              <li>✔ Estrutura entregue pronta</li>
              <li>✔ Assistência inicial</li>
              <li>✖ Sem acesso mensal incluído</li>
              <li>✖ Sem continuidade automática</li>
            </ul>

            <button
              onClick={() => handleCheckout("setup")}
              disabled={loadingPlan !== null}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPlan === "setup" ? "A abrir..." : "Quero só o setup"}
            </button>
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-white">
                Não estás a pagar só por software
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Estás a investir num sistema que organiza contactos, ajuda a
                responder mais rápido e cria uma base real para captar clientes.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-white">
                Faz sentido para negócios locais
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Se o sistema trouxer apenas um ou dois clientes por mês, o valor
                pode justificar-se rapidamente para muitos negócios.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-white">
                Programa Fundadores
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Esta fase existe para fechar os primeiros casos reais, melhorar
                o produto com clientes próximos e dar uma condição mais vantajosa
                a quem entrar agora.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-6 text-center text-sm text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}