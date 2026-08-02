"use client";

import { useActionState } from "react";
import { initialGuestFormState, submitCommunicationPreferences, submitGuestNotes, type GuestFormState } from "./actions";

const field = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-500";
function Feedback({ state }: { state: GuestFormState }) { return state.message ? <p aria-live="polite" className={state.status === "error" ? "text-sm text-red-700" : "text-sm text-emerald-800"}>{state.message}</p> : null; }
export function GuestConfirmationForms({ token, language = "en" }: { token: string; language?: "pt" | "en" }) {
  const [preferenceState, preferenceAction, preferencePending] = useActionState(submitCommunicationPreferences, initialGuestFormState);
  const [notesState, notesAction, notesPending] = useActionState(submitGuestNotes, initialGuestFormState);
  return <div lang={language} className="grid gap-6 lg:grid-cols-2">
    <form action={preferenceAction} className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><input type="hidden" name="token" value={token}/><div><p className="text-xs uppercase tracking-[0.18em] text-stone-500">Communication</p><h2 className="mt-2 font-serif text-2xl text-stone-900">Your preferences</h2><p className="mt-2 text-sm leading-6 text-stone-600">Tell the restaurant how you prefer to be contacted about this reservation. This does not subscribe you to marketing.</p></div>
      <label className="block text-sm text-stone-700">Preferred channel<select name="preferred_channel" className={field}><option value="email">Email</option><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select></label>
      <label className="block text-sm text-stone-700">Preferred language<select name="preferred_language" className={field}><option value="en">English</option><option value="pt">Português</option></select></label>
      <label className="flex items-start gap-3 text-sm leading-6 text-stone-700"><input type="checkbox" name="can_contact_about_reservation" value="yes" defaultChecked className="mt-1"/>The restaurant may contact me about this reservation.</label><Feedback state={preferenceState}/><button disabled={preferencePending} className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{preferencePending ? "Sending…" : "Save preferences"}</button>
    </form>
    <form action={notesAction} className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><input type="hidden" name="token" value={token}/><div><p className="text-xs uppercase tracking-[0.18em] text-stone-500">Before your visit</p><h2 className="mt-2 font-serif text-2xl text-stone-900">Need to update something?</h2><p className="mt-2 text-sm leading-6 text-stone-600">Your notes will be reviewed by the restaurant team. They do not automatically alter your reservation.</p></div>
      <GuestTextarea name="allergies_dietary_note" label="Allergies or dietary restrictions" maxLength={2000}/><GuestTextarea name="special_occasion_note" label="Special occasion" maxLength={1000}/><GuestTextarea name="arrival_accessibility_note" label="Arrival or accessibility note" maxLength={2000}/><GuestTextarea name="general_note" label="Anything else the team should know" maxLength={2000}/><Feedback state={notesState}/><button disabled={notesPending} className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{notesPending ? "Sending…" : "Send update for review"}</button>
    </form>
  </div>;
}
function GuestTextarea({name,label,maxLength}:{name:string;label:string;maxLength:number}){return <label className="block text-sm text-stone-700">{label}<textarea name={name} maxLength={maxLength} rows={3} className={field}/></label>}
