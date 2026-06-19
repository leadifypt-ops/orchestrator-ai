const CHANNELS = [
  {
    name: "WhatsApp",
    status: "Ready for setup",
    purpose:
      "Capture reservation requests, collect guest context, and send confirmation messages in the channel guests already use.",
  },
  {
    name: "Instagram DM",
    status: "Coming soon",
    purpose:
      "Turn direct messages into reservation requests and preserve guest context before the team confirms the dining experience.",
  },
  {
    name: "Website widget",
    status: "Ready for setup",
    purpose:
      "Give public restaurant pages a clear request entry point for tasting menus, wine pairing interest, and party details.",
  },
  {
    name: "Email",
    status: "Not connected",
    purpose:
      "Collect concierge and guest messages, then prepare confirmation follow-up and service or kitchen briefings.",
  },
];

const FEITORIA_STEPS = [
  {
    title: "Website reservation button",
    description:
      "Route public page visitors into a reservation request with guest, date, party size, occasion, and dietary context.",
  },
  {
    title: "WhatsApp confirmation flow",
    description:
      "Confirm the request, collect missing guest profile details, and keep the restaurant team aligned before service.",
  },
  {
    title: "Internal briefing before service",
    description:
      "Use saved gastronomic profile data to prepare service and kitchen briefing notes for the team.",
  },
];

function getStatusClasses(status: string) {
  if (status === "Ready for setup") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "Coming soon") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

export default function ChannelsPage() {
  return (
    <div className="space-y-6 p-6 text-white">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Channels
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Guest channel setup</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
          Configure the inbox paths that capture reservation requests, collect
          guest context, send confirmations, and prepare service or kitchen
          briefings for each dining experience.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CHANNELS.map((channel) => (
          <article
            key={channel.name}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
          >
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-xl font-semibold">{channel.name}</h2>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${getStatusClasses(
                    channel.status
                  )}`}
                >
                  {channel.status}
                </span>
              </div>

              <p className="text-sm leading-6 text-zinc-400">
                {channel.purpose}
              </p>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Recommended setup
          </p>
          <h2 className="text-2xl font-semibold">Feitoria V1</h2>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            Start with the minimum operational flow: a website entry point,
            WhatsApp confirmation, and a briefing handoff before service.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {FEITORIA_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-sm text-zinc-300">
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-zinc-500">
          Temporary plumbing
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          Existing ManyChat and WhatsApp code remains available behind the
          scenes, but this page does not deeply integrate those settings yet.
          The next step is to connect each channel to reservation requests and
          guest profile capture in Find Dining language.
        </p>
      </section>
    </div>
  );
}
