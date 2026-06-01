import { Card, CardContent } from "~/components/ui/card";
import { PageContainer, PageHeader } from "~/components/ui/page";
import { getI18n } from "~/i18n/server";
import { api } from "~/trpc/server";

import { DocumentsManager } from "../documents-manager";

export default async function AccountDocumentsPage() {
  const [{ t }, sessions] = await Promise.all([
    getI18n(),
    api.screeningSession.listMine(),
  ]);
  const latestCompleted = sessions.find((s) => s.completed_at);

  return (
    <PageContainer>
      <PageHeader title={t.account.documentsTitle} />
      {latestCompleted ? (
        <DocumentsManager sessionId={latestCompleted.id} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t.account.completeToSeeDocs}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
