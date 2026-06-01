"use client";

import { useState } from "react";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { api } from "~/trpc/react";

export function ProfileForm({
  email,
  initialPhone,
}: {
  email: string | null;
  initialPhone: string | null;
}) {
  const { locale, t } = useI18n();
  const utils = api.useUtils();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saved, setSaved] = useState(false);

  const update = api.user.update.useMutation({
    onSuccess: () => {
      setSaved(true);
      void utils.user.me.invalidate();
      setTimeout(() => setSaved(false), 2500);
    },
  });

  // Existing email notification preference (if any) for this user.
  const prefs = api.notificationPreference.list.useQuery(undefined, {
    retry: false,
  });
  const emailPref = prefs.data?.find((p) => p.channel === "email");
  const [emailOptIn, setEmailOptIn] = useState<boolean | null>(null);
  const optedIn = emailOptIn ?? emailPref?.opted_in ?? false;

  const savePref = api.notificationPreference.upsert.useMutation({
    onSuccess: () => void utils.notificationPreference.list.invalidate(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.account.accountDetails}</CardTitle>
        <CardDescription>
          {email
            ? `${t.home.signedInAs} ${email}`
            : t.account.managePreferences}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              phone: phone.trim() === "" ? null : phone.trim(),
            });
          }}
        >
          <div className="grid gap-2 sm:max-w-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t.account.phoneOptional}</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>
          </div>
          <div>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? t.common.saving : t.account.saveChanges}
            </Button>
          </div>
          {saved && <Alert variant="success">{t.account.saved}</Alert>}
          {update.error && (
            <Alert variant="error">{update.error.message}</Alert>
          )}
        </form>

        {email && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{t.account.emailUpdates}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(t.account.emailUpdatesDesc, { email })}
              </p>
            </div>
            <Button
              size="sm"
              variant={optedIn ? "default" : "outline"}
              disabled={savePref.isPending}
              onClick={() => {
                const next = !optedIn;
                setEmailOptIn(next);
                savePref.mutate({
                  channel: "email",
                  destination: email,
                  language_code: locale,
                  opted_in: next,
                });
              }}
            >
              {optedIn ? t.account.on : t.account.off}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
