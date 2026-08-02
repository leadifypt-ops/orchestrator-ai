"use client";

import { useActionState } from "react";
import type { RecoveryActionState } from "./actions";

const initialState: RecoveryActionState = { status: "idle", message: "" };

export default function RecoveryExecutionForm({
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
        I understand this moves only provenance-backed reservations and reservation guests. The source remains merged, aliases and profiles remain unchanged, and the historical merge audit is preserved.
      </label>
      <label className="block text-sm text-zinc-300">
        Type RECOVERY to execute
        <input name="confirmation" autoComplete="off" required pattern="RECOVERY" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-white outline-none focus:border-red-400/50" />
      </label>
      <button type="submit" disabled={pending} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {pending ? "Executing..." : "Execute provenance-backed recovery"}
      </button>
      {state.message ? <p className={state.status === "success" ? "text-sm text-emerald-300" : "text-sm text-red-300"} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    </form>
  );
}
