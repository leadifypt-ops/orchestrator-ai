import Link from "next/link";

const sections = [
  ["Overview", ""],
  ["Calendar & projection", "/calendar"],
  ["Operational review", "/review"],
  ["Service periods", "/service-periods"],
  ["Capacity", "/capacity"],
  ["Areas", "/areas"],
  ["Exceptions", "/exceptions"],
] as const;

export function AvailabilityNavigation({ locale }: { locale: string }) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      {sections.map(([label, suffix]) => (
        <Link
          key={label}
          href={`/${locale}/business/availability${suffix}`}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AvailabilityHeader({ locale }: { locale: string }) {
  return <>
    <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Reservation operations</p>
      <h1 className="mt-2 text-3xl font-semibold">Capacity & availability</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        Configure operational inputs for human reservation review. These settings do not confirm, reject, or block any reservation.
      </p>
    </header>
    <AvailabilityNavigation locale={locale} />
  </>;
}
