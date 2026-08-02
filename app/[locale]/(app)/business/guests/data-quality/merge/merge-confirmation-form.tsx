"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { GuestDataQualityActionState } from "../actions";

const initialState: GuestDataQualityActionState = {
  status: "idle",
  message: "",
};

export default function MergeConfirmationForm({
  action,
  targetName,
  targetHref,
}: {
  action: (
    state: GuestDataQualityActionState,
    formData: FormData
  ) => Promise<GuestDataQualityActionState>;
  targetName: string;
  targetHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.status === "success") {
    return (
      <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
        <p className="text-sm text-emerald-300" role="status">
          {state.message}
        </p>
        <Link
          href={targetHref}
          className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Open consolidated destination
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-300">
        <input name="reviewed" type="checkbox" className="mt-1" required />
        I reviewed the source, destination, conflicts, and visit impact. I
        understand that the destination “{targetName}” remains the principal
        identity.
      </label>
      <label className="block text-sm text-zinc-300">
        Type MERGE to confirm
        <input
          name="confirmation"
          autoComplete="off"
          required
          pattern="MERGE"
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-white outline-none focus:border-red-400/50"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Merging..." : "Merge identities"}
      </button>
      {state.message ? (
        <p className="text-sm text-red-300" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
