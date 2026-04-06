"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lead, LeadMetrics } from "./page";

const STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "booked", label: "Booked" },
  { id: "closed", label: "Closed" },
  { id: "lost", label: "Lost" },
];

type UpdatingMap = Record<string, boolean>;
type ValueMap = Record<string, string>;

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

export default function LeadsBoard({
  leads,
  metrics,
}: {
  leads: Lead[];
  metrics: LeadMetrics;
}) {
  const router = useRouter();

  const [updatingStatus, setUpdatingStatus] = useState<UpdatingMap>({});
  const [updatingValue, setUpdatingValue] = useState<UpdatingMap>({});
  const [draftValues, setDraftValues] = useState<ValueMap>({});

  useEffect(() => {
    const nextValues: ValueMap = {};

    for (const lead of leads) {
      nextValues[lead.id] =
        typeof lead.value === "number" && !Number.isNaN(lead.value)
          ? String(lead.value)
          : "";
    }

    setDraftValues(nextValues);
  }, [leads]);

  const grouped = STATUSES.reduce((acc, status) => {
    acc[status.id] = leads.filter((lead) => (lead.status ?? "new") === status.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  const leads7d = useMemo(() => getLast7DaysLeads(leads), [leads]);
  const revenue6m = useMemo(() => getLast6MonthsRevenue(leads), [leads]);

  const maxLeads = Math.max(...leads7d.map((d) => d.count), 1);
  const maxRevenue = Math.max(...revenue6m.map((d) => d.value), 1);

  async function updateLeadStatus(leadId: string, status: string) {
    try {
      setUpdatingStatus((prev) => ({ ...prev, [leadId]: true }));

      const response = await fetch("/api/leads/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.error || "Erro ao atualizar status.");
        return;
      }

      router.refresh();
    } catch {
      alert("Erro inesperado ao atualizar lead.");
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [leadId]: false }));
    }
  }

  async function updateLeadValue(leadId: string) {
    try {
      const rawValue = draftValues[leadId] ?? "";
      const normalizedValue = rawValue.trim();

      setUpdatingValue((prev) => ({ ...prev, [leadId]: true }));

      const response = await fetch("/api/leads/update-value", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId,
          value: normalizedValue === "" ? null : normalizedValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data?.error || "Erro ao atualizar valor.");
        return;
      }

      router.refresh();
    } catch {
      alert("Erro inesperado ao atualizar valor.");
    } finally {
      setUpdatingValue((prev) => ({ ...prev, [leadId]: false }));
    }
  }

  const metricCards = [
    { label: "Leads", value: metrics.total },
    { label: "Hoje", value: metrics.today },
    { label: "7 Dias", value: metrics.week },
    { label: "Este Mês", value: metrics.month },
    { label: "Booked", value: metrics.booked },
    { label: "Closed", value: metrics.closed },
    { label: "Receita", value: formatEuro(metrics.closedRevenue) },
    { label: "Receita Mês", value: formatEuro(metrics.revenueMonth) },
    { label: "Ticket Médio", value: formatEuro(metrics.avgTicket) },
    { label: "Conversão", value: `${metrics.conversionRate}%` },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Leads
        </div>

        <h1 className="mt-1 text-2xl font-semibold text-white">
          Pipeline de Leads
        </h1>

        <p className="mt-1 text-sm text-neutral-400">
          Visualiza, atualiza status, adiciona valor e acompanha performance.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-10">
        {metricCards.map((card) => (
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

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-4">
            <div className="text-sm font-medium text-white">Leads últimos 7 dias</div>
            <div className="text-xs text-neutral-500">
              Quantidade de leads criadas por dia
            </div>
          </div>

          <div className="flex h-56 items-end gap-3">
            {leads7d.map((item) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs text-neutral-500">{item.count}</div>
                <div
                  className="w-full rounded-t-lg bg-white/20"
                  style={{
                    height: `${Math.max((item.count / maxLeads) * 180, 6)}px`,
                  }}
                />
                <div className="text-[11px] text-neutral-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-4">
            <div className="text-sm font-medium text-white">Receita últimos 6 meses</div>
            <div className="text-xs text-neutral-500">
              Soma das leads fechadas por mês
            </div>
          </div>

          <div className="flex h-56 items-end gap-3">
            {revenue6m.map((item) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs text-neutral-500">
                  {item.value > 0 ? `€${item.value}` : "€0"}
                </div>
                <div
                  className="w-full rounded-t-lg bg-white/20"
                  style={{
                    height: `${Math.max((item.value / maxRevenue) * 180, 6)}px`,
                  }}
                />
                <div className="text-[11px] text-neutral-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {STATUSES.map((status) => (
          <div
            key={status.id}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-white">
                {status.label}
              </div>

              <div className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-neutral-400">
                {grouped[status.id]?.length || 0}
              </div>
            </div>

            <div className="space-y-3">
              {grouped[status.id]?.length ? (
                grouped[status.id].map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-3"
                  >
                    <div className="font-medium text-white">
                      {lead.name || "Lead sem nome"}
                    </div>

                    {lead.phone ? (
                      <div className="mt-1 text-sm text-neutral-400">
                        📞 {lead.phone}
                      </div>
                    ) : null}

                    {lead.source ? (
                      <div className="mt-2 text-xs text-neutral-500">
                        Origem: {lead.source}
                      </div>
                    ) : null}

                    {lead.service ? (
                      <div className="mt-1 text-xs text-neutral-400">
                        Serviço: {lead.service}
                      </div>
                    ) : null}

                    {typeof lead.value === "number" ? (
                      <div className="mt-1 text-xs text-neutral-300">
                        Valor atual: {formatEuro(lead.value)}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-neutral-500">
                        Sem valor definido
                      </div>
                    )}

                    {lead.created_at ? (
                      <div className="mt-2 text-[11px] text-neutral-600">
                        {new Date(lead.created_at).toLocaleString("pt-PT")}
                      </div>
                    ) : null}

                    <div className="mt-3">
                      <select
                        value={lead.status ?? "new"}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        disabled={!!updatingStatus[lead.id]}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                      >
                        {STATUSES.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Valor €"
                        value={draftValues[lead.id] ?? ""}
                        onChange={(e) =>
                          setDraftValues((prev) => ({
                            ...prev,
                            [lead.id]: e.target.value,
                          }))
                        }
                        onBlur={() => updateLeadValue(lead.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            updateLeadValue(lead.id);
                          }
                        }}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => updateLeadValue(lead.id)}
                        disabled={!!updatingValue[lead.id]}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white"
                      >
                        {updatingValue[lead.id] ? "..." : "Guardar"}
                      </button>
                    </div>

                    {updatingStatus[lead.id] ? (
                      <div className="mt-2 text-xs text-neutral-500">
                        A atualizar status...
                      </div>
                    ) : null}

                    {updatingValue[lead.id] ? (
                      <div className="mt-2 text-xs text-neutral-500">
                        A guardar valor...
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-neutral-500">
                  Sem leads nesta coluna
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}