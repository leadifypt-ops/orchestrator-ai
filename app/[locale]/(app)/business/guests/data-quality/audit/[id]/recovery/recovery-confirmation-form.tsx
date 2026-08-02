"use client";

import { useActionState } from "react";
import type { RecoveryActionState } from "./actions";

const initialState: RecoveryActionState = { status: "idle", message: "" };

export default function RecoveryConfirmationForm({
  action,
}: {
  action: (
    state: RecoveryActionState,
    formData: FormData
  ) => Promise<RecoveryActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-300">
        <input name="reviewed" type="checkbox" className="mt-1" required />
        I reviewed the merge audit, alias contacts, and recovery limitations. I understand this only records a governed recovery review; it does not undo the merge or move data.
      </label>
      <label className="block text-sm text-zinc-300">
        Type RECOVERY to confirm the governed review
        <input name="confirmation" autoComplete="off" required pattern="RECOVERY" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-white outline-none focus:border-amber-400/50" />
      </label>
      <button type="submit" disabled={pending} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-medium text-black disabled:opacity-60">
        {pending ? "Recording..." : "Record governed recovery review"}
      </button>
      {state.message ? <p className={state.status === "success" ? "text-sm text-emerald-300" : "text-sm text-red-300"} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    </form>
  );
}
