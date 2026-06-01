import { requireRolePage } from "~/server/auth/page-guards";

import { CatalogManager } from "./catalog-manager";

export default async function AdminCatalogPage() {
  await requireRolePage(["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Programs &amp; questions
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage the benefit catalog and the screener questions residents
          answer.
        </p>
      </div>
      <CatalogManager />
    </div>
  );
}
