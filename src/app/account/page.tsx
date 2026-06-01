import Link from "next/link";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/server";

import { DocumentsManager } from "./documents-manager";
import { ProfileForm } from "./profile-form";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AccountPage() {
  const [me, sessions] = await Promise.all([
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
          Welcome{me.authUser?.name ? `, ${me.authUser.name}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Track your benefit screenings, results, and documents in one place.
        </p>
      </div>

      {/* Resume in-progress screening */}
      {inProgress.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>Pick up where you left off</CardTitle>
            <CardDescription>
              You have {inProgress.length} screening
              {inProgress.length > 1 ? "s" : ""} in progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {inProgress.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">
                  Started {formatDate(s.created_at)} ·{" "}
                  {s._count.screening_answers} answer
                  {s._count.screening_answers === 1 ? "" : "s"} so far
                </span>
                <Button render={<Link href={`/screening/${s.id}`} />} size="sm">
                  Resume
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
            Your screenings
          </h2>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/screening/start" />}
          >
            New screening
          </Button>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              You haven&apos;t started a screening yet.{" "}
              <Link href="/screening/start" className="text-primary underline">
                Start one now
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
                          Screening · {formatDate(s.created_at)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            done
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {done ? "Completed" : "In progress"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s._count.eligibility_results} program
                        {s._count.eligibility_results === 1 ? "" : "s"} matched
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
                      {done ? "View results" : "Resume"}
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
        <h2 className="font-heading text-xl font-semibold">Your documents</h2>
        {latestCompleted ? (
          <DocumentsManager sessionId={latestCompleted.id} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Complete a screening to see which documents you&apos;ll need and
              upload them here.
            </CardContent>
          </Card>
        )}
      </section>

      {/* Profile & preferences */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">
          Profile &amp; preferences
        </h2>
        <ProfileForm
          email={me.authUser?.email ?? null}
          initialLanguage={me.appUser?.preferred_language ?? "en"}
          initialPhone={me.appUser?.phone ?? null}
        />
      </section>
    </div>
  );
}
