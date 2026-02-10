# ld-cloudflare-demo

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) that uses the [LaunchDarkly Cloudflare SDK](https://docs.launchdarkly.com/sdk/edge/cloudflare/) to evaluate feature flags at the edge. Flag data is read from Workers KV (populated by the LaunchDarkly Cloudflare integration), so evaluations are low-latency and do not call LaunchDarkly on each request.

## What the worker does (MVP)

The worker serves a single page that demonstrates **path-based flag isolation** and **experiment visibility**:

1. **Context from the request** — It builds an evaluation context from the request URL, including a `path` attribute (e.g. `/`, `/products`, `/account`). LaunchDarkly targeting rules are configured to match specific paths, so only flags relevant to that path evaluate with a rule match.

2. **All flags + reasons** — It calls `allFlagsState(context, { withReasons: true })` to get every flag’s value and the **evaluation reason** (e.g. `RULE_MATCH`, `FALLTHROUGH`, `OFF`). The page displays a table: flag key, value, reason, and whether the variation was served **in an experiment** (`reason.inExperiment === true`).

3. **Filtering by delivery reason** — To send only “relevant” flags to the client (e.g. for this page type), you would filter the result: **include** flags where `reason.kind === 'RULE_MATCH'` (or `'TARGET_MATCH'`), and **exclude** flags where `reason.kind === 'FALLTHROUGH'` or `'OFF'`. That way you only expose flags that actually targeted this context (e.g. this path).

4. **Experiment bucketing** — The evaluation reason object may include `inExperiment: true` when the user is bucketed into an experiment. The worker surfaces this in the “In experiment” column so you can see which flags are driving experiments for the current context.

5. **Analytics events** — `allFlagsState()` does not send evaluation events to LaunchDarkly. To generate analytics (e.g. for experiments and metrics), the worker calls `variation()` for every flag whose reason is `RULE_MATCH` or `TARGET_MATCH`. That way only evaluations for "relevant" flags (those that targeted this context) produce events.

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

## Path-based targeting

Flags are targeted by context `path`. The worker sets `context.path` from the request URL path. These are the paths used in LaunchDarkly targeting rules in this project:

| Path        | Flags |
|------------|--------|
| `/`        | homepage-flag, homepage-hero-variant, homepage-cta-style |
| `/products`| product-listing-flag, product-listing-layout |
| `/product` | product-detail-flag, product-detail-gallery-style |
| `/cart`, `/checkout` | cart-flag, checkout-flow |
| `/account` | account-profile-flag, account-dashboard-layout |
| `/search`  | search-results-flag, search-results-density |
| `/blog`    | blog-article-flag, blog-reading-view |
| `/pricing` | pricing-page-flag, pricing-display-style |
| `/contact` | contact-page-flag |
| `/faq`     | faq-page-flag |
| `/login`   | login-page-flag |

When you open the worker in the browser, use the path links (e.g. `/products`, `/account`) to see which flags evaluate with a rule match for that path.

## Project notes

- **`ld-docs-updates.md`** — Notes on discrepancies between current LaunchDarkly Cloudflare docs and current Wrangler/Cloudflare setup (e.g. `wrangler.jsonc` vs `wrangler.toml`, correct CLI commands), for use when requesting doc updates.
- The worker uses a **lazy singleton** for the LaunchDarkly client: it is created on the first request and reused for subsequent requests.
- Context includes a `path` attribute so that path-based targeting rules in LaunchDarkly can determine which flags apply to the current request.
