// Pings the staging API's readiness endpoint so the Render free instance never sleeps AND the hosted
// Postgres project sees daily traffic (a /health/live-only pinger keeps Render awake but lets the database
// itself idle-suspend). The scheduled handler runs on the cron in wrangler.jsonc; the fetch handler lets you
// test on demand by opening the worker URL. Types are declared locally so the repo needs no
// @cloudflare/workers-types install.

interface Env {
  TARGET_URL: string;
}

interface ScheduledController {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const target = (env: Env) => `${(env.TARGET_URL || 'https://artist-project.onrender.com').replace(/\/$/, '')}/health/ready`;

async function ping(env: Env): Promise<{ ok: boolean; status: number; ms: number }> {
  const started = Date.now();
  try {
    const res = await fetch(target(env), { headers: { 'user-agent': 'artist-keep-warm/1.0' } });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - started };
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      ping(env).then((result) => {
        console.log(JSON.stringify({ event: 'keep-warm', target: target(env), ...result }));
      }),
    );
  },

  async fetch(_request: Request, env: Env): Promise<Response> {
    const result = await ping(env);
    return Response.json({ event: 'keep-warm', target: target(env), ...result });
  },
};
