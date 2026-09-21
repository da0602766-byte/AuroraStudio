import type { BookingStatus } from "@prisma/client";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/status";

export function StatusBadge({ status, proof }: { status: BookingStatus; proof?: boolean }) {
  return (
    <span className={`tag ${STATUS_CLASS[status]}`}>
      {status === "AGUARDANDO_PAGAMENTO" && proof ? "Conferir Pix" : STATUS_LABEL[status]}
    </span>
  );
}
