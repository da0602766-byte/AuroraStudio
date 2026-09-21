import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

/** Fuso do estúdio. Todas as datas são gravadas em UTC e exibidas neste fuso. */
export const TZ = "America/Sao_Paulo";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDateStr = (s: unknown): s is string => typeof s === "string" && DATE_RE.test(s);
export const isTimeStr = (s: unknown): s is string => typeof s === "string" && TIME_RE.test(s);

/** "2026-09-22" + "09:30" (horário local) → Date em UTC */
export function localToUtc(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time}:00`, TZ);
}

/**
 * Aceita `string`/`number` além de `Date`: valores que passam pelo cache do
 * site voltam serializados, e converter aqui evita um erro só em produção.
 */
export function fmt(date: Date | string | number, pattern: string): string {
  return formatInTimeZone(typeof date === "object" ? date : new Date(date), TZ, pattern, { locale: ptBR });
}

export const localDateOf = (d: Date | string | number) => fmt(d, "yyyy-MM-dd");
export const localTimeOf = (d: Date | string | number) => fmt(d, "HH:mm");
export const todayLocal = () => localDateOf(new Date());

export function addDaysLocal(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function dayRangeUtc(date: string) {
  return { start: localToUtc(date, "00:00"), end: localToUtc(addDaysLocal(date, 1), "00:00") };
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "09:30" → "9h30" */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
}

/** Ex.: "terça-feira, 22 de setembro" */
export const longDate = (d: Date | string | number) => fmt(d, "EEEE, d 'de' MMMM");
export const shortDateTime = (d: Date | string | number) => fmt(d, "dd/MM 'às' HH:mm");
