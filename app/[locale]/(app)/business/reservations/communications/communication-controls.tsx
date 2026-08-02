"use client";

import { useActionState, useRef } from "react";
import { communicationChannels, communicationStatusClass, communicationStatusLabel, type ReservationCommunication } from "@/lib/reservation-communication";
import { cancelCommunication, createConfirmationDraft, initialCommunicationState, markCommunicationReady, markCommunicationSent, updateCommunicationDraft, type CommunicationActionState } from "./actions";

const field = "mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
function Feedback({ state }: { state: CommunicationActionState }) {
  return state.message ? <p aria-live="polite" className={state.status === "error" ? "text-sm text-red-300" : "text-sm text-emerald-300"}>{state.message}</p> : null;
}
export function CreateConfirmationDraft({ reservationId, locale }: { reservationId: string; locale: string }) {
  const [state, action, pending] = useActionState(createConfirmationDraft, initialCommunicationState);
  return <form action={action} className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_1fr_auto]">
    <input type="hidden" name="reservation_id" value={reservationId} />
    <label className="text-xs text-zinc-500">Channel<select name="channel" className={field}>{communicationChannels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    <label className="text-xs text-zinc-500">Language<select name="language" defaultValue={locale === "pt" ? "pt" : "en"} className={field}><option value="en">English</option><option value="pt">Português</option></select></label>
    <div className="flex items-end"><button disabled={pending} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{pending ? "Creating..." : "Create confirmation draft"}</button></div>
    <div className="md:col-span-3"><Feedback state={state} /></div>
  </form>;
}

function ConfirmationDialog({ title, communication, action, reason }: { title: string; communication: ReservationCommunication; action: (state: CommunicationActionState, data: FormData) => Promise<CommunicationActionState>; reason?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(action, initialCommunicationState);
  return <><button type="button" onClick={() => ref.current?.showModal()} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5">{title}</button>
    <dialog ref={ref} className="m-auto w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-950 p-0 text-white backdrop:bg-black/80"><form action={formAction} className="space-y-4 p-6">
      <input type="hidden" name="communication_id" value={communication.id} /><input type="hidden" name="reservation_id" value={communication.reservation_id} />
      <h3 className="text-xl font-semibold">Confirm: {title}</h3><p className="text-sm text-zinc-400">This is a human-recorded action. No email, SMS, WhatsApp, or other provider will be called.</p>
      {reason ? <label className="block text-xs text-zinc-500">Reason (mandatory)<textarea name="reason" required maxLength={2000} className={field} /></label> : null}
      <Feedback state={state} /><div className="flex justify-end gap-2"><button type="button" onClick={() => ref.current?.close()} className="rounded-lg border border-white/10 px-4 py-2 text-sm">Back</button><button disabled={pending} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{pending ? "Saving..." : "Confirm"}</button></div>
    </form></dialog></>;
}

export function CommunicationCard({ communication }: { communication: ReservationCommunication }) {
  const [state, updateAction, pending] = useActionState(updateCommunicationDraft, initialCommunicationState);
  const editable = communication.status === "draft" || communication.status === "ready";
  return <article className="rounded-xl border border-white/10 bg-black/25 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium capitalize">{communication.communication_type.replaceAll("_", " ")} · {communication.channel}</p><p className="mt-1 text-xs text-zinc-500">Updated {new Date(communication.updated_at).toLocaleString()}</p></div><span className={`rounded-full border px-3 py-1 text-xs ${communicationStatusClass(communication.status)}`}>{communicationStatusLabel(communication.status)}</span></div>
    {editable ? <form action={updateAction} className="mt-4 space-y-3"><input type="hidden" name="communication_id" value={communication.id} /><input type="hidden" name="reservation_id" value={communication.reservation_id} />
      <label className="block text-xs text-zinc-500">Channel<select name="channel" defaultValue={communication.channel} className={field}>{communicationChannels.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="block text-xs text-zinc-500">Subject<input name="subject" defaultValue={communication.subject || ""} maxLength={300} className={field} /></label>
      <label className="block text-xs text-zinc-500">Message<textarea name="body" defaultValue={communication.body} required maxLength={10000} rows={9} className={field} /></label>
      <Feedback state={state} /><button disabled={pending} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5">{pending ? "Saving..." : "Save draft"}</button>
    </form> : <div className="mt-4 whitespace-pre-wrap rounded-lg border border-white/5 bg-black/30 p-4 text-sm leading-6 text-zinc-300"><p className="mb-2 font-medium text-white">{communication.subject}</p>{communication.body}</div>}
    <div className="mt-4 flex flex-wrap gap-2">{communication.status === "draft" ? <ConfirmationDialog title="Mark ready" communication={communication} action={markCommunicationReady} /> : null}{editable ? <ConfirmationDialog title="Mark sent" communication={communication} action={markCommunicationSent} /> : null}{editable || communication.status === "failed" ? <ConfirmationDialog title="Cancel communication" communication={communication} action={cancelCommunication} reason /> : null}</div>
    {communication.note ? <p className="mt-3 text-sm text-zinc-400"><span className="text-zinc-500">Reason:</span> {communication.note}</p> : null}
  </article>;
}
