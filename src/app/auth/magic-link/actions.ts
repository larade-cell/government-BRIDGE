"use server";

import { signIn } from "~/server/auth";
import { db } from "~/server/db";

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
