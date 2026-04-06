"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  automationId: string;
};

export default function ExecuteAutomationButton({ automationId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExecute() {
    try {
      setLoading(true);

      const res = await fetch("/api/execute-automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationId,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : null;

      if (!res.ok) {
        alert(data?.error || "Erro ao executar automação.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro inesperado ao executar automação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExecute}
      disabled={loading}
      className="group relative inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-gradient-to-b from-zinc-900 to-black px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:border-emerald-500/40 hover:shadow-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
          A executar...
        </>
      ) : (
        <>
          <span className="text-emerald-400">▶</span>
          Executar automação
        </>
      )}
    </button>
  );
}