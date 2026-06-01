import { notFound } from "next/navigation";

import { getLocale } from "~/i18n/server";
import { api, HydrateClient } from "~/trpc/server";
import { Questionnaire } from "./questionnaire";

export default async function ScreeningPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  // Validate session exists before rendering; surfaces NOT_FOUND as 404.
  try {
    await api.screeningSession.byId({ id: sessionId });
  } catch {
    notFound();
  }

  // Prefetch so the client component renders without a loading flash, in the
  // active locale (must match the language_code the client query uses).
  const language_code = await getLocale();
  void api.question.list.prefetch({ language_code });
  void api.screeningSession.byId.prefetch({ id: sessionId });

  return (
    <HydrateClient>
      <Questionnaire sessionId={sessionId} />
    </HydrateClient>
  );
}
