import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ehPendencia, juntarAvisos, type Aviso } from "../avisos";

function aviso(id: string, tipo: Aviso["tipo"], em: string): Aviso {
  return { id, tipo, titulo: id, texto: id, href: `/admin/reservas/${id}`, em };
}

describe("ehPendencia", () => {
  it("separa o que espera ação do que só aconteceu", () => {
    assert.equal(ehPendencia("sinal"), true);
    assert.equal(ehPendencia("comprovante"), true);
    assert.equal(ehPendencia("reserva"), false);
    assert.equal(ehPendencia("pagamento"), false);
  });
});

describe("juntarAvisos", () => {
  it("acumula eventos entre consultas", () => {
    const antes = [aviso("reserva:1", "reserva", "2026-09-24T10:00:00.000Z")];
    const r = juntarAvisos(antes, [aviso("reserva:2", "reserva", "2026-09-24T11:00:00.000Z")], []);
    assert.deepEqual(r.map((a) => a.id), ["reserva:2", "reserva:1"]);
  });

  it("troca as pendências pela lista nova em vez de somar", () => {
    const antes = [aviso("sinal:1", "sinal", "2026-09-24T09:00:00.000Z")];
    // O sinal 1 foi pago: o servidor não o manda mais, então ele some.
    const r = juntarAvisos(antes, [], [aviso("sinal:2", "sinal", "2026-09-24T09:30:00.000Z")]);
    assert.deepEqual(r.map((a) => a.id), ["sinal:2"]);
  });

  it("põe o que espera ação acima do que só aconteceu", () => {
    const r = juntarAvisos(
      [],
      [aviso("reserva:9", "reserva", "2026-09-24T23:00:00.000Z")],
      [aviso("sinal:1", "sinal", "2026-09-24T08:00:00.000Z")]
    );
    assert.deepEqual(r.map((a) => a.id), ["sinal:1", "reserva:9"]);
  });

  it("não repete o mesmo aviso quando ele chega duas vezes", () => {
    const antes = [aviso("reserva:1", "reserva", "2026-09-24T10:00:00.000Z")];
    const r = juntarAvisos(antes, [aviso("reserva:1", "reserva", "2026-09-24T10:00:00.000Z")], []);
    assert.equal(r.length, 1);
  });

  it("ordena cada grupo do mais novo para o mais velho", () => {
    const r = juntarAvisos(
      [],
      [
        aviso("reserva:a", "reserva", "2026-09-24T08:00:00.000Z"),
        aviso("reserva:b", "reserva", "2026-09-24T12:00:00.000Z"),
      ],
      []
    );
    assert.deepEqual(r.map((a) => a.id), ["reserva:b", "reserva:a"]);
  });

  it("não deixa a lista crescer sem fim", () => {
    const muitos = Array.from({ length: 50 }, (_, i) =>
      aviso(`reserva:${i}`, "reserva", new Date(Date.UTC(2026, 8, 24, 0, i)).toISOString())
    );
    assert.equal(juntarAvisos(muitos, [], []).length, 30);
  });
});
