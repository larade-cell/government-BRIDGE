import { PageContainer, PageHeader } from "~/components/ui/page";
import { requireRolePage, STAFF_ROLES } from "~/server/auth/page-guards";

import { CaseQueue } from "./case-queue";

export default async function AdminCasesPage() {
  const { session } = await requireRolePage(STAFF_ROLES);

  return (
    <PageContainer>
      <PageHeader
        title="Cases"
        description="Residents request help from their results; new cases land here. Caseworkers claim and work them."
      />
      <CaseQueue currentUserId={session.user.appUserId} />
    </PageContainer>
  );
}
