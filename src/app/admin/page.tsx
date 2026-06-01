import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PageContainer, PageHeader } from "~/components/ui/page";
import { api } from "~/trpc/server";

const OUTCOME_LABELS: Record<string, string> = {
  likely_eligible: "Likely eligible",
  may_be_eligible: "May be eligible",
  needs_more_info: "Needs more info",
  unlikely_eligible: "Unlikely eligible",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const [overview, outcomes, dropOff] = await Promise.all([
    api.report.overview(),
    api.report.eligibilityOutcomes(),
    api.report.dropOff(),
  ]);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const maxOutcome = Math.max(1, ...outcomes.data.map((o) => o.count));

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description="Aggregate screening activity. No personal information is shown."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Total screenings" value={overview.total_sessions} />
        <Stat label="Completed" value={overview.completed_sessions} />
        <Stat label="Completion rate" value={pct(overview.completion_rate)} />
        <Stat
          label="Eligibility results"
          value={overview.total_eligibility_results}
        />
        <Stat label="Documents uploaded" value={overview.total_uploads} />
        <Stat label="Open cases" value={overview.open_cases} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility outcomes</CardTitle>
          <CardDescription>
            How screening results break down across all sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {outcomes.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No results yet.</p>
          ) : (
            outcomes.data
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((o) => (
                <div key={o.outcome} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm">
                    {OUTCOME_LABELS[o.outcome] ?? o.outcome}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(o.count / maxOutcome) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium">
                    {o.count}
                  </span>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Drop-off by step</CardTitle>
          <CardDescription>
            Where residents stop in incomplete screenings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dropOff.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No incomplete screenings.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {dropOff.data.map((d) => (
                <div
                  key={d.step}
                  className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm"
                >
                  <span>Step {d.step}</span>
                  <span className="font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
