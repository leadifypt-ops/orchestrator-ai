"use client";

import { FormEvent, useState } from "react";

const slots = Array.from({ length: 13 }, (_, i) => { const m = 19 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; });
const choices = { allergies: ["Shellfish", "Fish", "Peanuts", "Tree nuts", "Egg", "Milk", "Sesame"], intolerances: ["Lactose", "Gluten", "Fructose", "Histamine"], dietary_restrictions: ["Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "No alcohol"] } as const;
type ListKey = keyof typeof choices;
type GuestProfile = { name: string; allergies: string[]; intolerances: string[]; dietary_restrictions: string[]; dislikes: string; wine_preference: string; notes: string; reviewed: boolean };
const emptyGuest = (): GuestProfile => ({ name: "", allergies: [], intolerances: [], dietary_restrictions: [], dislikes: "", wine_preference: "", notes: "", reviewed: false });

function GuestCard({ guest, index, update }: { guest: GuestProfile; index: number; update: (guest: GuestProfile) => void }) {
  const text = (key: "name" | "dislikes" | "wine_preference" | "notes", value: string) => update({ ...guest, [key]: value, reviewed: false });
  const toggle = (key: ListKey, value: string) => update({ ...guest, [key]: guest[key].includes(value) ? guest[key].filter((item) => item !== value) : [...guest[key], value], reviewed: false });
  return <article className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
    <div className="flex items-center justify-between"><div><p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#d8c16f]">Guest {index + 1}</p><h4 className="mt-2 text-xl font-light">Individual preferences</h4></div>{index === 0 ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.15em] text-white/40">Host</span> : null}</div>
    <label className="mt-6 block text-sm text-white/65">Name <span className="text-white/30">(optional)</span><input className={inputClasses} value={guest.name} onChange={(e) => text("name", e.target.value)} maxLength={160} placeholder={`Guest ${index + 1}`} /></label>
    {(Object.keys(choices) as ListKey[]).map((key) => <div className="mt-6" key={key}><p className="text-sm capitalize text-white/65">{key.replace("_", " ")}</p><div className="mt-3 flex flex-wrap gap-2">{choices[key].map((value) => { const selected = guest[key].includes(value); return <button aria-pressed={selected} className={`rounded-full border px-3 py-2 text-xs transition ${selected ? "border-[#d8c16f] bg-[#d8c16f]/15 text-[#eadb9f]" : "border-white/10 text-white/45 hover:border-white/30 hover:text-white"}`} key={value} onClick={() => toggle(key, value)} type="button">{value}</button>; })}</div></div>)}
    <div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="text-sm text-white/65">Dislikes <span className="text-white/30">(optional)</span><input className={inputClasses} value={guest.dislikes} onChange={(e) => text("dislikes", e.target.value)} maxLength={1000} placeholder="Ingredients or flavours" /></label><label className="text-sm text-white/65">Wine preference <span className="text-white/30">(optional)</span><input className={inputClasses} value={guest.wine_preference} onChange={(e) => text("wine_preference", e.target.value)} maxLength={2000} placeholder="Styles, regions, or alcohol-free" /></label><label className="text-sm text-white/65 sm:col-span-2">Notes <span className="text-white/30">(optional)</span><textarea className={`${inputClasses} min-h-24 resize-y`} value={guest.notes} onChange={(e) => text("notes", e.target.value)} maxLength={2000} placeholder="Context for the kitchen or service team" /></label></div>
    <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/65"><input checked={guest.reviewed} className="mt-1 size-4 accent-[#d8c16f]" onChange={(e) => update({ ...guest, reviewed: e.target.checked })} required type="checkbox" />I have reviewed this guest profile, including any allergy information.</label>
  </article>;
}

const inputClasses =
  "mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#d8c16f]/60 focus:bg-white/[0.055]";

type SubmissionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export default function ReservationRequestForm({
  restaurantSlug,
}: {
  restaurantSlug: string;
}) {
  const [state, setState] = useState<SubmissionState>({ status: "idle", message: "" });
  const [pending, setPending] = useState(false);
  const [partySize, setPartySize] = useState(2);
  const [guests, setGuests] = useState<GuestProfile[]>([emptyGuest(), emptyGuest()]);

  function changePartySize(size: number) {
    setPartySize(size);
    setGuests((current) => Array.from({ length: size }, (_, index) => current[index] ?? emptyGuest()));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ status: "idle", message: "" });

    const payload = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const response = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, party_size: partySize, guest_profiles: guests, restaurant_slug: restaurantSlug }),
      });
      const result: unknown = await response.json();
      const message =
        result && typeof result === "object" && "message" in result
          ? String(result.message)
          : "We could not submit your request. Please try again.";

      setState({ status: response.ok ? "success" : "error", message });
    } catch {
      setState({
        status: "error",
        message: "We could not submit your request. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  if (state.status === "success") {
    return (
      <div
        className="mt-10 rounded-3xl border border-[#d8c16f]/25 bg-[#d8c16f]/[0.07] p-6 sm:p-8"
        role="status"
      >
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[#d8c16f]">
          Request received
        </p>
        <h3 className="mt-4 text-3xl font-light">Thank you.</h3>
        <p className="mt-4 text-sm leading-7 text-white/60">{state.message}</p>
        <p className="mt-4 text-sm leading-7 text-white/45">
          This request is pending review and does not confirm availability or a table.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-10 space-y-10" onSubmit={handleSubmit}>
      <fieldset disabled={pending}>
        <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          1. Reservation Details
        </legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-white/65 sm:col-span-2">
            Name
            <input className={inputClasses} name="name" type="text" autoComplete="name" maxLength={160} placeholder="Your full name" required />
          </label>
          <label className="text-sm text-white/65">
            Email
            <input className={inputClasses} name="email" type="email" autoComplete="email" maxLength={320} placeholder="you@example.com" required />
          </label>
          <label className="text-sm text-white/65">
            Phone <span className="text-white/30">(optional)</span>
            <input className={inputClasses} name="phone" type="tel" autoComplete="tel" maxLength={50} placeholder="+351 900 000 000" />
          </label>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <label className="text-sm text-white/65">
            Preferred date
            <input className={inputClasses} name="requested_date" type="date" required />
          </label>
          <label className="text-sm text-white/65">
            Preferred time
            <select className={inputClasses} name="requested_time" defaultValue="" required><option value="" disabled>Select a time</option>{slots.map((slot) => <option className="bg-[#11110e]" key={slot} value={slot}>{slot}</option>)}</select>
          </label>
          <label className="text-sm text-white/65">
            Number of guests
            <select className={inputClasses} value={partySize} onChange={(event) => changePartySize(Number(event.target.value))}>{Array.from({ length: 20 }, (_, index) => index + 1).map((size) => <option className="bg-[#11110e]" key={size} value={size}>{size}</option>)}</select>
          </label>
        </div>
      </fieldset>

      <fieldset className="border-t border-white/10 pt-9" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">2. Guest Profiles</legend>
        <p className="mt-4 text-sm leading-7 text-white/50">Profile details are optional. Reviewing every guest profile is required.</p>
        <div className="mt-6 space-y-5">{guests.map((guest, index) => <GuestCard guest={guest} index={index} key={index} update={(next) => setGuests((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} />)}</div>
        <p className="mt-4 text-xs leading-5 text-white/30">Medical handling and cross-contamination requirements must be confirmed directly with the restaurant.</p>
      </fieldset>

      <fieldset className="border-t border-white/10 pt-9" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">4. Experience Context</legend>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-white/65">Occasion <span className="text-white/30">(optional)</span><input className={inputClasses} name="occasion" type="text" maxLength={200} placeholder="Anniversary, birthday" /></label>
          <label className="text-sm text-white/65 sm:col-span-2">Special request <span className="text-white/30">(optional)</span><textarea className={`${inputClasses} min-h-28 resize-y`} name="special_request" maxLength={2000} placeholder="Anything the restaurant should consider for this request." /></label>
          <label className="text-sm text-white/65 sm:col-span-2">Experience notes <span className="text-white/30">(optional)</span><textarea className={`${inputClasses} min-h-28 resize-y`} name="experience_notes" maxLength={2000} placeholder="Context that could help personalise your visit." /></label>
        </div>
      </fieldset>

      <div className="border-t border-white/10 pt-7">
        {state.status === "error" ? <p className="mb-4 text-sm text-red-300" role="alert">{state.message}</p> : null}
        <button type="submit" disabled={pending} className="w-full rounded-full bg-[#dfc86f] px-8 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#11100d] transition hover:bg-white disabled:cursor-wait disabled:opacity-60 sm:w-auto">
          {pending ? "Submitting..." : "Submit Reservation Request"}
        </button>
        <p className="mt-4 max-w-xl text-xs leading-6 text-white/40">Submitting creates a request for restaurant review. It does not confirm availability or a table.</p>
      </div>
    </form>
  );
}
