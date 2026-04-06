type Props = {
  run: any;
};

export default function ExecutionResult({ run }: Props) {
  const output = run?.output || run?.result;

  if (!output) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="text-sm text-zinc-400 mb-3">
        Resultado inteligente
      </h3>

      <div className="grid gap-3 text-sm">
        {output.automation && (
          <div>
            <span className="text-zinc-500">Automação</span>
            <p>{output.automation}</p>
          </div>
        )}

        {output.goal && (
          <div>
            <span className="text-zinc-500">Objetivo</span>
            <p>{output.goal}</p>
          </div>
        )}

        {output.channel && (
          <div>
            <span className="text-zinc-500">Canal</span>
            <p>{output.channel}</p>
          </div>
        )}

        {output.nextAction && (
          <div>
            <span className="text-zinc-500">Próxima ação</span>
            <p>{output.nextAction}</p>
          </div>
        )}
      </div>
    </div>
  );
}