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

const context = {
	"kind": 'user',
	"key": 'example-user-key',
	"name": 'Sandy',
	"path": '/'
 };

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const client = await getOrCreateClient(env);
		const flagValue = await client.variation('homepage-flag', context, false);

		return new Response(`Hello World! The value of the homepage flag is: ${flagValue}`);
	},
} satisfies ExportedHandler<Env>;
