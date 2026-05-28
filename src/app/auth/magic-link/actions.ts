"use server";

import { signIn } from "~/server/auth";
import { db } from "~/server/db";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();

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

  await signIn("nodemailer", { email, redirectTo: "/" });
}
