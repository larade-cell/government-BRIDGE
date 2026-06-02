import { PageContainer, PageHeader } from "~/components/ui/page";
import { requireRolePage } from "~/server/auth/page-guards";

import { KnowledgeManager } from "./knowledge-manager";

export default async function AdminKnowledgePage() {
  await requireRolePage(["admin"]);

  return (
    <PageContainer>
      <PageHeader
        title="Knowledge base"
        description="Sources the eligibility chatbot retrieves and cites. Saving a source re-embeds it so the assistant can use it immediately."
      />
      <KnowledgeManager />
    </PageContainer>
  );
}
