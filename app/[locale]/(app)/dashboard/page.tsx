import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  service: string | null;
  status: string | null;
  value: number | null;
  created_at: string | null;
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getLast7DaysLeads(leads: Lead[]) {
  const now = new Date();
  const days: { label: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);

    const label = day.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
    });

    const count = leads.filter((lead) => {
      if (!lead.created_at) return false;
      const d = new Date(lead.created_at);
      return d.toDateString() === day.toDateString();
    }).length;

    days.push({ label, count });
  }

  return days;
}

function getLast6MonthsRevenue(leads: Lead[]) {
  const now = new Date();
  const months: { label: string; value: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);

    const label = monthDate.toLocaleDateString("pt-PT", {
      month: "short",
    });

    const value = leads
      .filter((lead) => {
        if (!lead.created_at) return false;
        if (lead.status !== "closed") return false;

        const d = new Date(lead.created_at);

        return (
          d.getMonth() === monthDate.getMonth() &&
          d.getFullYear() === monthDate.getFullYear()
        );
      })
      .reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

    months.push({ label, value });
  }

  return months;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads = [] } = await supabase
    .from("leads")
    .select("id, name, phone, source, service, status, value, created_at")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false });

  const safeLeads = (leads as Lead[]) ?? [];
  const now = new Date();

  const leadsToday = safeLeads.filter((lead) => {
    if (!lead.created_at) return false;
    return new Date(lead.created_at).toDateString() === now.toDateString();
  }).length;

  const leadsWeek = safeLeads.filter((lead) => {
    if (!lead.created_at) return false;
    const diff = now.getTime() - new Date(lead.created_at).getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const leadsMonth = safeLeads.filter((lead) => {
    if (!lead.created_at) return false;
    const d = new Date(lead.created_at);
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }).length;

  const contacted = safeLeads.filter((lead) => lead.status === "contacted").length;
  const qualified = safeLeads.filter((lead) => lead.status === "qualified").length;
  const booked = safeLeads.filter((lead) => lead.status === "booked").length;
  const closed = safeLeads.filter((lead) => lead.status === "closed").length;

  const closedRevenue = safeLeads
    .filter((lead) => lead.status === "closed")
    .reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

  const revenueMonth = safeLeads
    .filter((lead) => {
      if (!lead.created_at) return false;
      if (lead.status !== "closed") return false;

      const d = new Date(lead.created_at);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

  const avgTicket =
    closed > 0 ? Math.round(closedRevenue / closed) : 0;

  const conversionRate =
    safeLeads.length > 0 ? Math.round((closed / safeLeads.length) * 100) : 0;

  const recentLeads = safeLeads.slice(0, 6);

  const leads7d = getLast7DaysLeads(safeLeads);
  const revenue6m = getLast6MonthsRevenue(safeLeads);

  const maxLeads = Math.max(...leads7d.map((d) => d.count), 1);
  const maxRevenue = Math.max(...revenue6m.map((d) => d.value), 1);

  const topCards = [
    { label: "Leads Hoje", value: leadsToday },
    { label: "7 Dias", value: leadsWeek },
    { label: "Este Mês", value: leadsMonth },
    { label: "Receita Mês", value: formatEuro(revenueMonth) },
    { label: "Booked", value: booked },
    { label: "Closed", value: closed },
    { label: "Ticket Médio", value: formatEuro(avgTicket) },
    { label: "Conversão", value: `${conversionRate}%` },
  ];

  const pipelineCards = [
    { label: "Contacted", value: contacted },
    { label: "Qualified", value: qualified },
    { label: "Booked", value: booked },
    { label: "Closed", value: closed },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Dashboard
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Visão geral do negócio
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Acompanha leads, receita, conversão e evolução da automação num só sítio.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/pt/leads"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
          >
            Ver Pipeline
          </Link>

          <Link
            href="/pt/automations"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
          >
            Ver Automações
          </Link>

          <Link
            href="/pt/pricing"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white"
          >
            Ver Plano
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        {topCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 xl:col-span-2">
          <div className="mb-4">
            <div className="text-sm font-medium text-white">Leads últimos 7 dias</div>
            <div className="text-xs text-neutral-500">
              Quantidade de leads criadas por dia
            </div>
          </div>

          <div className="flex h-64 items-end gap-3">
            {leads7d.map((item) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs text-neutral-500">{item.count}</div>
                <div
                  className="w-full rounded-t-xl bg-white/20"
                  style={{
                    height: `${Math.max((item.count / maxLeads) * 200, 8)}px`,
                  }}
                />
                <div className="text-[11px] text-neutral-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-4">
            <div className="text-sm font-medium text-white">Resumo do pipeline</div>
            <div className="text-xs text-neutral-500">
              Estado atual das leads
            </div>
          </div>

          <div className="space-y-3">
            {pipelineCards.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="text-sm text-neutral-300">{item.label}</div>
                <div className="text-lg font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>

          <Link
            href="/pt/leads"
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm text-white"
          >
            Abrir pipeline completo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 xl:col-span-2">
          <div className="mb-4">
            <div className="text-sm font-medium text-white">Receita últimos 6 meses</div>
            <div className="text-xs text-neutral-500">
              Soma das leads fechadas por mês
            </div>
          </div>

          <div className="flex h-64 items-end gap-3">
            {revenue6m.map((item) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs text-neutral-500">
                  {item.value > 0 ? formatEuro(item.value) : "€0"}
                </div>
                <div
                  className="w-full rounded-t-xl bg-white/20"
                  style={{
                    height: `${Math.max((item.value / maxRevenue) * 200, 8)}px`,
                  }}
                />
                <div className="text-[11px] text-neutral-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-4">
            <div className="text-sm font-medium text-white">Leads recentes</div>
            <div className="text-xs text-neutral-500">
              Últimas entradas no sistema
            </div>
          </div>

          <div className="space-y-3">
            {recentLeads.length ? (
              recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <div className="font-medium text-white">
                    {lead.name || "Lead sem nome"}
                  </div>

                  {lead.phone ? (
                    <div className="mt-1 text-sm text-neutral-400">
                      📞 {lead.phone}
                    </div>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                    <span>{lead.status || "new"}</span>
                    <span>
                      {lead.created_at
                        ? new Date(lead.created_at).toLocaleDateString("pt-PT")
                        : "-"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-neutral-500">
                Ainda sem leads recentes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}