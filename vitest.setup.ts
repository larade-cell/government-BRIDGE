// Load .env the same way Next.js does so `~/env.js` validation passes and
// Prisma can reach the local Postgres during tests.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Tests must be hermetic and deterministic: disable AI so procedures use their
// built-in fallback instead of making live OpenAI calls (which are slow, cost
// tokens, and flake on the network). The AI tests assert the fallback contract.
delete process.env.OPENAI_API_KEY;
