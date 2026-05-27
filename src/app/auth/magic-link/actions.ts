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

  await db.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name: name || null },
  });

  await signIn("nodemailer", { email, redirectTo: "/" });
}
