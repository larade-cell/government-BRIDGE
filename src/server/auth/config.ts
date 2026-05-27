import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "~/server/db";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
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
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
  },
  events: {
    // Mirror NextAuth's User into the domain `users` table on first sign-up,
    // reusing the same UUID so downstream domain tables can FK to it.
    createUser: async ({ user }) => {
      if (!user.id || !user.email) return;
      await db.users.upsert({
        where: { id: user.id },
        update: { email: user.email },
        create: { id: user.id, email: user.email },
      });
    },
  },
} satisfies NextAuthConfig;
