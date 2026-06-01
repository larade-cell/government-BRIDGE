"use server";

import { cookies } from "next/headers";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { isLocale, LOCALE_COOKIE } from "./config";

/**
 * Set the active locale. Writes a cookie (works for anonymous + signed-in) and,
 * for signed-in users, persists it to their account preference so it follows
 * them across devices. The caller refreshes the route to re-render in the new
 * language.
 */
export async function setLocale(locale: string) {
  const loc = isLocale(locale) ? locale : "en";
  (await cookies()).set(LOCALE_COOKIE, loc, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await auth();
  if (session?.user.appUserId) {
    try {
      await db.users.update({
        where: { id: session.user.appUserId },
        data: { preferred_language: loc },
      });
    } catch {
      // Best-effort; the cookie already drives the active locale.
    }
  }
}
