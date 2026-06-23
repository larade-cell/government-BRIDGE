import { PageContainer, PageHeader } from "~/components/ui/page";

import { MessagesCenter } from "./messages-center";

export default function AdminMessagesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Messages"
        description="Your conversations with assigned residents. Replies are sent straight to their account."
      />
      <MessagesCenter />
    </PageContainer>
  );
}
