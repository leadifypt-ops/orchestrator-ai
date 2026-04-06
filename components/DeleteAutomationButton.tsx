"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  automationId: string;
  redirectTo?: string;
};

export default function DeleteAutomationButton({
  automationId,
  redirectTo,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Tens a certeza que queres apagar esta automação?"
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const res = await fetch("/api/automations/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ automationId }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Erro ao apagar automação.");
        return;
      }

      if (redirectTo) {
        router.push(redirectTo);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro inesperado ao apagar automação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "A apagar..." : "Apagar"}
    </button>
  );
}