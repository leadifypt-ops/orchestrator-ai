import Link from "next/link";

export default async function AvailabilityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div>
      <div className="px-6 pt-6">
        <Link
          href={`/${locale}/business/availability/calendar`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-4 text-sm text-emerald-100 hover:bg-emerald-400/[0.1]"
        >
          <span>
            <strong>Service calendar & projection</strong>
            <span className="ml-2 text-emerald-200/60">
              Operational calendar, existing reservations and informational capacity.
            </span>
          </span>
          <span aria-hidden="true">Open →</span>
        </Link>
      </div>
      {children}
    </div>
  );
}
