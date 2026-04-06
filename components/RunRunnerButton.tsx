"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunRunnerButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRunRunner() {
    try {
      setLoading(true);

      const res = await fetch("/api/runner", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao correr runner.");
        return;
      }

      alert(
        data?.message
          ? data.message
          : `Runner executado.\nRun: ${data.runId}\nStatus: ${data.status}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro inesperado ao correr runner.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRunRunner}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "A correr runner..." : "Testar Runner"}
    </button>
  );
}