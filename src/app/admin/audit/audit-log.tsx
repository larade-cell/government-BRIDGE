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
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
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
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No audit entries yet.
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b text-left text-xs uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  When
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Actor
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Action
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Entity
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const open = expanded === r.id;
                const hasDetail =
                  r.before_value != null || r.after_value != null;
                return (
                  <tr
                    key={r.id}
                    className={`border-b align-top last:border-0 ${
                      hasDetail
                        ? "hover:bg-muted/40 focus-visible:bg-muted/40 cursor-pointer"
                        : ""
                    }`}
                    tabIndex={hasDetail ? 0 : undefined}
                    aria-expanded={hasDetail ? open : undefined}
                    onClick={() => hasDetail && setExpanded(open ? null : r.id)}
                    onKeyDown={(e) => {
                      if (hasDetail && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setExpanded(open ? null : r.id);
                      }
                    }}
                  >
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {r.actor?.email ?? (
                        <span className="text-muted-foreground">system</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="bg-muted rounded-md px-1.5 py-0.5 font-mono text-xs">
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.entity_type}</div>
                      {r.entity_id && (
                        <div className="text-muted-foreground font-mono text-[11px]">
                          {r.entity_id.slice(0, 8)}
                        </div>
                      )}
                      {open && hasDetail && (
                        <pre className="bg-muted/60 mt-1 max-w-md overflow-auto rounded-lg p-2 text-[11px]">
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
