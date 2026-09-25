import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "../db";
import { mediasPorServico } from "../reviews";

type Avaliacao = { rating: number; booking: { serviceId: string } | null };

function fakeDb(avaliacoes: Avaliacao[]): Db {
  return {
    review: { findMany: async () => avaliacoes },
  } as unknown as Db;
}

describe("mediasPorServico", () => {
  it("calcula a média e a contagem por serviço", async () => {
    const db = fakeDb([
      { rating: 5, booking: { serviceId: "corte" } },
      { rating: 3, booking: { serviceId: "corte" } },
      { rating: 4, booking: { serviceId: "sobrancelha" } },
    ]);
    const medias = await mediasPorServico(db);
    assert.equal(medias.corte.media, 4);
    assert.equal(medias.corte.total, 2);
    assert.equal(medias.sobrancelha.media, 4);
    assert.equal(medias.sobrancelha.total, 1);
  });

  it("ignora avaliação sem reserva vinculada", async () => {
    const db = fakeDb([{ rating: 5, booking: null }]);
    const medias = await mediasPorServico(db);
    assert.deepEqual(medias, {});
  });

  it("devolve objeto vazio sem nenhuma avaliação", async () => {
    const medias = await mediasPorServico(fakeDb([]));
    assert.deepEqual(medias, {});
  });
});
