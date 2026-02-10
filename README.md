# ld-cloudflare-demo

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) that uses the [LaunchDarkly Cloudflare SDK](https://docs.launchdarkly.com/sdk/edge/cloudflare/) to evaluate feature flags at the edge. Flag data is read from Workers KV (populated by the LaunchDarkly Cloudflare integration), so evaluations are low-latency and do not call LaunchDarkly on each request.

This project also explores **isolating flags by request context**: flags are configured with path-based targeting rules, so you can use `variationDetail` and filter by evaluation reason (e.g. only include flags that matched a rule for the current path) to serve only the flags relevant to the visitor’s page.

## Tech stack

- **Runtime:** Cloudflare Workers
- **Feature flags:** LaunchDarkly Cloudflare SDK (`@launchdarkly/cloudflare-server-sdk`) with Workers KV as the feature store
- **Config:** Wrangler (`wrangler.jsonc`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure LaunchDarkly & Cloudflare**

   - Set up the [LaunchDarkly Cloudflare integration](https://docs.launchdarkly.com/integrations/cloudflare) and create a KV namespace for your environment.
   - In `wrangler.jsonc`, set the KV namespace `id` under `kv_namespaces` (binding `LD_KV`).
   - Replace the client-side ID in `src/index.ts` with your LaunchDarkly client-side ID for the environment you use (e.g. Test).

3. **Log in to Wrangler** (if needed)

   ```bash
   npx wrangler login
   ```

## Run

| Command           | Description                    |
|-------------------|--------------------------------|
| `npm run dev`     | Start local dev server (e.g. http://localhost:8787) |
| `npm run deploy`  | Deploy the worker to Cloudflare |
| `npm run test`    | Run tests                     |
| `npm run cf-typegen` | Regenerate `Env` types from `wrangler.jsonc` |

## Project notes

- **`ld-docs-updates.md`** — Notes on discrepancies between current LaunchDarkly Cloudflare docs and current Wrangler/Cloudflare setup (e.g. `wrangler.jsonc` vs `wrangler.toml`, correct CLI commands), for use when requesting doc updates.
- The worker uses a **lazy singleton** for the LaunchDarkly client: it is created on the first request and reused for subsequent requests.
- Context includes a `path` attribute so that path-based targeting rules in LaunchDarkly can determine which flags apply to the current request.
