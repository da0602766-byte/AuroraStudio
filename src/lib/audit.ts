import { prisma } from "./db";

export async function audit(
  adminUserId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: string | Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId,
        action,
        entity,
        entityId: entityId ?? null,
        details: typeof details === "string" ? details : details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    console.error("Falha ao registrar auditoria", e);
  }
}
