import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  const client = new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  client.$use(async (params, next) => {
    const startedAt = Date.now();
    const result = await next(params);
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 300) {
      console.warn("Consulta lenta no banco", {
        model: params.model ?? "raw",
        action: params.action,
        durationMs,
      });
    }
    return result;
  });
  return client;
}

export const prisma =
  globalForPrisma.prisma ??
  createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Cliente do banco ou cliente de uma transação em andamento. */
export type Db = PrismaClient | Prisma.TransactionClient;
