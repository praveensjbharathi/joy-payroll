import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const isSelfHostedCloudflare = process.env.JOY_DEPLOY_TARGET === "cloudflare";

// The production application is GitHub -> Cloudflare -> Supabase. The old
// .openai/hosting.json file has intentionally been removed; local preview no
// longer depends on Site Creator D1/R2 bindings.
const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [],
  r2_buckets: [],
};

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      ...(isSelfHostedCloudflare ? [] : [sites()]),
      cloudflare(
        isSelfHostedCloudflare
          ? {
              configPath: "./wrangler.self-hosted.jsonc",
              viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
              inspectorPort: false,
            }
          : {
              viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
              inspectorPort: false,
              config: localBindingConfig,
            },
      ),
    ],
  };
});
