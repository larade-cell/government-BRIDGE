import { PageContainer, PageHeader } from "~/components/ui/page";
import { requireRolePage } from "~/server/auth/page-guards";

import { CatalogManager } from "./catalog-manager";

export default async function AdminCatalogPage() {
  await requireRolePage(["admin"]);

  return (
    <PageContainer>
      <PageHeader
        title="Programs & questions"
        description="Manage the benefit catalog and the screener questions residents answer."
      />
      <CatalogManager />
    </PageContainer>
  );
}
