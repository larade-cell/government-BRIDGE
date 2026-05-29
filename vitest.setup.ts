// Load .env the same way Next.js does so `~/env.js` validation passes and
// Prisma can reach the local Postgres during tests.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
