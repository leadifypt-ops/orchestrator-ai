import { redirect } from "next/navigation";

type NewProjectPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function NewProjectPage({ params }: NewProjectPageProps) {
  const { locale } = await params;

  redirect(`/${locale}/restaurants/new`);
}
