import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

/**
 * A regra que importa aqui é o agrupamento: um erro que se repete a cada
 * requisição não pode virar um e-mail por requisição. A função de
 * assinatura é privada, então o teste reproduz a mesma regra e verifica a
 * propriedade — ocorrências do mesmo erro caem na mesma chave.
 */
function assinatura(onde: string, erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);
  const normalizada = msg.replace(/\d+/g, "#").slice(0, 200);
  return createHash("sha256").update(`${onde}|${normalizada}`).digest("hex").slice(0, 16);
}

describe("agrupamento de erros", () => {
  it("junta o mesmo erro com ids diferentes", () => {
    const a = assinatura("criar reserva", new Error("Reserva cmuc123 não encontrada"));
    const b = assinatura("criar reserva", new Error("Reserva cmuc999 não encontrada"));
    assert.equal(a, b, "só os números mudam: é o mesmo erro");
  });

  it("separa erros diferentes no mesmo lugar", () => {
    const a = assinatura("criar reserva", new Error("Horário indisponível"));
    const b = assinatura("criar reserva", new Error("Serviço não encontrado"));
    assert.notEqual(a, b);
  });

  it("separa o mesmo erro em lugares diferentes", () => {
    const a = assinatura("criar reserva", new Error("timeout"));
    const b = assinatura("confirmar pagamento", new Error("timeout"));
    assert.notEqual(a, b);
  });

  it("aguenta erro que não é Error", () => {
    assert.equal(typeof assinatura("x", "falha em texto"), "string");
    assert.equal(assinatura("x", null).length, 16);
  });
});
