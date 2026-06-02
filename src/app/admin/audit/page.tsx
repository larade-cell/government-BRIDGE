import { PageContainer, PageHeader } from "~/components/ui/page";
import { requireRolePage } from "~/server/auth/page-guards";

import { AuditLog } from "./audit-log";

export default async function AdminAuditPage() {
  await requireRolePage(["admin"]);

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="A record of sensitive actions — rule publishing, catalog and knowledge-base edits, and case changes — with who did what and when."
      />
      <AuditLog />
    </PageContainer>
  );
}
