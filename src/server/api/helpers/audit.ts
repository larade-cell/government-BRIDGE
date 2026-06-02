import { type Prisma } from "../../../../generated/prisma";
import { type createTRPCContext } from "~/server/api/trpc";

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>;

/** Best-effort client IP from proxy headers, guarded so Postgres `inet` won't choke. */
function clientIp(headers: Headers): string | null {
  const raw =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null;
  if (!raw) return null;
  const looksLikeIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw) || raw.includes(":");
  return looksLikeIp ? raw : null;
}

/**
 * Record an audit-trail entry for a sensitive action (config change, case
 * update, etc.). Best-effort: a logging failure is swallowed so it can never
 * break the action it's auditing. The actor is the signed-in domain user.
 */
export async function recordAudit(
  ctx: Ctx,
  p: {
    action: string; // e.g. "rule.publish", "program.update"
    entity_type: string; // e.g. "eligibility_rule_version", "program"
    entity_id?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  try {
    await ctx.db.audit_logs.create({
      data: {
        actor_user_id: ctx.session?.user.appUserId ?? null,
        action: p.action,
        entity_type: p.entity_type,
        entity_id: p.entity_id ?? null,
        ...(p.before !== undefined && {
          before_value: p.before as Prisma.InputJsonValue,
        }),
        ...(p.after !== undefined && {
          after_value: p.after as Prisma.InputJsonValue,
        }),
        ip_address: clientIp(ctx.headers),
        user_agent: ctx.headers.get("user-agent") ?? null,
      },
    });
  } catch (err) {
    console.error(`[audit] failed to record ${p.action}`, err);
  }
}
