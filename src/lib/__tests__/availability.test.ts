import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "../db";
import { getDaySummaries, getSlotsForRange } from "../availability";
import { addDaysLocal, localToUtc, todayLocal } from "../time";

type Periodo = { startsAt: Date; endsAt: Date };

/**
 * Banco de mentira: devolve os dados combinados no teste.
 * A filtragem por intervalo feita no SQL é só um pré-filtro — quem decide se o
 * horário está livre é a conta em JavaScript dentro de `getSlotsForRange`,
 * e é exatamente ela que estes testes exercitam.
 */
function fakeDb(dados: {
  working?: { weekday: number; time: string }[];
  bookings?: Periodo[];
  blocks?: Periodo[];
}): Db {
  return {
    workingSlot: { findMany: async () => dados.working ?? [] },
    booking: { findMany: async () => dados.bookings ?? [] },
    timeBlock: { findMany: async () => dados.blocks ?? [] },
  } as unknown as Db;
}

const periodo = (date: string, time: string, minutos: number): Periodo => {
  const startsAt = localToUtc(date, time);
  return { startsAt, endsAt: new Date(startsAt.getTime() + minutos * 60_000) };
};

// Uma terça-feira bem à frente, para nunca esbarrar nas regras de prazo.
const TERCA = "2027-09-21";
const REGRAS = { minAdvanceHours: 24, bookingWindowDays: 3650 };
const base = { professionalId: "pro-1", durationMinutes: 60, rules: REGRAS };

const horarios = (working: { weekday: number; time: string }[] = [{ weekday: 2, time: "09:30" }, { weekday: 2, time: "10:30" }]) => working;

describe("getSlotsForRange — montagem dos horários", () => {
  it("oferece os horários cadastrados para aquele dia da semana", async () => {
    const res = await getSlotsForRange(fakeDb({ working: horarios() }), {
      ...base,
      fromDate: TERCA,
      toDate: TERCA,
    });
    assert.deepEqual(res[TERCA].map((s) => s.time), ["09:30", "10:30"]);
    assert.ok(res[TERCA].every((s) => s.available));
  });

  it("devolve lista vazia em dia sem atendimento", async () => {
    const domingo = "2027-09-19";
    const res = await getSlotsForRange(fakeDb({ working: horarios() }), {
      ...base,
      fromDate: domingo,
      toDate: domingo,
    });
    assert.deepEqual(res[domingo], []);
  });

  it("devolve uma entrada para cada dia do intervalo pedido", async () => {
    const res = await getSlotsForRange(fakeDb({ working: horarios() }), {
      ...base,
      fromDate: TERCA,
      toDate: addDaysLocal(TERCA, 2),
    });
    assert.deepEqual(Object.keys(res), [TERCA, addDaysLocal(TERCA, 1), addDaysLocal(TERCA, 2)]);
  });
});

describe("getSlotsForRange — ocupação", () => {
  it("marca como ocupado o horário que tem reserva em cima", async () => {
    const res = await getSlotsForRange(
      fakeDb({ working: horarios(), bookings: [periodo(TERCA, "09:30", 60)] }),
      { ...base, fromDate: TERCA, toDate: TERCA }
    );
    assert.equal(res[TERCA][0].available, false);
    assert.equal(res[TERCA][1].available, true);
  });

  it("não bloqueia o horário que começa quando a reserva anterior termina", async () => {
    // Reserva das 8h30 às 9h30: as 9h30 continuam livres.
    const res = await getSlotsForRange(
      fakeDb({ working: horarios(), bookings: [periodo(TERCA, "08:30", 60)] }),
      { ...base, fromDate: TERCA, toDate: TERCA }
    );
    assert.equal(res[TERCA][0].available, true);
  });

  it("um serviço longo esbarra na reserva seguinte", async () => {
    // Serviço de 2h às 9h30 avança sobre a reserva das 10h30.
    const res = await getSlotsForRange(
      fakeDb({ working: horarios(), bookings: [periodo(TERCA, "10:30", 60)] }),
      { ...base, durationMinutes: 120, fromDate: TERCA, toDate: TERCA }
    );
    assert.equal(res[TERCA][0].available, false);
  });

  it("bloqueio de agenda também tira o horário", async () => {
    // Bloqueio das 10h30 às 12h: pega as 10h30 e deixa as 9h30 (que termina
    // exatamente às 10h30) de pé.
    const res = await getSlotsForRange(
      fakeDb({ working: horarios(), blocks: [periodo(TERCA, "10:30", 90)] }),
      { ...base, fromDate: TERCA, toDate: TERCA }
    );
    assert.equal(res[TERCA][0].available, true);
    assert.equal(res[TERCA][1].available, false);
  });

  it("bloqueio que começa no meio do serviço também conta", async () => {
    // Bloqueio das 10h às 12h invade o serviço das 9h30, que vai até 10h30.
    const res = await getSlotsForRange(
      fakeDb({ working: horarios(), blocks: [periodo(TERCA, "10:00", 120)] }),
      { ...base, fromDate: TERCA, toDate: TERCA }
    );
    assert.equal(res[TERCA][0].available, false);
  });
});

describe("getSlotsForRange — regras de prazo", () => {
  it("esconde horários dentro da antecedência mínima", async () => {
    const hoje = todayLocal();
    const db = fakeDb({ working: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: "09:30" })) });
    const res = await getSlotsForRange(db, {
      ...base,
      fromDate: hoje,
      toDate: hoje,
      rules: { minAdvanceHours: 24 * 365, bookingWindowDays: 3650 },
    });
    assert.ok(res[hoje].every((s) => !s.available));
  });

  it("não oferece nada depois da janela de agendamento", async () => {
    const hoje = todayLocal();
    const longe = addDaysLocal(hoje, 90);
    const db = fakeDb({ working: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: "09:30" })) });
    const res = await getSlotsForRange(db, {
      ...base,
      fromDate: longe,
      toDate: longe,
      rules: { minAdvanceHours: 0, bookingWindowDays: 30 },
    });
    assert.deepEqual(res[longe], []);
  });

  it("ignoreRules libera a agenda para o painel", async () => {
    const hoje = todayLocal();
    const db = fakeDb({ working: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: "23:30" })) });
    const res = await getSlotsForRange(db, {
      ...base,
      fromDate: hoje,
      toDate: hoje,
      rules: { minAdvanceHours: 24 * 365, bookingWindowDays: 1 },
      ignoreRules: true,
    });
    assert.equal(res[hoje].length, 1);
  });
});

describe("getDaySummaries", () => {
  it("conta o total e quantos sobraram livres", async () => {
    const res = await getDaySummaries(
      fakeDb({ working: horarios(), bookings: [periodo(TERCA, "09:30", 60)] }),
      { ...base, fromDate: TERCA, toDate: TERCA }
    );
    assert.deepEqual(res, [{ date: TERCA, total: 2, available: 1 }]);
  });
});
