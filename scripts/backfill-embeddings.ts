/**
 * Backfill `search_embeddings` for semantic search and RAG retrieval.
 *
 * Embeds every active program (one row per translated language) and every
 * knowledge source, then upserts the vectors into `search_embeddings`. All
 * embedding calls go through `lib/ai-service.ts` so model choice stays in one
 * place; the `embedding` column is a pgvector `Unsupported` type, so rows are
 * written with raw SQL.
 *
 * Idempotent: upserts on (target_type, target_id, language_code,
 * embedding_model), so re-running refreshes existing rows.
 *
 * Usage:
 *   npm run backfill:embeddings            # embed + write
 *   npm run backfill:embeddings -- --dry-run   # show what would be embedded
 *
 * Requires OPENAI_API_KEY and DATABASE_URL in `.env`.
 */

// Load .env into process.env BEFORE importing modules that read it (the
// ai-service → ~/env chain validates at import time). Dynamic imports below run
// after this side effect, guaranteeing the order.
// `@next/env` is CommonJS; under ESM only its default export is available.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { PrismaClient } = await import("../generated/prisma/client");
const { embedTexts, isAiEnabled, EMBEDDING_MODEL } = await import(
  "../lib/ai-service"
);

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 100; // OpenAI accepts arrays; batch to limit round-trips.

const db = new PrismaClient({ log: [] });

/** One thing to embed and where it belongs in `search_embeddings`. */
interface EmbedItem {
  target_type: "program" | "knowledge_source";
  target_id: string;
  language_code: string;
  content_text: string;
}

function clean(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join("\n");
}

async function collectProgramItems(): Promise<EmbedItem[]> {
  const programs = await db.programs.findMany({
    where: { is_active: true },
    select: {
      id: true,
      program_key: true,
      program_translations: {
        select: {
          language_code: true,
          name: true,
          short_description: true,
          next_steps: true,
        },
      },
    },
  });

  const items: EmbedItem[] = [];
  for (const p of programs) {
    for (const t of p.program_translations) {
      const content = clean(t.name, t.short_description, t.next_steps);
      if (!content) continue;
      items.push({
        target_type: "program",
        target_id: p.id,
        language_code: t.language_code,
        content_text: content,
      });
    }
  }
  return items;
}

async function collectKnowledgeItems(): Promise<EmbedItem[]> {
  const sources = await db.knowledge_sources.findMany({
    select: { id: true, title: true, content_text: true, language_code: true },
  });

  const items: EmbedItem[] = [];
  for (const s of sources) {
    const content = clean(s.title, s.content_text);
    if (!content) continue;
    items.push({
      target_type: "knowledge_source",
      target_id: s.id,
      language_code: s.language_code ?? "en",
      content_text: content,
    });
  }
  return items;
}

async function writeEmbedding(item: EmbedItem, vector: number[]): Promise<void> {
  const literal = `[${vector.join(",")}]`;
  await db.$executeRaw`
    INSERT INTO search_embeddings
      (target_type, target_id, language_code, content_text, embedding, embedding_model)
    VALUES (
      ${item.target_type}::search_target_type,
      ${item.target_id}::uuid,
      ${item.language_code},
      ${item.content_text},
      ${literal}::vector,
      ${EMBEDDING_MODEL}
    )
    ON CONFLICT (target_type, target_id, language_code, embedding_model)
    DO UPDATE SET
      content_text = EXCLUDED.content_text,
      embedding    = EXCLUDED.embedding,
      created_at   = now()
  `;
}

async function backfill(items: EmbedItem[]): Promise<number> {
  let written = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const vectors = await embedTexts(batch.map((b) => b.content_text));
    if (!vectors) {
      throw new Error(
        "embedTexts returned null — is OPENAI_API_KEY set? (AI is disabled)",
      );
    }
    for (let j = 0; j < batch.length; j++) {
      const vector = vectors[j];
      if (!vector) continue;
      await writeEmbedding(batch[j]!, vector);
      written++;
    }
    console.log(`  embedded ${Math.min(i + batch.length, items.length)}/${items.length}`);
  }
  return written;
}

async function main() {
  console.log(
    `Embedding backfill${DRY_RUN ? " (dry run)" : ""} — model: ${EMBEDDING_MODEL}`,
  );

  const [programItems, knowledgeItems] = await Promise.all([
    collectProgramItems(),
    collectKnowledgeItems(),
  ]);
  const all = [...programItems, ...knowledgeItems];

  console.log(
    `Found ${programItems.length} program rows and ${knowledgeItems.length} knowledge-source rows to embed (${all.length} total).`,
  );

  if (DRY_RUN) {
    for (const it of all.slice(0, 10)) {
      console.log(
        `  [${it.target_type}/${it.language_code}] ${it.content_text.slice(0, 60).replace(/\n/g, " ")}…`,
      );
    }
    if (all.length > 10) console.log(`  …and ${all.length - 10} more`);
    console.log("Dry run complete — no embeddings created.");
    return;
  }

  if (!isAiEnabled()) {
    throw new Error("OPENAI_API_KEY is not set — cannot create embeddings.");
  }
  if (all.length === 0) {
    console.log("Nothing to embed. Seed programs / knowledge sources first.");
    return;
  }

  const written = await backfill(all);
  console.log(`Done — upserted ${written} embedding rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
