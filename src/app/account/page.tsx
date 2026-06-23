import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  CheckCircleIcon,
  ClipboardIcon,
  ClockIcon,
  ScaleIcon,
} from "~/components/ui/icons";
import { PageContainer, PageHeader } from "~/components/ui/page";
import { fmt, type Locale } from "~/i18n/config";
import { getI18n } from "~/i18n/server";
import { api } from "~/trpc/server";

function formatDate(d: Date, locale: Locale) {
  return new Date(d).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A colored icon tile + metric, mirroring the staff console's stat cards. */
function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: (props: { className?: string }) => React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="font-heading text-3xl leading-tight font-bold">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AccountOverviewPage() {
  const [{ locale, t }, me, sessions, updates, referrals] = await Promise.all([
    getI18n(),
    api.user.me(),
    api.screeningSession.listMine(),
    api.notificationPreference.feed(),
    api.referral.list(),
  ]);

  // Resident-friendly status copy + tone for the referrals the caseworker is
  // working on. "draft" reads as pending/in-prep, not a scary technical term.
  const refStatusLabel: Record<string, string> = {
    draft: t.account.refStatusDraft,
    sent: t.account.refStatusSent,
    accepted: t.account.refStatusAccepted,
    closed: t.account.refStatusClosed,
  };
  const refStatusTone: Record<string, string> = {
    draft: "bg-amber-100 text-amber-700",
    sent: "bg-sky-100 text-sky-700",
    accepted: "bg-emerald-100 text-emerald-700",
    closed: "bg-slate-100 text-slate-500",
  };

  // Turn a notification event into resident-facing copy in their language.
  const updateMessage = (event_type: string, payload: Record<string, unknown>) => {
    if (event_type === "referral_accepted") {
      const org =
        typeof payload.organization_name === "string"
          ? payload.organization_name
          : null;
      const need =
        typeof payload.need_category === "string" ? payload.need_category : "";
      return org
        ? fmt(t.account.referralAccepted, { org, need })
        : fmt(t.account.referralAcceptedNoOrg, { need });
    }
    return null;
  };
  const updateItems = updates
    .map((u) => ({ ...u, message: updateMessage(u.event_type, u.payload) }))
    .filter((u): u is typeof u & { message: string } => u.message !== null);

  const inProgress = sessions.filter((s) => !s.completed_at);
  const completedCount = sessions.length - inProgress.length;
  const matchCount = sessions.reduce(
    (sum, s) => sum + s._count.eligibility_results,
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        title={
          me.authUser?.name
            ? fmt(t.account.welcomeNamed, { name: me.authUser.name })
            : t.account.welcome
        }
        description={t.account.subtitle}
        actions={
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/screening/start" />}
          >
            {t.account.newScreening}
          </Button>
        }
      />

      {sessions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t.account.statScreenings}
            value={sessions.length}
            icon={ClipboardIcon}
            tone="bg-sky-100 text-sky-700"
          />
          <Stat
            label={t.account.completed}
            value={completedCount}
            icon={CheckCircleIcon}
            tone="bg-emerald-100 text-emerald-700"
          />
          <Stat
            label={t.account.inProgress}
            value={inProgress.length}
            icon={ClockIcon}
            tone="bg-amber-100 text-amber-700"
          />
          <Stat
            label={t.account.statMatches}
            value={matchCount}
            icon={ScaleIcon}
            tone="bg-indigo-100 text-indigo-700"
          />
        </div>
      )}

      {updateItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.account.updatesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {updateItems.map((u) => (
              <div
                key={u.id}
                className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5"
              >
                <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm text-foreground">{u.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(u.created_at, locale)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.account.referralsTitle}</CardTitle>
            <CardDescription>{t.account.referralsLead}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5"
              >
                <div>
                  <span className="font-medium capitalize">
                    {r.need_category}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {r.organizations?.name ?? t.account.refUnassigned}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    refStatusTone[r.status] ?? refStatusTone.draft
                  }`}
                >
                  {refStatusLabel[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inProgress.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>{t.account.resumeTitle}</CardTitle>
            <CardDescription>
              {fmt(
                inProgress.length > 1
                  ? t.account.resumeDescMany
                  : t.account.resumeDescOne,
                { n: inProgress.length },
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {inProgress.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">
                  {fmt(t.account.startedOn, {
                    date: formatDate(s.created_at, locale),
                  })}{" "}
                  · {fmt(t.account.answersSoFar, { n: s._count.screening_answers })}
                </span>
                <Button
                  render={<Link href={`/screening/${s.id}`} />}
                  size="sm"
                  nativeButton={false}
                >
                  {t.account.resume}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          {t.account.yourScreenings}
        </h2>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t.account.noScreenings}{" "}
              <Link href="/screening/start" className="text-primary underline">
                {t.account.startOne}
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => {
              const done = Boolean(s.completed_at);
              return (
                <Card key={s.id} size="sm">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {fmt(t.account.screeningOn, {
                            date: formatDate(s.created_at, locale),
                          })}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            done
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {done ? t.account.completed : t.account.inProgress}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmt(t.account.programsMatched, {
                          n: s._count.eligibility_results,
                        })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={done ? "default" : "outline"}
                      nativeButton={false}
                      render={
                        <Link
                          href={
                            done
                              ? `/screening/${s.id}/results`
                              : `/screening/${s.id}`
                          }
                        />
                      }
                    >
                      {done ? t.account.viewResults : t.account.resume}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
