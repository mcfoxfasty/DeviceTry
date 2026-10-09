import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
    {
        // Global ignores: generated build output must never be linted.
        // NEXT_DIST_DIR picks the build directory (see next.config.ts), so every
        // variant used here — the dev/build default .next, the isolated .next-prod
        // and .next-verify verification builds, and the OpenNext bundle — is
        // ignored. Without this, `eslint .` walks the generated bundles.
        ignores: [".open-next/**", ".next/**", ".next-prod/**", ".next-verify/**"],
    },
    {
        extends: [...next],
    },
]);
