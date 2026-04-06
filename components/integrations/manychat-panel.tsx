"use client";

import { useMemo, useState } from "react";

type ManychatPanelProps = {
  appUrl: string;
  secret: string;
  automationId?: string;
  automationName?: string;
  automationStatus?: string;
};

export default function ManychatPanel({
  appUrl,
  secret,
  automationId = "",
  automationName = "",
  automationStatus = "",
}: ManychatPanelProps) {
  const [testStatus, setTestStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  const endpoint = useMemo(() => {
    const base = appUrl?.replace(/\/$/, "");
    return `${base}/api/public/leads`;
  }, [appUrl]);

  const proJson = useMemo(() => {
    return JSON.stringify(
      {
        secret,
        automationId: automationId || "{{automation_id}}",
        name: "{{first_name}}",
        instagram: "{{username}}",
        phone: "{{phone}}",
        message: "{{last_text_input}}",
        source: "manychat",
        channel: "instagram",
      },
      null,
      2
    );
  }, [secret, automationId]);

  const freeLink = useMemo(() => {
    const url = new URL(endpoint);
    url.searchParams.set("secret", secret);
    url.searchParams.set("source", "manychat");
    url.searchParams.set("channel", "instagram");
    url.searchParams.set("name", "Lead Instagram");
    url.searchParams.set("message", "lead from manychat");

    if (automationId) {
      url.searchParams.set("automationId", automationId);
    }

    return url.toString();
  }, [endpoint, secret, automationId]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Copiado.");
    } catch {
      window.alert("Não consegui copiar.");
    }
  }

  async function handleTestWebhook() {
    try {
      setTestStatus("loading");
      setTestMessage("");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          secret,
          automationId: automationId || undefined,
          name: "Teste Integração",
          phone: "912345678",
          instagram: "@teste.integracao",
          source: "manychat",
          channel: "instagram",
          message: "Teste manual da página de integração",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTestStatus("error");
        setTestMessage(data?.error || "Erro ao testar webhook.");
        return;
      }

      setTestStatus("success");
      setTestMessage(
        `Webhook OK. Lead criada com status: ${
          data?.lead?.status || "sem status"
        }`
      );
    } catch {
      setTestStatus("error");
      setTestMessage("Erro inesperado ao testar webhook.");
    }
  }

  return (
    <div className="grid gap-6">
      {automationId ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Automação selecionada
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <strong>ID:</strong> {automationId}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <strong>Nome:</strong> {automationName || "Sem nome"}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <strong>Status:</strong> {automationStatus || "Sem status"}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Nenhuma automação específica foi passada. A route vai usar a automação
          ativa mais recente.
        </div>
      )}

      {!appUrl ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          NEXT_PUBLIC_APP_URL não está definido.
        </div>
      ) : null}

      {!secret ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          LEADS_WEBHOOK_SECRET não está definido.
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          Endpoint público
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Este é o endpoint que recebe a lead e dispara a automação.
        </p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={endpoint}
            readOnly
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
          />
          <button
            onClick={() => copyText(endpoint)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Copiar endpoint
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          Secret atual
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Este secret protege a route pública.
        </p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={secret}
            readOnly
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
          />
          <button
            onClick={() => copyText(secret)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Copiar secret
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          ManyChat Pro — JSON pronto
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Usa este body no External Request quando tiveres plano Pro.
        </p>

        <div className="mt-4">
          <textarea
            value={proJson}
            readOnly
            className="h-64 w-full rounded-xl border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs text-zinc-900"
          />
        </div>

        <div className="mt-3">
          <button
            onClick={() => copyText(proJson)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Copiar JSON
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          ManyChat grátis — link pronto
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Usa este link num botão para teste.
        </p>

        <div className="mt-4">
          <textarea
            value={freeLink}
            readOnly
            className="h-40 w-full rounded-xl border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs text-zinc-900"
          />
        </div>

        <div className="mt-3">
          <button
            onClick={() => copyText(freeLink)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Copiar link
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          Testar webhook
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Cria uma lead de teste para confirmares se a integração está viva.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleTestWebhook}
            disabled={testStatus === "loading" || !appUrl || !secret}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testStatus === "loading" ? "A testar..." : "Testar agora"}
          </button>
        </div>

        {testStatus !== "idle" ? (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${
              testStatus === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {testMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}