"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  automation: {
    id: string;
    name?: string | null;
    prompt?: string | null;
    config_json?: unknown;
    result_json?: unknown;
  };
};

export default function EditAutomationForm({ automation }: Props) {
  const router = useRouter();

  const initialJson = useMemo(() => {
    return JSON.stringify(
      automation.config_json || automation.result_json || {},
      null,
      2
    );
  }, [automation]);

  const [name, setName] = useState(automation.name || "");
  const [prompt, setPrompt] = useState(automation.prompt || "");
  const [jsonText, setJsonText] = useState(initialJson);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    try {
      setLoading(true);

      let parsedJson: unknown = {};

      try {
        parsedJson = JSON.parse(jsonText);
      } catch {
        alert("O JSON da configuração não é válido.");
        return;
      }

      const res = await fetch("/api/automations/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationId: automation.id,
          name,
          prompt,
          config_json: parsedJson,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao guardar alterações.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro inesperado ao guardar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">Editar automação</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Altera nome, prompt e configuração JSON.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
            placeholder="Nome da automação"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/40"
            placeholder="Prompt original"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">
            Configuração JSON
          </label>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={18}
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 font-mono text-sm leading-6 text-emerald-300 outline-none transition focus:border-emerald-500/40"
            spellCheck={false}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "A guardar..." : "Guardar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}