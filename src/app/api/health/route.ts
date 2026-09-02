import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Used by uptime monitoring. Reports the database and which integrations are
 * configured, without exposing any secret.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  let advisors = 0;
  try {
    advisors = await db.advisor.count({ where: { isActive: true } });
  } catch {
    database = "error";
  }
  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    latencyMs: Date.now() - started,
    advisors,
    integrations: {
      ai: Boolean(process.env.ANTHROPIC_API_KEY),
      embeddings: Boolean(process.env.VOYAGE_API_KEY),
      email: Boolean(process.env.RESEND_API_KEY),
      kajabi: Boolean(process.env.KAJABI_WEBHOOK_SECRET),
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    time: new Date().toISOString(),
  };
  return Response.json(body, { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
