import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Automation = {
  id: string;
  name?: string | null;
  project_name?: string | null;
  prompt?: string | null;
  status?: string | null;
  created_at?: string | null;
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

export default async function AutomationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/pt/login");
  }

  const { data: automations, error } = await supabase
    .from("automations")
    .select("id, name, project_name, prompt, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            <h1 className="mb-3 text-2xl font-bold">Minhas Automações</h1>
            <p className="text-red-300">
              Erro ao carregar automações: {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const list = (automations || []) as Automation[];

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                Automations
              </p>
              <h1 className="text-3xl font-bold">Minhas Automações</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Lista das automações geradas e guardadas na tua conta.
              </p>
            </div>

            <Link
              href="/pt/projects/new"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Voltar ao Builder
            </Link>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-950 p-8">
            <h2 className="text-xl font-semibold text-white">
              Ainda não tens automações
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Cria a primeira automação no builder e ela vai aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {list.map((automation) => {
              const title =
                automation.name ||
                automation.project_name ||
                "Automação sem nome";

              return (
                <Link
                  key={automation.id}
                  href={`/pt/automations/${automation.id}`}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 transition hover:bg-zinc-900 hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white">
                        {title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        {automation.prompt || "Sem prompt disponível."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium uppercase ${getStatusClasses(
                        automation.status
                      )}`}
                    >
                      {automation.status || "draft"}
                    </span>
                  </div>

                  <p className="mt-4 text-xs text-zinc-500">
                    Criado em{" "}
                    {automation.created_at
                      ? new Date(automation.created_at).toLocaleString("pt-PT")
                      : "-"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}