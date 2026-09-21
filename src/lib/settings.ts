import { cache } from "react";
import { prisma } from "./db";
import { cacheSite } from "./cache";

export const getSettings = cache(async () => {
  const s = await prisma.businessSettings.findUnique({ where: { id: 1 } });
  if (s) return s;
  return prisma.businessSettings.create({ data: { id: 1, name: "Aurora Studio" } });
});

export const getDefaultProfessional = cache(async () => {
  const pro =
    (await prisma.professional.findFirst({ where: { isDefault: true, active: true } })) ??
    (await prisma.professional.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }));
  if (!pro) throw new Error("Nenhuma profissional cadastrada. Execute: npm run db:seed");
  return pro;
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;

/**
 * Mesmas configurações, guardadas entre visitas. Usar nas páginas públicas;
 * o painel continua com `getSettings()` para sempre ler o valor atual.
 */
export const getCachedSettings = cacheSite(() => getSettings(), ["configuracoes-do-negocio"]);
