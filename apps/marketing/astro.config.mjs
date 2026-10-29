import { checkBranding } from "../../scripts/lib/check-branding.ts";
import BRAND from "../../branding.json" with { type: "json" };
import { defineConfig } from "astro/config";

checkBranding();

// Astro loads env with an empty prefix, and under `vp run` Vite+'s loadEnv then reports every
// variable to the task cache. Any env difference (TERM, VP_RAW_SUBCOMMAND, an agent's session
// vars) would rerun `astro check`. Without the runner client, loadEnv reads process.env directly;
// file tracking does not use this client.
delete process.env.VP_RUN_NODE_CLIENT_PATH;

export default defineConfig({
  site: BRAND.links.website,
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
