import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysLocal,
  dayRangeUtc,
  isDateStr,
  isTimeStr,
  localDateOf,
  localTimeOf,
  localToUtc,
  timeLabel,
  weekdayOf,
} from "../time";

describe("isDateStr / isTimeStr", () => {
  it("aceita apenas o formato exato", () => {
    assert.equal(isDateStr("2026-09-22"), true);
    assert.equal(isDateStr("2026-9-22"), false);
    assert.equal(isDateStr("22/09/2026"), false);
    assert.equal(isDateStr(20260922), false);
  });

  it("recusa horas fora do relógio de 24h", () => {
    assert.equal(isTimeStr("09:30"), true);
    assert.equal(isTimeStr("23:59"), true);
    assert.equal(isTimeStr("24:00"), false);
    assert.equal(isTimeStr("09:60"), false);
    assert.equal(isTimeStr("9:30"), false);
  });
});

describe("localToUtc", () => {
  it("converte o horário do estúdio para UTC (UTC-3)", () => {
    assert.equal(localToUtc("2026-09-22", "09:30").toISOString(), "2026-09-22T12:30:00.000Z");
  });

  it("volta ao horário local sem perder nada", () => {
    const d = localToUtc("2026-01-15", "16:45");
    assert.equal(localDateOf(d), "2026-01-15");
    assert.equal(localTimeOf(d), "16:45");
  });

  it("mantém a meia-noite local no dia certo", () => {
    // Um erro de fuso aqui jogaria o início do dia para a véspera.
    assert.equal(localDateOf(localToUtc("2026-09-22", "00:00")), "2026-09-22");
  });
});

describe("addDaysLocal", () => {
  it("atravessa o fim do mês", () => {
    assert.equal(addDaysLocal("2026-09-30", 1), "2026-10-01");
  });

  it("atravessa o fim do ano e anos bissextos", () => {
    assert.equal(addDaysLocal("2026-12-31", 1), "2027-01-01");
    assert.equal(addDaysLocal("2028-02-28", 1), "2028-02-29");
  });

  it("anda para trás", () => {
    assert.equal(addDaysLocal("2026-03-01", -1), "2026-02-28");
  });
});

describe("weekdayOf", () => {
  it("usa 0 para domingo e 6 para sábado", () => {
    assert.equal(weekdayOf("2026-09-20"), 0); // domingo
    assert.equal(weekdayOf("2026-09-22"), 2); // terça
    assert.equal(weekdayOf("2026-09-26"), 6); // sábado
  });
});

describe("dayRangeUtc", () => {
  it("cobre o dia local inteiro, sem sobra nem falta", () => {
    const { start, end } = dayRangeUtc("2026-09-22");
    assert.equal(start.toISOString(), "2026-09-22T03:00:00.000Z");
    assert.equal(end.toISOString(), "2026-09-23T03:00:00.000Z");
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  });
});

describe("timeLabel", () => {
  it("escreve a hora do jeito que a cliente lê", () => {
    assert.equal(timeLabel("09:30"), "9h30");
    assert.equal(timeLabel("14:00"), "14h");
    assert.equal(timeLabel("08:05"), "8h05");
  });
});
