import { redirect } from "next/navigation";

type ProjectPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { locale } = await params;

  redirect(`/${locale}/restaurants`);
}
