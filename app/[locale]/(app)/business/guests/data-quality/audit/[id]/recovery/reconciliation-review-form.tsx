"use client";

import { useActionState } from "react";
import type { RecoveryActionState } from "./actions";

const initialState: RecoveryActionState = { status: "idle", message: "" };

export default function ReconciliationReviewForm({
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
      <label className="block text-sm text-zinc-300">
        Review status
        <select name="review_status" defaultValue="pending" className="mt-1 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-white">
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="requires_follow_up">Requires Follow-up</option>
        </select>
      </label>
      <label className="block text-sm text-zinc-300">
        Review notes
        <textarea name="notes" maxLength={2000} rows={4} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-amber-400/50" placeholder="Record operational findings or follow-up ownership." />
      </label>
      <button type="submit" disabled={pending} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60">
        {pending ? "Recording..." : "Record review status"}
      </button>
      {state.message ? <p className={state.status === "success" ? "text-sm text-emerald-300" : "text-sm text-red-300"} role={state.status === "success" ? "status" : "alert"}>{state.message}</p> : null}
    </form>
  );
}
