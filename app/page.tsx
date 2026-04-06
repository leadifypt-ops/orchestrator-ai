"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-client";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Tens de estar autenticado.");
        return;
      }

      const response = await fetch("/api/generate-automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao gerar automação.");
        return;
      }

      setResult(data.automation);
    } catch (err) {
      console.error(err);
      setError("Erro inesperado ao gerar automação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold mb-4">
            Criar automação com IA
          </h1>
          <p className="text-neutral-400">
            Escreve o que queres e a IA vai gerar uma automação estruturada.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <label className="block text-sm text-neutral-400 mb-3">
            Prompt
          </label>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Quero uma automação para captar leads de barbearia no Instagram e guardar num Google Sheets"
            className="w-full h-40 rounded-xl bg-black border border-neutral-800 p-4 text-white outline-none focus:border-blue-500"
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "A gerar automação..." : "Gerar automação"}
          </button>

          {error ? (
            <p className="mt-4 text-red-500">{error}</p>
          ) : null}
        </div>

        {result ? (
          <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-2xl font-semibold mb-4">
              Automação criada
            </h2>

            <div className="space-y-3 text-sm">
              <p>
                <strong>Nome:</strong> {result.name}
              </p>
              <p>
                <strong>Prompt:</strong> {result.prompt}
              </p>
              <p>
                <strong>Status:</strong> {result.status}
              </p>

              <div>
                <strong>Config:</strong>
                <pre className="mt-3 overflow-auto rounded-xl bg-black p-4 text-xs border border-neutral-800">
                  {JSON.stringify(result.config, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}