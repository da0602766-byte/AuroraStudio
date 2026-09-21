import type { BookingStatus } from "@prisma/client";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando sinal",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  NAO_COMPARECEU: "Não compareceu",
};

export const STATUS_CLASS: Record<BookingStatus, string> = {
  AGUARDANDO_PAGAMENTO: "bg-ouro-palido text-marrom",
  CONFIRMADO: "bg-emerald-50 text-emerald-800",
  CONCLUIDO: "bg-po-escuro text-marrom",
  CANCELADO: "bg-stone-100 text-stone-600",
  NAO_COMPARECEU: "bg-rose-50 text-bordo",
};

export const ACTIVE_STATUSES: BookingStatus[] = ["AGUARDANDO_PAGAMENTO", "CONFIRMADO"];
