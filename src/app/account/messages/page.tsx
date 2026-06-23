import { PageContainer, PageHeader } from "~/components/ui/page";
import { getI18n } from "~/i18n/server";

import { CaseworkerChat } from "./caseworker-chat";

export default async function MessagesPage() {
  const { t } = await getI18n();
  return (
    <PageContainer>
      <PageHeader
        title={t.account.messagesTitle}
        description={t.account.messagesLead}
      />
      <CaseworkerChat />
    </PageContainer>
  );
}
