import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExecuteAutomationButton from "@/components/ExecuteAutomationButton";
import DeployAutomationButton from "@/components/DeployAutomationButton";
import DuplicateAutomationButton from "@/components/DuplicateAutomationButton";
import DeleteAutomationButton from "@/components/DeleteAutomationButton";
import EditAutomationForm from "@/components/EditAutomationForm";
import AutomationAutoRefresh from "@/components/AutomationAutoRefresh";
import ExecutionResult from "@/components/ExecutionResult";
import ManychatConnect from "@/components/integrations/ManychatConnect";
import SimulateLeadButton from "@/components/SimulateLeadButton";
import LeadConversation from "@/components/LeadConversation";

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

type LeadRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  message?: string | null;
  source?: string | null;
  channel?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  ai_stage?: string | null;
  ai_status?: string | null;
  ai_reply?: string | null;
  ai_language?: string | null;
  ai_next_action?: string | null;
  ai_confidence?: number | null;
  ai_history?: Array<{ role: "lead" | "assistant"; content: string }> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function getStatusClasses(status?: string | null) {
  const value = (status || "").toLowerCase();

  if (value === "active" || value === "success" || value === "completed") {
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

function getLeadStatusClasses(status?: string | null) {
  const value = (status || "").toLowerCase();

  if (value === "booked") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "lost") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (value === "contacted" || value === "active") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export default async function AutomationDetailPage({ params }: PageProps) {
  const { id, locale } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: automation, error: automationError } = await supabase
    .from("automations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (automationError || !automation) {
    notFound();
  }

  const { data: runs, error: runsError } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("automation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .eq("automation_id", id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const automationTitle =
    automation.name || automation.project_name || "Automação sem nome";

  const automationPrompt = automation.prompt || "Sem prompt disponível.";

  const automationConfig =
    automation.config_json || automation.result_json || automation;

  const automationStatus = automation.status || "draft";
  const isActive = automationStatus.toLowerCase() === "active";

  const lastRun = runs && runs.length > 0 ? runs[0] : null;
  const runningCount =
    runs?.filter((run) =>
      ["queued", "running", "pending"].includes(
        String(run.status || "").toLowerCase()
      )
    ).length || 0;

  const typedLeads = (leads || []) as LeadRow[];

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <AutomationAutoRefresh intervalMs={5000} />

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                Automation Detail
              </p>

              <h1 className="text-3xl font-semibold">{automationTitle}</h1>

              <p className="mt-3 text-sm text-zinc-400">{automationPrompt}</p>

              <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
                <span>
                  ID: <span className="text-zinc-300">{automation.id}</span>
                </span>

                <span>
                  Criado em{" "}
                  <span className="text-zinc-300">
                    {automation.created_at
                      ? new Date(automation.created_at).toLocaleString()
                      : "-"}
                  </span>
                </span>

                <span>
                  Atualizado em{" "}
                  <span className="text-zinc-300">
                    {automation.updated_at
                      ? new Date(automation.updated_at).toLocaleString()
                      : "-"}
                  </span>
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Execution Engine V2
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs text-zinc-500">Estado atual</p>
                    <p className="mt-1 text-sm font-medium text-zinc-200">
                      {automationStatus}
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs text-zinc-500">Engine</p>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        isActive ? "text-emerald-300" : "text-zinc-300"
                      }`}
                    >
                      {isActive ? "Live / Running automatically" : "Offline"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs text-zinc-500">Runs em fila</p>
                    <p className="mt-1 text-sm font-medium text-zinc-200">
                      {runningCount}
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs text-zinc-500">Última execução</p>
                    <p className="mt-1 text-sm font-medium text-zinc-200">
                      {lastRun?.created_at
                        ? new Date(lastRun.created_at).toLocaleString()
                        : "Sem runs"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Runtime status
                  </p>

                  <p className="mt-2 text-sm text-zinc-300">
                    {isActive
                      ? "A automação está ativa e a engine está a criar e executar runs automaticamente."
                      : "A automação está parada. Faz deploy para a colocar live e permitir execução automática."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${getStatusClasses(
                  automation.status
                )}`}
              >
                {automationStatus}
              </span>

              <div className="flex flex-wrap gap-3">
                <ExecuteAutomationButton automationId={automation.id} />
                <DeployAutomationButton
                  automationId={automation.id}
                  currentStatus={automation.status}
                />
                <DuplicateAutomationButton automationId={automation.id} />
                <DeleteAutomationButton
                  automationId={automation.id}
                  redirectTo={`/${locale}/automations`}
                />
              </div>
            </div>
          </div>
        </div>

        <SimulateLeadButton automationId={automation.id} />

        <ManychatConnect automationId={automation.id} />

        <EditAutomationForm automation={automation} />

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-4 text-xl font-semibold">Configuração JSON</h2>

            <pre className="max-h-[600px] overflow-auto rounded-xl bg-black p-4 text-sm text-zinc-200">
              {JSON.stringify(automationConfig, null, 2)}
            </pre>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Execuções / Logs</h2>

              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                {runs?.length || 0} runs
              </span>
            </div>

            {runsError ? (
              <p className="text-red-400">{runsError.message}</p>
            ) : !runs || runs.length === 0 ? (
              <p className="text-zinc-400">Ainda não existem execuções.</p>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-xl border border-zinc-800 bg-black p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          Run #{run.id.slice(0, 6)}
                        </span>

                        <span className="text-xs text-zinc-500">
                          {run.created_at
                            ? new Date(run.created_at).toLocaleString()
                            : ""}
                        </span>
                      </div>

                      <span
                        className={`rounded px-2 py-1 text-xs uppercase ${getStatusClasses(
                          run.status
                        )}`}
                      >
                        {run.status}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <ExecutionResult run={run} />

                      <div>
                        <p className="mb-2 text-xs uppercase text-zinc-500">
                          Logs
                        </p>

                        <pre className="max-h-[200px] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-emerald-300">
                          {JSON.stringify(run.logs || [], null, 2)}
                        </pre>
                      </div>

                      <div>
                        <p className="mb-2 text-xs uppercase text-zinc-500">
                          Output
                        </p>

                        <pre className="max-h-[200px] overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-blue-300">
                          {JSON.stringify(
                            run.output || run.result || {},
                            null,
                            2
                          )}
                        </pre>
                      </div>

                      {run.error ? (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                          {run.error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Leads / Conversas</h2>

            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {typedLeads.length} leads
            </span>
          </div>

          {leadsError ? (
            <p className="text-red-400">{leadsError.message}</p>
          ) : typedLeads.length === 0 ? (
            <p className="text-zinc-400">Ainda não existem leads nesta automação.</p>
          ) : (
            <div className="space-y-6">
              {typedLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-zinc-800 bg-black p-4"
                >
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {lead.name || "Lead sem nome"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                        {lead.instagram ? (
                          <span>
                            Instagram:{" "}
                            <span className="text-zinc-300">{lead.instagram}</span>
                          </span>
                        ) : null}

                        {lead.phone ? (
                          <span>
                            Telefone:{" "}
                            <span className="text-zinc-300">{lead.phone}</span>
                          </span>
                        ) : null}

                        {lead.channel ? (
                          <span>
                            Canal:{" "}
                            <span className="text-zinc-300">{lead.channel}</span>
                          </span>
                        ) : null}

                        {lead.updated_at ? (
                          <span>
                            Atualizado:{" "}
                            <span className="text-zinc-300">
                              {new Date(lead.updated_at).toLocaleString()}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {lead.pipeline_stage ? (
                        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                          {lead.pipeline_stage}
                        </span>
                      ) : null}

                      <span
                        className={`rounded-full border px-3 py-1 text-xs uppercase ${getLeadStatusClasses(
                          lead.status || lead.ai_status
                        )}`}
                      >
                        {lead.status || lead.ai_status || "new"}
                      </span>
                    </div>
                  </div>

                  <LeadConversation
                    history={lead.ai_history}
                    stage={lead.ai_stage}
                    status={lead.ai_status}
                    pipelineStage={lead.pipeline_stage}
                  />

                  {lead.ai_reply ? (
                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Última resposta da IA
                      </p>
                      <p className="text-sm text-zinc-200">{lead.ai_reply}</p>
                    </div>
                  ) : null}

                  {lead.ai_next_action ? (
                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Próxima ação da IA
                      </p>
                      <p className="text-sm text-zinc-300">{lead.ai_next_action}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}