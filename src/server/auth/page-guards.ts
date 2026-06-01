import "server-only";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { type AppRole } from "~/server/auth/config";

/** Roles considered staff (admin console access). */
export const STAFF_ROLES: AppRole[] = ["caseworker", "admin"];

/**
 * Server-component guard: require any signed-in user. Redirects to sign-in
 * otherwise. The returned session has a non-null `user`.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/auth/magic-link");
  return session;
}

/**
 * Server-component guard: require one of `roles`. Unauthenticated users go to
 * sign-in; authenticated users without the role are bounced to their own
 * dashboard rather than shown a dead end.
 */
export async function requireRolePage(roles: AppRole[]) {
  const session = await auth();
  if (!session?.user) redirect("/auth/magic-link");
  const role = session.user.role;
  if (!role || !roles.includes(role)) redirect("/account");
  return { session, role };
}

/** Where a freshly signed-in user should land, based on their role. */
export function landingPathForRole(role: AppRole | null): string {
  return role && STAFF_ROLES.includes(role) ? "/admin" : "/account";
}
