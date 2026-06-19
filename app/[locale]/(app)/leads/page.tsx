import { redirect } from "next/navigation";

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

type LeadsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function LeadsPage({ params }: LeadsPageProps) {
  const { locale } = await params;

  redirect(`/${locale}/reservations`);
}
