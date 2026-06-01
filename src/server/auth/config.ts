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
      const appUser = await db.users.findUnique({
        where: { auth_user_id: user.id },
        select: { id: true, role: true },
      });
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
  events: {
    // Link (or create) the domain `users` row on first sign-up. The two tables
    // have independent IDs, linked via users.auth_user_id (unique FK to
    // User.id). We link by email first so a pre-seeded or promoted account
    // (e.g. a demo admin created before they ever signed in) keeps its role
    // instead of colliding on the unique email or being recreated as a
    // default-role resident.
    createUser: async ({ user }) => {
      if (!user.id || !user.email) return;
      const existing = await db.users.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      if (existing) {
        await db.users.update({
          where: { id: existing.id },
          data: { auth_user_id: user.id },
        });
        return;
      }
      await db.users.create({
        data: { auth_user_id: user.id, email: user.email },
      });
    },
  },
} satisfies NextAuthConfig;
