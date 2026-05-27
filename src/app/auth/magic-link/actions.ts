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

  const user = await db.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name: name || null },
  });

  // Mirror into the domain `users` table so FKs from the rest of the schema work.
  await db.users.upsert({
    where: { id: user.id },
    update: { email },
    create: { id: user.id, email },
  });

  await signIn("nodemailer", { email, redirectTo: "/" });
}
