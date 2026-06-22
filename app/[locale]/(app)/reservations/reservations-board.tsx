"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { ReservationMetrics, ReservationRequest } from "./page";

const CANONICAL_STATUS_LABELS: Record<string, string> = {
  pending: "New request",
  reviewing: "Awaiting confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Service completed",
};

function getStatusLabel(status?: string | null) {
  return CANONICAL_STATUS_LABELS[String(status || "")] || "New request";
}

function getStatusClasses(status?: string | null) {
  const value = String(status || "new").toLowerCase();

  if (
    value === "booked" ||
    value === "converted" ||
    value === "closed" ||
    value === "confirmed" ||
    value === "completed"
  ) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (
    value === "qualified" ||
    value === "contacted" ||
    value === "active" ||
    value === "reviewing"
  ) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  if (value === "lost" || value === "declined" || value === "cancelled") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function formatDateTime(value?: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getContactChannel(request: ReservationRequest) {
  return request.source || "Unknown channel";
}

function getExperienceName(request: ReservationRequest) {
  return (
    request.service ||
    request.restaurant_name ||
    request.restaurant ||
    "Dining experience to confirm"
  );
}

function getRequestedSlot(request: ReservationRequest) {
  if (request.requested_date && request.requested_time) {
    return `${request.requested_date} at ${request.requested_time}`;
  }

  return request.requested_date || request.requested_time || "Not specified";
}

function getNoShowRisk(request: ReservationRequest) {
  if (["lost", "declined", "cancelled"].includes(request.status || "")) {
    return "High";
  }
  if (
    !request.email &&
    !request.phone
  ) {
    return "Medium";
  }
  return "Low";
}

export default function ReservationsBoard({
  requests,
  metrics,
}: {
  requests: ReservationRequest[];
  metrics: ReservationMetrics;
}) {
  const params = useParams();
  const locale = String(params.locale || "pt");
  const [selectedRequestId, setSelectedRequestId] = useState(
    requests[0]?.id || ""
  );

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const metricCards = [
    { label: "Reservation requests", value: metrics.total },
    { label: "Today", value: metrics.today },
    { label: "7 days", value: metrics.week },
    { label: "New requests", value: metrics.newRequests },
    { label: "Awaiting confirmation", value: metrics.awaitingConfirmation },
    { label: "Confirmed interest", value: metrics.confirmedInterest },
    { label: "Confirmed", value: metrics.confirmed },
    { label: "No-show risk", value: metrics.noShowRisk },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Reservations
        </div>

        <h1 className="mt-2 text-3xl font-semibold text-white">
          Reservation request board
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
          Review guest requests, prepare the service briefing, confirm dining
          experiences, and keep an eye on no-show risk before the guest arrives.
        </p>

        <div className="mt-5">
          <Link
            href={`/${locale}/business/reservations/new`}
            className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
          >
            Create reservation request
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="text-xs uppercase tracking-[0.15em] text-neutral-500">
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          {requests.length ? (
            requests.map((request) => (
              <article
                key={request.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold text-white">
                        {request.name || "Unnamed guest"}
                      </h2>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${getStatusClasses(
                          request.status
                        )}`}
                      >
                        {getStatusLabel(request.status)}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-500">
                        Canonical
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm text-zinc-400 sm:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          Source
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {getContactChannel(request)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          Guest email
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {request.email || "Not specified"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          Experience
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {getExperienceName(request)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          Party size
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {request.party_size || "Not specified"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          Requested date/time
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {getRequestedSlot(request)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          Occasion
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {request.occasion || "Not specified"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                          No-show risk
                        </p>
                        <p className="mt-1 text-zinc-300">
                          {getNoShowRisk(request)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                        Service briefing
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {request.service_briefing ||
                          request.message ||
                          "No dietary notes or briefing details captured yet."}
                      </p>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-3 lg:w-56">
                    <Link
                      href={`/${locale}/business/reservations/${request.id}`}
                      onMouseEnter={() => setSelectedRequestId(request.id)}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                    >
                      Review request
                    </Link>

                    <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">
                      Canonical status is read-only in this version.
                    </p>

                    <p className="text-xs text-zinc-600">
                      Received{" "}
                      {formatDateTime(request.created_at) || "date unavailable"}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8">
              <h2 className="text-xl font-semibold text-white">
                No reservation requests yet
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                New guest requests from connected channels will appear here for
                confirmation and service briefing preparation.
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Request review
          </p>

          {selectedRequest ? (
            <div className="mt-4 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {selectedRequest.name || "Unnamed guest"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {getStatusLabel(selectedRequest.status)}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                    Guest contact
                  </p>
                  <p className="mt-1 text-zinc-300">
                    {selectedRequest.email ||
                      selectedRequest.phone ||
                      "No contact detail captured"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                    Dining experience
                  </p>
                  <p className="mt-1 text-zinc-300">
                    {getExperienceName(selectedRequest)}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                    Service briefing
                  </p>
                  <p className="mt-1 text-zinc-300">
                    {selectedRequest.service_briefing ||
                      selectedRequest.message ||
                      "Not provided"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-600">
                    Occasion
                  </p>
                  <p className="mt-1 text-zinc-300">
                    {selectedRequest.occasion || "Not provided"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              Select a reservation request to prepare the service briefing.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
