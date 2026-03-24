import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="mt-2 text-gray-400">
            Manage your AI automation projects
          </p>
        </div>

        <Link
          href="/en/projects/new"
          className="rounded-xl bg-white px-4 py-2 font-semibold text-black"
        >
          + Create Project
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
        <p className="text-gray-400">
          No projects yet. Create your first automation project.
        </p>
      </div>
    </div>
  );
}