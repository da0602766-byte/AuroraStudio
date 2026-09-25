import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scheduleLines } from "../schedule";

describe("scheduleLines", () => {
  it("junta dias seguidos que têm os mesmos horários", () => {
    const slots = [2, 3, 4, 5].flatMap((weekday) => [
      { weekday, time: "09:30" },
      { weekday, time: "10:30" },
    ]);
    assert.deepEqual(scheduleLines(slots), [{ label: "Terça a sexta", times: "9h30, 10h30" }]);
  });

  it("separa o dia que tem horários diferentes", () => {
    const slots = [
      ...[2, 3].flatMap((weekday) => [{ weekday, time: "09:30" }]),
      { weekday: 6, time: "08:30" },
    ];
    assert.deepEqual(scheduleLines(slots), [
      { label: "Terça a quarta", times: "9h30" },
      { label: "Sábado", times: "8h30" },
    ]);
  });

  it("não agrupa dias que não são vizinhos", () => {
    const slots = [
      { weekday: 2, time: "09:30" },
      { weekday: 5, time: "09:30" },
    ];
    assert.deepEqual(scheduleLines(slots), [
      { label: "Terça", times: "9h30" },
      { label: "Sexta", times: "9h30" },
    ]);
  });

  it("ordena os horários do mesmo dia", () => {
    const slots = [
      { weekday: 2, time: "14:30" },
      { weekday: 2, time: "09:30" },
    ];
    assert.deepEqual(scheduleLines(slots), [{ label: "Terça", times: "9h30, 14h30" }]);
  });

  it("aguenta lista vazia", () => {
    assert.deepEqual(scheduleLines([]), []);
  });
});
