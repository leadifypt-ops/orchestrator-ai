"use client";

import { FormEvent, useState } from "react";

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState({ status: "idle", message: "" });

    const payload = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const response = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, restaurant_slug: restaurantSlug }),
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
            <input className={inputClasses} name="requested_time" type="time" required />
          </label>
          <label className="text-sm text-white/65">
            Number of guests
            <input className={inputClasses} name="party_size" type="number" min="1" max="20" placeholder="2" required />
          </label>
        </div>
      </fieldset>

      <fieldset className="border-t border-white/10 pt-9" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          2. Dietary Profile
        </legend>
        <p className="mt-4 text-sm leading-7 text-white/50">Everything in this section is optional.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-white/65">Allergies <input className={inputClasses} name="allergies" type="text" maxLength={1000} placeholder="Shellfish, nuts" /></label>
          <label className="text-sm text-white/65">Intolerances <input className={inputClasses} name="intolerances" type="text" maxLength={1000} placeholder="Lactose, gluten" /></label>
          <label className="text-sm text-white/65">Dietary Restrictions <input className={inputClasses} name="dietary_restrictions" type="text" maxLength={1000} placeholder="Vegetarian, halal" /></label>
          <label className="text-sm text-white/65">Food Dislikes <input className={inputClasses} name="dislikes" type="text" maxLength={1000} placeholder="Strong blue cheese" /></label>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/30">Separate multiple items with commas. Medical handling requires direct confirmation with the restaurant.</p>
      </fieldset>

      <fieldset className="border-t border-white/10 pt-9" disabled={pending}>
        <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">3. Wine Preferences</legend>
        <label className="mt-5 block text-sm text-white/65">
          Wine Preferences <span className="text-white/30">(optional)</span>
          <textarea className={`${inputClasses} min-h-28 resize-y`} name="wine_preferences" maxLength={2000} placeholder="Styles, regions, pairing preferences, or non-alcoholic pairing." />
        </label>
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
