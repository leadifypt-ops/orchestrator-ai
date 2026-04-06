import { createClient } from "@/lib/supabase/server";
import LeadsBoard from "./leads-board";

export const dynamic = "force-dynamic";

export type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  source: string | null;
  service: string | null;
  status: string | null;
  value?: number | null;
  created_at: string | null;
};

export type LeadMetrics = {
  total: number;
  contacted: number;
  qualified: number;
  booked: number;
  closed: number;
  lost: number;
  conversionRate: number;
  closedRevenue: number;
  avgTicket: number;

  today: number;
  week: number;
  month: number;
  revenueMonth: number;
};

export default async function LeadsPage() {
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

  const closedLeads = safeLeads.filter((l) => l.status === "closed");

  const closedRevenue = closedLeads.reduce(
    (sum, lead) => sum + (Number(lead.value) || 0),
    0
  );

  const avgTicket =
    closedLeads.length > 0
      ? Math.round(closedRevenue / closedLeads.length)
      : 0;

  const now = new Date();

  const today = safeLeads.filter((lead) => {
    if (!lead.created_at) return false;
    const d = new Date(lead.created_at);
    return d.toDateString() === now.toDateString();
  }).length;

  const week = safeLeads.filter((lead) => {
    if (!lead.created_at) return false;
    const d = new Date(lead.created_at);
    const diff = now.getTime() - d.getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const month = safeLeads.filter((lead) => {
    if (!lead.created_at) return false;
    const d = new Date(lead.created_at);
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }).length;

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
    .reduce((sum, l) => sum + (Number(l.value) || 0), 0);

  const metrics: LeadMetrics = {
    total: safeLeads.length,
    contacted: safeLeads.filter((l) => l.status === "contacted").length,
    qualified: safeLeads.filter((l) => l.status === "qualified").length,
    booked: safeLeads.filter((l) => l.status === "booked").length,
    closed: safeLeads.filter((l) => l.status === "closed").length,
    lost: safeLeads.filter((l) => l.status === "lost").length,
    conversionRate:
      safeLeads.length > 0
        ? Math.round((closedLeads.length / safeLeads.length) * 100)
        : 0,
    closedRevenue,
    avgTicket,

    today,
    week,
    month,
    revenueMonth,
  };

  return <LeadsBoard leads={safeLeads} metrics={metrics} />;
}