import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const services = await prisma.service.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/galeria`, changeFrequency: "weekly" },
    { url: `${base}/agendar`, changeFrequency: "daily" },
    ...services.map((s) => ({ url: `${base}/servicos/${s.slug}`, lastModified: s.updatedAt })),
  ];
}
