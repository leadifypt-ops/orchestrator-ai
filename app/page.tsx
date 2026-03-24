import Link from 'next/link';
import {useTranslations} from 'next-intl';

export default function HomePage() {
  const t = useTranslations('HomePage');

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold mb-6">{t('title')}</h1>
        <p className="text-xl text-gray-300 mb-8">{t('subtitle')}</p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/en/login"
            className="rounded-2xl bg-white px-6 py-3 text-black font-semibold"
          >
            {t('login')}
          </Link>

          <Link
            href="/en/signup"
            className="rounded-2xl border border-white px-6 py-3 font-semibold"
          >
            {t('signup')}
          </Link>
        </div>
      </div>
    </main>
  );
}