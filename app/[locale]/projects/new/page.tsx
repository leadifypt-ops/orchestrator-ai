export default function NewProjectPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">
        Create Project
      </h1>

      <textarea
        className="w-full h-40 bg-zinc-900 border border-white/10 rounded-lg p-4"
        placeholder="Create an automation for Instagram..."
      />

      <button className="mt-4 bg-white text-black px-6 py-3 rounded-lg">
        Generate
      </button>
    </div>
  )
}