import { PageContainer, PageHeader } from "~/components/ui/page";
import { getI18n } from "~/i18n/server";
import { api } from "~/trpc/server";

import { DeleteAccount } from "../delete-account";
import { ProfileForm } from "../profile-form";

export default async function AccountProfilePage() {
  const [{ t }, me] = await Promise.all([getI18n(), api.user.me()]);

  return (
    <PageContainer>
      <PageHeader title={t.account.profileTitle} />
      <ProfileForm
        email={me.authUser?.email ?? null}
        initialPhone={me.appUser?.phone ?? null}
      />
      <DeleteAccount />
    </PageContainer>
  );
}
