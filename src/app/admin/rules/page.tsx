import { PageContainer, PageHeader } from "~/components/ui/page";
import { requireRolePage } from "~/server/auth/page-guards";

import { RuleManager } from "./rule-manager";

export default async function AdminRulesPage() {
  // Defense in depth: the nav hides this from caseworkers, and the page
  // enforces admin-only directly (the tRPC procedures do too).
  await requireRolePage(["admin"]);

  return (
    <PageContainer>
      <PageHeader
        title="Eligibility rules"
        description="Version-controlled rules drive the screening engine. New versions are drafts until published; publishing closes the previous live version."
      />
      <RuleManager />
    </PageContainer>
  );
}
