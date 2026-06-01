"use client";

import { useState } from "react";

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
import { api } from "~/trpc/react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export function ProfileForm({
  email,
  initialLanguage,
  initialPhone,
}: {
  email: string | null;
  initialLanguage: string;
  initialPhone: string | null;
}) {
  const utils = api.useUtils();
  const [language, setLanguage] = useState(initialLanguage);
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
        <CardTitle>Account details</CardTitle>
        <CardDescription>
          {email ? `Signed in as ${email}` : "Manage your preferences"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              preferred_language: language,
              phone: phone.trim() === "" ? null : phone.trim(),
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="language">Preferred language</Label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600">Saved.</span>
            )}
            {update.error && (
              <span className="text-sm text-destructive">
                {update.error.message}
              </span>
            )}
          </div>
        </form>

        {email && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Email me updates</p>
              <p className="text-xs text-muted-foreground">
                Get notified at {email} when there&apos;s news about your
                benefits.
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
                  language_code: language,
                  opted_in: next,
                });
              }}
            >
              {optedIn ? "On" : "Off"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
