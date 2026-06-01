import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { landingPathForRole } from "~/server/auth/page-guards";

/**
 * Post-sign-in landing. Routes each user to the right home by role:
 * staff (caseworker/admin) → /admin, everyone else → /account. The magic-link
 * flow redirects here so a single sign-in serves both views.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/magic-link");
  redirect(landingPathForRole(session.user.role));
}
