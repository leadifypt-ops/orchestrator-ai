type ProjectPageProps = {
  params: Promise<{
    id: string;
    locale: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Local Business Lead Engine</h1>
        <p className="mt-2 text-gray-400">Project ID: {id}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Prompt</h2>
        <p className="mt-2 text-gray-300">No prompt received</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Business Type</h2>
        <p className="mt-2 text-gray-300">Local Business</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Goal</h2>
        <p className="mt-2 text-gray-300">
          Capture leads from Instagram and send to WhatsApp
        </p>
      </div>
    </div>
  );
}