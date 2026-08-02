"use client";

import { useActionState } from "react";
import type { GuestDataQualityActionState } from "./actions";

const initialState: GuestDataQualityActionState = {
  status: "idle",
  message: "",
};

type Field = {
  name: string;
  label: string;
  value: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
};

export default function DataQualityForm({
  action,
  fields,
  submitLabel,
}: {
  action: (
    state: GuestDataQualityActionState,
    formData: FormData
  ) => Promise<GuestDataQualityActionState>;
  fields: Field[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {fields.map((field) => (
        <label key={field.name} className="block text-sm text-zinc-300">
          {field.label}
          {field.type === "textarea" ? (
            <textarea
              name={field.name}
              defaultValue={field.value}
              rows={4}
              required={field.required}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
            />
          ) : (
            <input
              name={field.name}
              defaultValue={field.value}
              type={field.type || "text"}
              required={field.required}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
            />
          )}
        </label>
      ))}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>

      {state.message ? (
        <p
          className={`text-sm ${
            state.status === "error" ? "text-red-300" : "text-emerald-300"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
