import Link from "next/link";

type SuccessPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function SuccessPage({ params }: SuccessPageProps) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-[#050505] text-white px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex rounded-full border border-green-500/20 bg-green-500/10 px-4 py-1 text-sm text-green-300">
          Pagamento confirmado
        </div>

        <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
          Tudo certo. O teu plano foi ativado.
        </h1>

        <p className="mt-5 text-base leading-7 text-white/65 md:text-lg">
          Recebemos o teu pagamento com sucesso. A tua conta está a ser
          atualizada e já deves conseguir voltar à plataforma para continuar a
          criar e gerir as tuas automações.
        </p>

        <div className="mt-10 grid gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-left md:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-white">
              Acesso desbloqueado
            </p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              O teu plano deve ficar ativo assim que o webhook concluir a
              atualização no sistema.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-white">
              Próximo passo
            </p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Volta à app e testa a criação da tua próxima automação para
              confirmar que o acesso está liberado.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-white">
              Programa Fundadores
            </p>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Se entraste nesta fase especial, já fazes parte do grupo inicial
              com a melhor condição de entrada disponível agora.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href={`/${locale}/dashboard`}
            className="rounded-2xl bg-white px-6 py-3 font-medium text-black transition hover:bg-neutral-200"
          >
            Ir para o dashboard
          </Link>

          <Link
            href={`/${locale}/projects/new`}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-medium text-white transition hover:bg-white/10"
          >
            Criar automação
          </Link>
        </div>

        <p className="mt-8 text-sm text-white/40">
          Se o acesso não aparecer imediatamente, espera alguns segundos e volta
          a entrar na app.
        </p>
      </div>
    </div>
  );
}