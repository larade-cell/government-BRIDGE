import { redirect } from "next/navigation";

import { getLocale } from "~/i18n/server";
import { api } from "~/trpc/server";

export default async function ScreeningStartPage() {
  const preferred_language = await getLocale();
  const session = await api.screeningSession.create({ preferred_language });
  redirect(`/screening/${session.id}`);
}
