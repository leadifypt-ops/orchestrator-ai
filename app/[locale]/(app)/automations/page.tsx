"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

type Automation = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  prompt?: string;
};

function getStatusClasses(status?: string | null) {
  const value = (status || "").toLowerCase();

  if (value === "active" || value === "completed" || value === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "running" || value === "queued" || value === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (value === "failed" || value === "error") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export default function AutomationsPage() {
  const params = useParams();
  const locale = params?.locale as string;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutomations();
  }, []);

  async function fetchAutomations() {
    const { data, error } = await supabase
      .from("automations")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAutomations(data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            A carregar automações...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Automations
              </p>
              <h1 className="text-3xl font-semibold">Minhas Automações</h1>
              <p className="text-sm text-zinc-400">
                Lista das automações criadas e guardadas na tua conta.
              </p>
            </div>

            <Link
              href={`/${locale}`}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition"
            >
              Voltar ao Builder
            </Link>
          </div>
        </div>

        {automations.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            Ainda não tens automações criadas.
          </div>
        ) : (
          <div className="space-y-4">
            {automations.map((automation) => (
              <Link
                key={automation.id}
                href={`/${locale}/automations/${automation.id}`}
                className="block"
              >
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 hover:bg-zinc-900 transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {automation.name || "Sem nome"}
                      </h2>

                      {automation.prompt && (
                        <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                          {automation.prompt}
                        </p>
                      )}
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs border ${getStatusClasses(
                        automation.status
                      )}`}
                    >
                      {automation.status}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-500">
                    Criado em{" "}
                    {new Date(automation.created_at).toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}