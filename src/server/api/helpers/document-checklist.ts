import { type PrismaClient } from "../../../../generated/prisma";

/** A Prisma client or an interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * (Re)generate the session document checklist from the session's current
 * eligibility results. Pulls every required document for each program the
 * session was screened against, then upserts one checklist row per
 * (session, program, doc type).
 *
 * Shared by `documentChecklist.generate` (manual refresh) and `eligibility.run`
 * (automatic generation once results are computed) so both stay in sync.
 *
 * Returns the number of checklist rows written.
 */
export async function generateSessionChecklist(
  db: Db,
  sessionId: string,
): Promise<number> {
  const results = await db.eligibility_results.findMany({
    where: { session_id: sessionId },
    select: {
      program_id: true,
      programs: {
        select: {
          program_document_requirements: {
            where: { is_required: true },
            select: { document_type_id: true, condition_json: true },
          },
        },
      },
    },
  });

  const rows = results.flatMap((r) =>
    r.programs.program_document_requirements.map((req) => ({
      session_id: sessionId,
      program_id: r.program_id,
      document_type_id: req.document_type_id,
    })),
  );

  const written = await Promise.all(
    rows.map((row) =>
      db.session_document_checklist.upsert({
        where: { session_id_program_id_document_type_id: row },
        update: {},
        create: row,
      }),
    ),
  );

  return written.length;
}
