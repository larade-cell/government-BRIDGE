/**
 * Promote (or demote) a user to a role, keyed by email.
 *
 *   npx tsx scripts/set-role.ts <email> <resident|navigator|caseworker|admin>
 *
 * Upserts the domain `users` row, so it works whether or not the person has
 * signed in yet — on their next magic-link sign-in the NextAuth account links
 * to this row by email (see auth/config.ts createUser) and the role sticks.
 */
import { PrismaClient } from "../generated/prisma/client";

const ROLES = ["resident", "navigator", "caseworker", "admin"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [emailArg, roleArg] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const role = roleArg?.trim() as Role | undefined;

  if (!email || !role) {
    console.error(
      "Usage: tsx scripts/set-role.ts <email> <resident|navigator|caseworker|admin>",
    );
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const db = new PrismaClient();
  try {
    const user = await db.users.upsert({
      where: { email },
      update: { role },
      create: { email, role, preferred_language: "en" },
      select: { id: true, email: true, role: true, auth_user_id: true },
    });
    console.log(
      `✓ ${user.email} is now "${user.role}"` +
        (user.auth_user_id
          ? ""
          : " (not signed in yet — role applies on first magic-link sign-in)"),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
