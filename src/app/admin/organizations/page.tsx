import { PageContainer, PageHeader } from "~/components/ui/page";
import { requireRolePage } from "~/server/auth/page-guards";

import { OrganizationsManager } from "./organizations-manager";

export default async function AdminOrganizationsPage() {
  await requireRolePage(["admin"]);

  return (
    <PageContainer>
      <PageHeader
        title="Organizations"
        description="Community partners residents can be referred to. Used by the referral flow."
      />
      <OrganizationsManager />
    </PageContainer>
  );
}
