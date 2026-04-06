import { createClient as createAdminClient } from "@supabase/supabase-js";
import ManychatPanel from "../../../../../components/integrations/manychat-panel";

type PageProps = {
  searchParams?: Promise<{
    automationId?: string;
  }>;
};

export default async function ManychatIntegrationPage({
  searchParams,
}: PageProps) {
  const params = (await searchParams) || {};
  const automationId = params.automationId || "";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const secret =
    process.env.LEADS_WEBHOOK_SECRET ||
    process.env.RUNNER_SECRET ||
    process.env.DISPATCH_SECRET ||
    "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  let automation: {
    id: string;
    name: string | null;
    status: string | null;
    prompt: string | null;
  } | null = null;

  if (automationId && supabaseUrl && serviceRoleKey) {
    const supabase = createAdminClient(supabaseUrl, serviceRoleKey);

    const { data } = await supabase
      .from("automations")
      .select("id, name, status, prompt")
      .eq("id", automationId)
      .maybeSingle();

    automation = data;
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">
            Integrações
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            ManyChat
          </h1>

          <p className="mt-3 max-w-3xl text-sm text-zinc-600">
            Esta página centraliza a ligação do ManyChat à tua app.
            Aqui tens tudo pronto para copiar, testar e usar sem
            andares a procurar endpoint, secret ou body manualmente.
          </p>
        </div>

        <ManychatPanel
          appUrl={appUrl}
          secret={secret}
          automationId={automationId}
          automationName={automation?.name || ""}
          automationStatus={automation?.status || ""}
        />
      </div>
    </div>
  );
}