# LaunchDarkly docs – suggested updates (Cloudflare SDK)

Notes on discrepancies between current LaunchDarkly Cloudflare SDK docs and current Cloudflare/Wrangler setup. Use this when requesting doc updates.

**Pages where issues 1–4 appear:** [Cloudflare integration](https://launchdarkly.com/docs/integrations/cloudflare) and (where relevant) [Cloudflare SDK reference](https://launchdarkly.com/docs/sdk/edge/cloudflare).

---

## 1. Config file: `wrangler.toml` vs `wrangler.jsonc`

**Current docs:** Examples use `wrangler.toml` (TOML).

**Reality:** New projects use **`wrangler.jsonc`** (or `wrangler.json`). Cloudflare recommends JSON/JSONC for new projects; Wrangler has supported it since v3.91.0. Some newer features are only documented for the JSON config.

**Ask:** Add a JSON/JSONC example (or note) alongside the TOML examples, and mention that both are valid and that JSON is recommended for new projects.

---

## 2. KV namespace in JSON config

**Current docs:** Show TOML only, e.g.:

```toml
[[kv_namespaces]]
binding = "YOUR_BINDING_NAME"
id = "your-namespace-id"
```

**Equivalent in `wrangler.jsonc`:**

```json
"kv_namespaces": [
  { "binding": "LD_KV", "id": "YOUR_KV_NAMESPACE_ID" }
]
```

**Ask:** Document the `kv_namespaces` array format for users on `wrangler.json` / `wrangler.jsonc`, and keep the binding name `LD_KV` consistent in examples.

---

## 3. KV namespace create command

**Current docs:** Show:

```bash
wrangler kv:namespace create "LD_KV"
```

**Reality:** Wrangler uses **spaces**, not a colon. The correct command is:

```bash
npx wrangler kv namespace create "LD_KV"
```

(Use `npx` when wrangler is only installed as a project dev dependency.)

**Ask:** Update the command to `wrangler kv namespace create "LD_KV"` (and mention `npx` for local installs).

---

## 4. Account ID in config

**Current docs:** Tell users to add `account_id = "<YOUR_CLOUDFLARE_ACCOUNT_ID>"` to `wrangler.toml`, and to use `wrangler whoami` if they don’t know it.

**Reality:** For Workers, **`account_id` is optional**. After `wrangler login`, Wrangler uses the account from your authenticated session. You don’t need to put it in the config unless you have multiple accounts and need to pin one (or use env var `CLOUDFLARE_ACCOUNT_ID`).

**Ask:** Remove or soften this step: say it’s optional and only needed for multi-account setups, and that `wrangler whoami` is for checking your login/account, not a prerequisite for adding config.

---

## 5. SDK installation page – multiple `wrangler.toml` references

**Page:** [Cloudflare SDK reference](https://launchdarkly.com/docs/sdk/edge/cloudflare) (Install the SDK section)

**Current docs:** The page refers to `wrangler.toml` in several places:

- Copy says to turn on the Node.js compatibility flag "in your `wrangler.toml`" and to "Specify a build command in your `wrangler.toml`".
- The only config example is a TOML block labeled `wrangler.toml` with `compatibility_flags = [ "nodejs_compat" ]` and `[build] command = "node build.js"`.

**Reality:** Many projects use `wrangler.jsonc`; Cloudflare recommends JSON/JSONC for new projects (see §1 above).

**Ask:** On this page, either (a) add equivalent `wrangler.jsonc` examples alongside the TOML, or (b) use generic wording ("in your wrangler config file") and show both formats. Ensure the Install the SDK section doesn't assume TOML only.

---

## 6. Client initialization: reuse across requests (lazy singleton)

**Page:** [Cloudflare SDK reference](https://launchdarkly.com/docs/sdk/edge/cloudflare) (Initialize the client / Example Worker)

**Current docs:** Examples create the client inside the `fetch` handler on every request:

```ts
const client = init('client-side-id-123abc', env.LD_KV);
await client.waitForInitialization();
```

**Reality:** The client can be created once and reused across requests (similar to reusing a client in Lambda). `env` is only available per-request, so the client cannot be initialized at module load—but a **lazy singleton** works: initialize on first request, then reuse the same instance.

**Suggested pattern for docs:**

- Store the client in a module-level variable.
- Use a small helper that creates the client with `env.LD_KV` on first call and returns the same client on subsequent calls.

Example:

```ts
import { init } from '@launchdarkly/cloudflare-server-sdk';

let ldClient: ReturnType<typeof init> | null = null;

async function getOrCreateClient(env: Env): Promise<ReturnType<typeof init>> {
  if (ldClient) return ldClient;
  ldClient = init('your-client-side-id', env.LD_KV, { sendEvents: true });
  await ldClient.waitForInitialization();
  return ldClient;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const client = await getOrCreateClient(env);
    // use client.variation(), etc.
    return new Response('...');
  },
};
```

**Ask:** Add this as the recommended pattern (or at least an alternative) in the Initialize the client / Example Worker sections: reuse the client across invocations instead of creating it on every request.

---

## 7. Local dev: use `wrangler dev --remote` so the Worker sees KV data from LaunchDarkly

**Page:** [Cloudflare integration](https://launchdarkly.com/docs/integrations/cloudflare), [Cloudflare SDK reference](https://launchdarkly.com/docs/sdk/edge/cloudflare)

**Current docs:** May show or mention `wrangler dev` for local development without noting the `--remote` flag.

**Reality:** By default, `wrangler dev` runs the Worker **locally** and uses **simulated (in-memory) KV**, not the real Cloudflare KV namespace. LaunchDarkly’s integration writes flag data only to the **real** KV namespace you configured. So in local dev without `--remote`, the Worker never sees that data and the SDK can throw e.g. *"LD-Env-&lt;env-id&gt; is not found in KV"* even though the key exists in the Cloudflare dashboard.

**Ask:** Add a short note that for local development with the SDK and KV, users should run **`wrangler dev --remote`** (or `npx wrangler dev --remote`) so the Worker uses the real Cloudflare KV namespace that LaunchDarkly populates. Optionally mention `preview_id` in the config (same as `id` or a separate preview namespace) and that `--remote` is required for the Worker to read from the synced KV.

---

## 8. Cloudflare API token for the LaunchDarkly integration: KV permissions

**Page:** [Cloudflare integration](https://launchdarkly.com/docs/integrations/cloudflare) (Configure the LaunchDarkly Cloudflare integration)

**Current docs:** Say the integration needs a Cloudflare API token and link to “Creating API tokens,” and may mention that the token needs **Account - Workers KV Storage: Edit** (or similar) permissions.

**Reality:** The integration writes flag data from LaunchDarkly into your Workers KV namespace. For that to work, the API token must have **at least** edit (read/write) access to **Workers KV Storage** at the account level. Without it, the integration cannot populate the KV namespace and the SDK will not find flag data in KV.

**Ask:** Explicitly state that the Cloudflare API token used for the integration must have **Workers KV Storage: Edit** (or equivalent edit access to KV) at minimum, and that this is required for the integration to sync flag data to the configured KV namespace.

---

## 9. Flush events before the worker exits (analytics / experimentation)

**Page:** [Cloudflare SDK reference](https://launchdarkly.com/docs/sdk/edge/cloudflare) (Initialize the client, Example Worker), [Flushing events – Cloudflare](https://launchdarkly.com/docs/sdk/features/flush#cloudflare)

**Current docs:** The SDK reference shows initializing with `sendEvents: true` and the Example Worker returns a response without calling `flush`. The Flushing events page does document that edge workers must flush before exit and suggests `executionContext.waitUntil(client.flush())`.

**Reality:** With `sendEvents: true`, analytics events are buffered and sent in the background. Cloudflare Workers are short-lived; if you return the response and the worker exits before the SDK sends the buffer, **events never reach LaunchDarkly** and nothing shows up in the dashboard (Contexts, experiments, metrics). This is easy to miss because the worker “works” (flags evaluate correctly from KV) but analytics don’t.

**Ask:** In the Cloudflare SDK reference, (a) in the Example Worker and any “get started” flow that uses `sendEvents: true`, add a call to `ctx.waitUntil(client.flush())` before returning the response, with a one-line comment that flush is required so events reach LaunchDarkly before the worker exits; (b) in the Initialize the client section (or immediately after the Example Worker), add a short note that if you enable sending events, you must flush before the worker exits (and link to the Flushing events – Cloudflare section).

---

*Captured for use when requesting updates to LaunchDarkly Cloudflare SDK / integration documentation.*
