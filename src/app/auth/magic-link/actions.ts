"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Dev-only demo shortcut: sign in as a seeded account without the magic-link
 * round-trip (which, with no SMTP configured, only prints the link to the
 * server console). Mints a database session directly and sets the Auth.js
 * session cookie; the session callback then links the seeded domain `users`
 * row by email, so the account keeps its caseworker role.
 *
 * Hard-guarded to non-production — never wire a credential-free login in prod.
 */
async function devSignInAs(email: string, redirectTo: string): Promise<never> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev sign-in is disabled in production");
  }

  // Ensure the NextAuth user exists (the seed creates the domain `users` row,
  // but the auth `User` row only appears on first real sign-in).
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, emailVerified: new Date() },
    select: { id: true },
  });

  // Database session strategy: the cookie value IS the session token (no
  // hashing), so creating the row + setting the cookie is a complete login.
  const sessionToken = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  const cookieStore = await cookies();
  cookieStore.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires,
  });

  redirect(redirectTo);
}

/** Dev-only: one-click sign-in as the seeded caseworker for demos. */
export async function devSignInAsCaseworker(): Promise<void> {
  await devSignInAs("caseworker@bridge.local", "/dashboard");
}

export async function requestMagicLink(formData: FormData) {
  const emailRaw = formData.get("email");
  const nameRaw = formData.get("name");
  const email = (typeof emailRaw === "string" ? emailRaw : "")
    .trim()
    .toLowerCase();
  const name = (typeof nameRaw === "string" ? nameRaw : "").trim();

  if (!email) {
    throw new Error("Email is required");
  }

  // Capture the display name on the NextAuth User row so it's available the
  // first time they verify. The domain `users` row is created by
  // events.createUser after verification succeeds.
  if (name) {
    await db.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });
  }

  // Land on the role-aware dispatcher, which forwards to /account or /admin.
  await signIn("nodemailer", { email, redirectTo: "/dashboard" });
}
