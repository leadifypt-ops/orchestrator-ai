"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunSchedulerButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRunScheduler() {
    try {
      setLoading(true);

      const res = await fetch("/api/scheduler", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao correr scheduler.");
        return;
      }

      alert(
        `Scheduler executado.\nCriadas: ${data.created}\nIgnoradas: ${data.skipped}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro inesperado ao correr scheduler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRunScheduler}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "A correr scheduler..." : "Testar Scheduler"}
    </button>
  );
}