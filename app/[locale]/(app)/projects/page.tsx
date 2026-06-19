import { redirect } from "next/navigation";

type ProjectsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const { locale } = await params;

  redirect(`/${locale}/restaurants`);
}
