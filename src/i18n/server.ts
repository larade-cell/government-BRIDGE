import "server-only";

import { cookies } from "next/headers";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { en, type Messages } from "./messages/en";
import { es } from "./messages/es";

const CATALOG: Record<Locale, Messages> = { en, es };

/**
 * Resolve the active locale: an explicit cookie choice wins; otherwise a
 * signed-in user's saved preference; otherwise the default. The DB is only
 * touched when there's no cookie yet (first visit after sign-in).
 */
export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const session = await auth();
  if (session?.user.appUserId) {
    const user = await db.users.findUnique({
      where: { id: session.user.appUserId },
      select: { preferred_language: true },
    });
    if (isLocale(user?.preferred_language)) return user.preferred_language;
  }
  return DEFAULT_LOCALE;
}

export function getMessages(locale: Locale): Messages {
  return CATALOG[locale];
}

/** Convenience for server components: `const { locale, t } = await getI18n();` */
export async function getI18n(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await getLocale();
  return { locale, t: CATALOG[locale] };
}
