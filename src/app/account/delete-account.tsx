"use client";

import { Card, CardContent } from "~/components/ui/card";
import { ConfirmButton } from "~/components/ui/confirm";
import { useI18n } from "~/i18n/client";
import { api } from "~/trpc/react";

export function DeleteAccount() {
  const { t } = useI18n();
  const del = api.user.deleteAccount.useMutation();

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <p className="font-medium text-destructive">{t.account.dangerZone}</p>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            {t.account.deleteWarning}
          </p>
        </div>
        <ConfirmButton
          variant="destructive"
          confirmVariant="destructive"
          title={t.account.deleteConfirmTitle}
          description={t.account.deleteConfirmDesc}
          confirmLabel={t.account.deleteButton}
          disabled={del.isPending}
          onConfirm={async () => {
            await del.mutateAsync();
            // The sign-in identity is gone; clear the session cookie + leave.
            window.location.assign("/api/auth/signout");
          }}
        >
          {del.isPending ? t.account.deleting : t.account.deleteButton}
        </ConfirmButton>
      </CardContent>
    </Card>
  );
}
