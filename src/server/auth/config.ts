import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "~/server/db";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      appUserId: string | null;
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
        select: { id: true },
      });
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          appUserId: appUser?.id ?? null,
        },
      };
    },
  },
  events: {
    // Create a matching domain `users` row on first sign-up. The two tables have
    // independent IDs, linked via users.auth_user_id (unique FK to User.id).
    createUser: async ({ user }) => {
      if (!user.id || !user.email) return;
      await db.users.upsert({
        where: { auth_user_id: user.id },
        update: { email: user.email },
        create: { auth_user_id: user.id, email: user.email },
      });
    },
  },
} satisfies NextAuthConfig;
