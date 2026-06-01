import { requireRolePage } from "~/server/auth/page-guards";

import { RuleManager } from "./rule-manager";

export default async function AdminRulesPage() {
  // Defense in depth: the nav hides this from caseworkers, and the page
  // enforces admin-only directly (the tRPC procedures do too).
  await requireRolePage(["admin"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Eligibility rules</h1>
        <p className="mt-1 text-muted-foreground">
          Version-controlled rules drive the screening engine. New versions are
          drafts until published; publishing closes the previous live version.
        </p>
      </div>
      <RuleManager />
    </div>
  );
}
