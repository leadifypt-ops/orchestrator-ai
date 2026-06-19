"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ReservationInternalNote = {
  id: string;
  reservation_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

type InternalNotesPanelProps = {
  reservationId: string;
  initialNotes: ReservationInternalNote[];
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InternalNotesPanel({
  reservationId,
  initialNotes,
}: InternalNotesPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function addNote() {
    const cleanNote = note.trim();

    if (!cleanNote || saving) return;

    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: noteError } = await supabase
      .from("reservation_internal_notes")
      .insert({
        reservation_id: reservationId,
        note: cleanNote,
        created_by: user?.id || null,
      });

    if (noteError) {
      setMessage(noteError.message);
      setSaving(false);
      return;
    }

    const { error: timelineError } = await supabase
      .from("reservation_timeline_events")
      .insert({
        reservation_id: reservationId,
        event_type: "internal_note",
        event_label: "Internal note added",
        event_description: cleanNote,
        created_by: user?.id || null,
      });

    if (timelineError) {
      setMessage(timelineError.message);
      setSaving(false);
      return;
    }

    setNote("");
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
        Internal notes
      </h2>

      <div className="mt-4 space-y-3">
        {initialNotes.length ? (
          initialNotes.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-black/30 p-3"
            >
              <p className="text-sm leading-6 text-zinc-300">{item.note}</p>
              <p className="mt-2 text-xs text-zinc-600">
                {formatDateTime(item.created_at)}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-3 text-sm text-zinc-500">
            No internal notes yet
          </div>
        )}
      </div>

      <div className="mt-4">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
          placeholder="Add a private note for the restaurant team"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">
            Adding a note also creates a timeline event.
          </p>
          <button
            type="button"
            onClick={addNote}
            disabled={saving || !note.trim()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add note"}
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-400">{message}</p> : null}
    </section>
  );
}
