import { requireRolePage, STAFF_ROLES } from "~/server/auth/page-guards";

import { CaseQueue } from "./case-queue";

export default async function AdminCasesPage() {
  const { session } = await requireRolePage(STAFF_ROLES);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Cases</h1>
        <p className="mt-1 text-muted-foreground">
          Residents request help from their results; new cases land here.
          Caseworkers claim and work them.
        </p>
      </div>
      <CaseQueue currentUserId={session.user.appUserId} />
    </div>
  );
}
