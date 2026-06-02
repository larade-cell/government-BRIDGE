"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export function AuditLog() {
  const [entityType, setEntityType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const facets = api.audit.facets.useQuery();
  const log = api.audit.list.useQuery({
    ...(entityType ? { entity_type: entityType } : {}),
    page,
    limit: 50,
  });

  const rows = log.data?.data ?? [];
  const meta = log.data?.meta;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="entity-filter" className="text-sm">
          Entity
        </Label>
        <select
          id="entity-filter"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All</option>
          {(facets.data?.entity_types ?? []).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {log.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No audit entries yet.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const open = expanded === r.id;
                const hasDetail = r.before_value != null || r.after_value != null;
                return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 align-top ${
                      hasDetail ? "cursor-pointer hover:bg-muted/40" : ""
                    }`}
                    onClick={() =>
                      hasDetail && setExpanded(open ? null : r.id)
                    }
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {r.actor?.email ?? (
                        <span className="text-muted-foreground">system</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.entity_type}</div>
                      {r.entity_id && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {r.entity_id.slice(0, 8)}
                        </div>
                      )}
                      {open && hasDetail && (
                        <pre className="mt-1 max-w-md overflow-auto rounded-lg bg-muted/60 p-2 text-[11px]">
                          {JSON.stringify(
                            { before: r.before_value, after: r.after_value },
                            null,
                            2,
                          )}
                        </pre>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {meta.page} of {meta.total_pages} · {meta.total} entries
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
