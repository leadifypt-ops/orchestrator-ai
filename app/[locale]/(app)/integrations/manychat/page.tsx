import ManychatPanel from "../../../../../components/integrations/manychat-panel";

export default function ManychatIntegrationPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const secret =
    process.env.LEADS_WEBHOOK_SECRET ||
    process.env.RUNNER_SECRET ||
    process.env.DISPATCH_SECRET ||
    "";

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
          </p>
        </div>

        <ManychatPanel appUrl={appUrl} secret={secret} />
      </div>
    </div>
  );
}