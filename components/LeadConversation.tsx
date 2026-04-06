type Message = {
  role: "lead" | "assistant";
  content: string;
};

type LeadConversationProps = {
  history?: Message[] | null;
  stage?: string | null;
  status?: string | null;
  pipelineStage?: string | null;
};

export default function LeadConversation({
  history,
  stage,
  status,
  pipelineStage,
}: LeadConversationProps) {
  const messages = Array.isArray(history) ? history : [];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-200">Conversa da lead</p>

        <div className="flex flex-wrap gap-2">
          {pipelineStage ? (
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
              Pipeline: {pipelineStage}
            </span>
          ) : null}

          {stage ? (
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
              IA: {stage}
            </span>
          ) : null}

          {status ? (
            <span
              className={`rounded-full px-3 py-1 text-xs ${
                status === "booked"
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : status === "lost"
                  ? "border border-red-500/30 bg-red-500/10 text-red-300"
                  : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {status}
            </span>
          ) : null}
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500">Sem conversa disponível.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`flex ${
                msg.role === "assistant" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "assistant"
                    ? "bg-zinc-800 text-zinc-100"
                    : "bg-white text-black"
                }`}
              >
                <p className="mb-1 text-[10px] uppercase tracking-[0.2em] opacity-60">
                  {msg.role === "assistant" ? "IA" : "Lead"}
                </p>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}