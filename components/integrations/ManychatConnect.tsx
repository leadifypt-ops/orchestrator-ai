"use client";

import { useMemo, useState } from "react";

type ManychatConnectProps = {
  automationId: string;
};

export default function ManychatConnect({
  automationId,
}: ManychatConnectProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

  const endpoint = `${appUrl}/api/public/leads`;

  const body = useMemo(
    () => `{
  "secret": "autoforge-secret",
  "automationId": "${automationId}",
  "source": "manychat",
  "channel": "instagram",
  "name": "{{first_name}}",
  "phone": "{{phone}}",
  "instagram": "{{username}}",
  "message": "{{last_text_input}}"
}`,
    [automationId]
  );

  async function copyToClipboard(value: string, type: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Integração
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Ligar ManyChat
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Copia os dados abaixo e cola no ManyChat para ligar esta automação ao
          Instagram.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Endpoint
          </p>

          <div className="flex flex-col gap-3 lg:flex-row">
            <code className="flex-1 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-200">
              {endpoint || "Define NEXT_PUBLIC_APP_URL no .env.local"}
            </code>

            <button
              type="button"
              onClick={() => copyToClipboard(endpoint, "endpoint")}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
              disabled={!endpoint}
            >
              {copied === "endpoint" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Automation ID
          </p>

          <div className="flex flex-col gap-3 lg:flex-row">
            <code className="flex-1 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-200">
              {automationId}
            </code>

            <button
              type="button"
              onClick={() => copyToClipboard(automationId, "automationId")}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              {copied === "automationId" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Secret
          </p>

          <div className="flex flex-col gap-3 lg:flex-row">
            <code className="flex-1 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-zinc-200">
              autoforge-secret
            </code>

            <button
              type="button"
              onClick={() =>
                copyToClipboard("autoforge-secret", "secret")
              }
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              {copied === "secret" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-black p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Body JSON
          </p>

          <pre className="max-h-[320px] overflow-auto rounded-xl bg-zinc-950 p-4 text-xs text-emerald-300">
            {body}
          </pre>

          <button
            type="button"
            onClick={() => copyToClipboard(body, "body")}
            className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
          >
            {copied === "body" ? "Copiado" : "Copiar JSON"}
          </button>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-300">
            Como usar no ManyChat
          </p>

          <ol className="mt-3 space-y-2 text-sm text-zinc-300">
            <li>1. Abrir o flow no ManyChat</li>
            <li>2. Adicionar External Request</li>
            <li>3. Method = POST</li>
            <li>4. Colar o endpoint</li>
            <li>5. Colar o JSON acima no body</li>
            <li>6. Testar com uma DM no Instagram</li>
          </ol>
        </div>
      </div>
    </div>
  );
}