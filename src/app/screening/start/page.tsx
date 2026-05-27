import { redirect } from "next/navigation";

import { api } from "~/trpc/server";

export default async function ScreeningStartPage() {
  const session = await api.screeningSession.create({ preferred_language: "en" });
  redirect(`/screening/${session.id}`);
}
