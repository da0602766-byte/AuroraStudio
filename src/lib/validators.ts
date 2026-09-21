import { z } from "zod";
import { isDateStr, isTimeStr } from "./time";

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""));

export const bookingRequestSchema = z
  .object({
    serviceId: z.string().min(1).max(40),
    date: z.string().refine(isDateStr, "Data inválida."),
    time: z.string().refine(isTimeStr, "Horário inválido."),
    name: texto(80).pipe(z.string().min(2, "Informe seu nome.")),
    phone: z.string().max(30),
    email: z.union([z.literal(""), z.string().trim().email("E-mail inválido.").max(120)]).optional(),
    isAllergic: z.boolean(),
    allergyDetails: texto(300).optional(),
    isPregnant: z.boolean(),
    notes: texto(500).optional(),
    healthConsent: z.literal(true, { errorMap: () => ({ message: "É preciso autorizar o uso das informações de saúde." }) }),
    website: z.string().max(0).optional(), // campo-armadilha contra robôs
  })
  .refine((d) => !d.isAllergic || (d.allergyDetails && d.allergyDetails.length >= 2), {
    message: "Conte a que você tem alergia.",
    path: ["allergyDetails"],
  });

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: texto(600).pipe(z.string().min(5, "Escreva um comentário.")),
});
