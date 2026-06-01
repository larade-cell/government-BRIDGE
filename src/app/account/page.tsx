import Link from "next/link";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { fmt, type Locale } from "~/i18n/config";
import { getI18n } from "~/i18n/server";
import { api } from "~/trpc/server";

import { DocumentsManager } from "./documents-manager";
import { ProfileForm } from "./profile-form";

function formatDate(d: Date, locale: Locale) {
  return new Date(d).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AccountPage() {
  const [{ locale, t }, me, sessions] = await Promise.all([
    getI18n(),
    api.user.me(),
    api.screeningSession.listMine(),
  ]);

  const inProgress = sessions.filter((s) => !s.completed_at);
  const completed = sessions.filter((s) => s.completed_at);
  const latestCompleted = completed[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">
          {me.authUser?.name
            ? fmt(t.account.welcomeNamed, { name: me.authUser.name })
            : t.account.welcome}
        </h1>
        <p className="mt-1 text-muted-foreground">{t.account.subtitle}</p>
      </div>

      {/* Resume in-progress screening */}
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
                <Button render={<Link href={`/screening/${s.id}`} />} size="sm">
                  {t.account.resume}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Screening history & results */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">
            {t.account.yourScreenings}
          </h2>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/screening/start" />}
          >
            {t.account.newScreening}
          </Button>
        </div>

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

      {/* Documents */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          {t.account.documentsTitle}
        </h2>
        {latestCompleted ? (
          <DocumentsManager sessionId={latestCompleted.id} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t.account.completeToSeeDocs}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Profile & preferences */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          {t.account.profileTitle}
        </h2>
        <ProfileForm
          email={me.authUser?.email ?? null}
          initialPhone={me.appUser?.phone ?? null}
        />
      </section>
    </div>
  );
}
