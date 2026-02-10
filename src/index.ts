/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { init } from '@launchdarkly/cloudflare-server-sdk';

let ldClient: ReturnType<typeof init> | null = null;

async function getOrCreateClient(env: Env): Promise<ReturnType<typeof init>> {
	if (ldClient) return ldClient;
	ldClient = init('6985ea9b02bfff0a175a8d3d', env.LD_KV as Parameters<typeof init>[1], { sendEvents: true });
	await ldClient.waitForInitialization();
	return ldClient;
}

/** Paths used in LaunchDarkly targeting rules (context.path). Used for nav and docs. */
const TARGETING_PATHS = [
	{ path: '/', label: 'Home' },
	{ path: '/products', label: 'Products' },
	{ path: '/product', label: 'Product detail' },
	{ path: '/cart', label: 'Cart' },
	{ path: '/checkout', label: 'Checkout' },
	{ path: '/account', label: 'Account' },
	{ path: '/search', label: 'Search' },
	{ path: '/blog', label: 'Blog' },
	{ path: '/pricing', label: 'Pricing' },
	{ path: '/contact', label: 'Contact' },
	{ path: '/faq', label: 'FAQ' },
	{ path: '/login', label: 'Login' },
] as const;

const ADJECTIVES = ['Swift', 'Brave', 'Curious', 'Bold', 'Calm', 'Eager', 'Gentle', 'Happy', 'Lucky', 'Noble', 'Proud', 'Wise'];
const ANIMALS = ['Panda', 'Fox', 'Owl', 'Bear', 'Wolf', 'Lynx', 'Hawk', 'Otter', 'Seal', 'Deer', 'Crow', 'Hare'];

/** Picks a random display name (adjective + animal), e.g. "Swift Panda". */
function randomName(): string {
	const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
	const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
	return `${adj} ${animal}`;
}

/** Build context from request: path from URL, and a new UUID + random name per request. */
function getContext(request: Request): { kind: string; key: string; name: string; path: string } {
	const url = new URL(request.url);
	return {
		kind: 'user',
		key: crypto.randomUUID(),
		name: randomName(),
		path: url.pathname || '/',
	};
}

/**
 * Fetches all flag states for the given context and their evaluation reasons,
 * then returns an HTML overview.
 *
 * Filtering flags by delivery reason:
 * - Use reason.kind to decide which flags are "relevant" for this context (e.g. this path).
 * - RULE_MATCH (or TARGET_MATCH) = the flag matched a targeting rule for this context → include it
 *   when you only want to send flags that actually target the current request (e.g. page type).
 * - FALLTHROUGH = no rule matched, fallthrough variation was used → typically exclude when
 *   isolating by context (e.g. don't send homepage flags when the user is on /products).
 * - OFF = flag is off → exclude for the same reason as FALLTHROUGH.
 * So to "filter to flags relevant for this context", keep only flags where
 * reason !== null && (reason.kind === 'RULE_MATCH' || reason.kind === 'TARGET_MATCH').
 *
 * Experiment bucketing:
 * - When a user is bucketed into an experiment, the reason object includes inExperiment: true.
 * - When not in an experiment, inExperiment is absent (not false). We treat presence and
 *   value === true as "in experiment" for display.
 *
 * @see https://launchdarkly.github.io/js-core/packages/sdk/cloudflare/docs/interfaces/LDFlagsState.html#getFlagReason
 */
async function getAllFlagsOverview(client: ReturnType<typeof init>, context: ReturnType<typeof getContext>): Promise<string> {
	// Request full flag state plus evaluation reasons so we can filter by reason.kind and show inExperiment.
	const state = await client.allFlagsState(context, { withReasons: true });
	const values = state.allValues();
	const keys = Object.keys(values);

	if (keys.length === 0) {
		return '<p>No flags in state for this context.</p>';
	}

	// Generate analytics events: call variation() for each flag that matched a rule (RULE_MATCH).
	// allFlagsState() does not emit evaluation events; variation() does, so we call it for "relevant" flags only.
	const ruleMatchKeys = keys.filter((key) => {
		const reason = state.getFlagReason(key);
		return reason != null && ((reason as { kind: string }).kind === 'RULE_MATCH' || (reason as { kind: string }).kind === 'TARGET_MATCH');
	});
	await Promise.all(ruleMatchKeys.map((key) => client.variation(key, context, false)));

	const rows = keys.map((key) => {
		const value = values[key];
		const reason = state.getFlagReason(key);
		// reason.kind: RULE_MATCH = matched a rule for this context; FALLTHROUGH/OFF = did not (use to filter "relevant" flags).
		const reasonText = reason
			? `${(reason as { kind: string }).kind}${(reason as { ruleIndex?: number }).ruleIndex != null ? ` (rule ${(reason as { ruleIndex?: number }).ruleIndex})` : ''}`
			: '—';
		// inExperiment is only present and true when the variation was served via an experiment; otherwise absent.
		const inExperiment = reason && (reason as { inExperiment?: boolean }).inExperiment === true;
		const inExperimentDisplay = inExperiment ? 'Yes' : '—';
		const valueDisplay = value === null ? '<em>default</em>' : JSON.stringify(value);
		return `<tr><td><code>${escapeHtml(key)}</code></td><td>${valueDisplay}</td><td>${escapeHtml(reasonText)}</td><td>${escapeHtml(inExperimentDisplay)}</td></tr>`;
	});

	return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>LaunchDarkly flags</title>
<style>
  .path-nav { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:8px 0 16px; }
  .path-nav a { display:inline-block; margin:0; padding:8px 14px; background:#eee; color:#333; text-decoration:none; border-radius:6px; font-size:14px; white-space:nowrap; }
  .path-nav a:hover { background:#ddd; }
  .path-nav a.active { background:#333; color:#fff; }
  body { font-family:system-ui,sans-serif; max-width:900px; margin:24px auto; padding:0 16px; }
  table { border-collapse:collapse; width:100%; margin-top:16px; }
  th, td { border:1px solid #ccc; padding:8px 12px; text-align:left; }
  th { background:#f5f5f5; }
</style>
</head>
<body>
  <h1>All flags for context</h1>
  <p><strong>Context:</strong> <code>${escapeHtml(JSON.stringify(context))}</code></p>
  <p><strong>Go to path:</strong></p>
  <div class="path-nav">${TARGETING_PATHS.map(({ path: p, label }) => `<a href="${escapeHtml(p)}"${context.path === p ? ' class="active"' : ''}>${escapeHtml(label)}</a>`).join('')}</div>
  <table>
  <thead><tr><th>Flag key</th><th>Value</th><th>Reason</th><th>In experiment</th></tr></thead>
  <tbody>${rows.join('')}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const client = await getOrCreateClient(env);
		const context = getContext(request);
		const html = await getAllFlagsOverview(client, context);
		// Flush analytics events before the worker exits so they reach LaunchDarkly.
		// waitUntil keeps the worker alive until flush completes without delaying the response.
		ctx.waitUntil(client.flush());
		return new Response(html, {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	},
} satisfies ExportedHandler<Env>;
