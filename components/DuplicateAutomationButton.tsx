"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  automationId: string;
};

export default function DuplicateAutomationButton({ automationId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDuplicate() {
    try {
      setLoading(true);

      const res = await fetch("/api/automations/duplicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ automationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao duplicar automação.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro inesperado ao duplicar automação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "A duplicar..." : "Duplicar"}
    </button>
  );
}