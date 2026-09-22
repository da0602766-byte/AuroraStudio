import { headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "./db";

/**
 * Limitador simples em memória. Em hospedagem serverless cada instância tem
 * sua própria memória, então ele reduz abusos mas não é absoluto.
 * Para tráfego alto, troque por um armazenamento compartilhado (ex.: Upstash Redis).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

/**
 * Limite compartilhado para ações sensíveis. Funciona mesmo quando a Netlify
 * envia duas tentativas para instâncias serverless diferentes.
 */
export async function sharedRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const hashedKey = createHash("sha256").update(key).digest("hex");
  const [bucket] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${hashedKey}, 1, ${resetAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" < ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" < ${now} THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count"
  `;
  // Limpeza eventual evita crescimento indefinido sem adicionar uma consulta
  // a cada requisição sensível.
  if (Math.random() < 0.01) {
    await prisma.rateLimitBucket.deleteMany({
      where: { resetAt: { lt: new Date(now.getTime() - 86_400_000) } },
    });
  }
  return (bucket?.count ?? limit + 1) <= limit;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}
