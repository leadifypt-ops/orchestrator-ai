import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GuestConfirmation } from "@/lib/guest-confirmation";
import { guestConfirmationCopy } from "@/lib/guest-confirmation-copy";
import { GuestConfirmationForms } from "./guest-confirmation-forms";

export const dynamic = "force-dynamic";
export default async function GuestConfirmationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const language = query.lang === "pt" ? "pt" : "en", copy = guestConfirmationCopy[language];
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_guest_confirmation", { p_token: token });
  const confirmation = (data?.[0] || null) as GuestConfirmation | null;
  if (error || !confirmation) notFound();
  const date = confirmation.reservation_date ? new Intl.DateTimeFormat(language === "pt" ? "pt-PT" : "en", { dateStyle: "long" }).format(new Date(`${confirmation.reservation_date}T12:00:00`)) : copy.pending;
  return <main className="min-h-screen bg-[#f6f3ed] px-5 py-12 text-stone-900"><div className="mx-auto max-w-5xl space-y-8">
    <header className="text-center"><div className="mb-5 flex justify-center gap-3 text-xs"><a href="?lang=en" className={language==="en"?"text-stone-900 underline":"text-stone-500"}>EN</a><a href="?lang=pt" className={language==="pt"?"text-stone-900 underline":"text-stone-500"}>PT</a></div><p className="text-xs uppercase tracking-[0.3em] text-stone-500">{confirmation.restaurant_name}</p><h1 className="mt-5 font-serif text-4xl sm:text-5xl">{copy.headline}</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stone-600">{copy.intro}</p></header>
    <section className="grid gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200 sm:grid-cols-4"><Detail label={copy.guest} value={confirmation.guest_display_name || copy.guest}/><Detail label={copy.date} value={date}/><Detail label={copy.time} value={confirmation.reservation_time?.slice(0,5) || copy.pending}/><Detail label={copy.party} value={confirmation.party_size ? `${confirmation.party_size} ${copy.guests}` : copy.pending}/></section>
    <GuestConfirmationForms token={token}/><footer className="rounded-2xl border border-stone-200 p-6 text-center text-sm leading-6 text-stone-600"><p className="font-medium text-stone-800">For urgent changes</p><p className="mt-1">{confirmation.change_instructions}</p>{confirmation.restaurant_phone||confirmation.restaurant_email?<p className="mt-2">{[confirmation.restaurant_phone,confirmation.restaurant_email].filter(Boolean).join(" · ")}</p>:null}</footer>
  </div></main>;
}
function Detail({label,value}:{label:string;value:string}){return <div className="bg-white p-5 text-center"><p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p><p className="mt-2 font-medium">{value}</p></div>}
