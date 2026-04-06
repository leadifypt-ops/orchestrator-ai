"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeployAutomationButtonProps = {
  automationId: string;
  currentStatus?: string | null;
};

export default function DeployAutomationButton({
  automationId,
  currentStatus,
}: DeployAutomationButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isActive = (currentStatus || "").toLowerCase() === "active";

  async function handleToggleDeploy() {
    try {
      setLoading(true);

      const response = await fetch("/api/automations/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationId,
          active: !isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.error || "Erro ao alterar estado da automação.");
        return;
      }

      router.refresh();
    } catch (error) {
      alert("Erro inesperado ao alterar deploy.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggleDeploy}
      disabled={loading}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        isActive
          ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {loading ? "Aguarda..." : isActive ? "Desativar" : "Deploy"}
    </button>
  );
}