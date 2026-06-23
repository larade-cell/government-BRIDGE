import Link from "next/link";
import { notFound } from "next/navigation";

import { Brand } from "~/components/ui/brand";
import { ArrowLeftIcon } from "~/components/ui/icons";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { getI18n } from "~/i18n/server";
import { api } from "~/trpc/server";

import { RequestHelp } from "./request-help";
import { ResultsList } from "./results-list";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { locale, t } = await getI18n();

  try {
    await api.screeningSession.byId({ id: sessionId });
  } catch {
    notFound();
  }

  // Run eligibility on visit. Idempotent — the upsert keys on (session, program).
  await api.eligibility.run({ session_id: sessionId });
  const results = await api.eligibilityResult.list({
    session_id: sessionId,
    language_code: locale,
  });

  return (
    <main
      id="main-content"
      className="brand-gradient flex min-h-screen flex-col items-center px-4 py-8 text-white sm:py-12"
    >
      <div className="mb-8 flex w-full max-w-2xl items-center justify-between gap-3">
        <Brand href="/" />
        <LocaleToggle variant="dark" />
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center duration-500 animate-in fade-in slide-in-from-bottom-3">
          <h1 className="mb-3 font-heading text-3xl font-bold sm:text-4xl">
            {t.results.title}
          </h1>
          <p className="text-white/70">{t.results.subtitle}</p>
        </div>

        {results.length === 0 ? (
          <p className="text-center text-white/70">{t.results.noMatch}</p>
        ) : (
          <ResultsList sessionId={sessionId} results={results} />
        )}

        {results.length > 0 && (
          <div className="mt-8">
            <RequestHelp sessionId={sessionId} />
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded border-2 border-white/40 bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
          >
            <ArrowLeftIcon className="size-5" />
            {t.results.backHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
