import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "~/server/db";

export type AppRole = "resident" | "navigator" | "caseworker" | "admin";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      appUserId: string | null;
      /** Domain role, or null until a domain user is linked. */
      role: AppRole | null;
    } & DefaultSession["user"];
  }
}

/**
 * Resolve the domain `users` row for a NextAuth user, linking by email or
 * creating it on first sign-in. Linking by email first means a pre-seeded or
 * promoted account (e.g. the demo admin) keeps its role rather than colliding
 * on the unique email or being recreated as a default-role resident.
 */
async function linkDomainUser(authUserId: string, email: string | null) {
  const byAuth = await db.users.findUnique({
    where: { auth_user_id: authUserId },
    select: { id: true, role: true },
  });
  if (byAuth || !email) return byAuth;

  const byEmail = await db.users.findUnique({
    where: { email },
    select: { id: true },
  });
  if (byEmail) {
    return db.users.update({
      where: { id: byEmail.id },
      data: { auth_user_id: authUserId },
      select: { id: true, role: true },
    });
  }
  return db.users.create({
    data: { auth_user_id: authUserId, email },
    select: { id: true, role: true },
  });
}

export const authConfig = {
  providers: [
    Nodemailer({
      from: process.env.EMAIL_FROM,
      // Stub transport — never actually used because sendVerificationRequest
      // is overridden below. Auth.js still requires `server` to be set.
      server: { jsonTransport: true },
      sendVerificationRequest: ({ identifier, url }) => {
        console.log("\n========== MAGIC LINK ==========");
        console.log(`To:   ${identifier}`);
        console.log(`Link: ${url}`);
        console.log("================================\n");
      },
    }),
  ],
  adapter: PrismaAdapter(db),
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    session: async ({ session, user }) => {
      // Reconcile the NextAuth user with its domain `users` row on every
      // session fetch. We can't rely on the createUser event alone: the
      // magic-link form pre-creates the NextAuth user (to capture a display
      // name), so on verification the adapter finds an existing user and
      // createUser never fires. Linking here is idempotent — it only writes
      // the first time, then matches by auth_user_id.
      const appUser = await linkDomainUser(user.id, user.email ?? null);
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          appUserId: appUser?.id ?? null,
          role: appUser?.role ?? null,
        },
      };
    },
  },
} satisfies NextAuthConfig;
