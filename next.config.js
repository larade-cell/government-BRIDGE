/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Produce a self-contained build (.next/standalone) for a minimal Docker image.
  output: "standalone",
};

export default config;
