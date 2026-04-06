"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

type Automation = {
  id: string;
  name: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
  config_json?: any;
};

export function AutomationCard({ automation }: { automation: Automation }) {
  const router = useRouter();
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "pt";
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm("Queres mesmo apagar esta automação?");
    if (!confirmed) return;

    try {
      setLoadingAction("delete");

      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao apagar automação.");
      }

      router.refresh();
    } catch {
      alert("Não foi possível apagar a automação.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDuplicate() {
    try {
      setLoadingAction("duplicate");

      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Erro ao duplicar a automação.");
      }

      router.refresh();
    } catch {
      alert("Não foi possível duplicar a automação.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleExecute() {
    alert("Próximo passo: ligar este botão ao n8n ou Make.");
  }

  return (
    <div className="rounded-2xl border p-5 space-y-4 bg-background">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {automation.name || "Automação sem nome"}
          </h3>

          <span className="text-xs px-2 py-1 rounded-full border">
            {automation.status || "draft"}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {automation.goal || "Sem objetivo definido"}
        </p>
      </div>

      <div className="text-xs text-muted-foreground">
        Criada em {new Date(automation.created_at).toLocaleDateString("pt-PT")}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/automations/${automation.id}`}
          className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium border hover:bg-muted transition"
        >
          Abrir
        </Link>

        <button
          onClick={handleDuplicate}
          disabled={loadingAction === "duplicate"}
          className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium border hover:bg-muted transition disabled:opacity-50"
        >
          {loadingAction === "duplicate" ? "A duplicar..." : "Duplicar"}
        </button>

        <button
          onClick={handleDelete}
          disabled={loadingAction === "delete"}
          className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium border hover:bg-muted transition disabled:opacity-50"
        >
          {loadingAction === "delete" ? "A apagar..." : "Apagar"}
        </button>

        <button
          onClick={handleExecute}
          className="inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium border hover:bg-muted transition"
        >
          Executar
        </button>
      </div>
    </div>
  );
}