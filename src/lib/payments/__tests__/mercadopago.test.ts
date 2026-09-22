import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";
import { assinaturaConfere, mercadoPagoConfigurado } from "../mercadopago";

const SEGREDO = "segredo-de-teste-do-webhook";

/** Monta uma assinatura válida do mesmo jeito que o Mercado Pago faria. */
function assinar(dataId: string, requestId: string, ts = "1758000000") {
  const manifesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", SEGREDO).update(manifesto).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

/**
 * Cada teste define o ambiente de que precisa. Sem isto, rodar a suíte com
 * MERCADOPAGO_ACCESS_TOKEN já exportado no terminal — ou com um .env
 * carregado — fazia o teste falhar por motivo alheio ao código.
 */
function limpar() {
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
}
beforeEach(limpar);
afterEach(limpar);

describe("mercadoPagoConfigurado", () => {
  it("depende do token de acesso", () => {
    assert.equal(mercadoPagoConfigurado(), false);
    process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-alguma-coisa";
    assert.equal(mercadoPagoConfigurado(), true);
  });
});

describe("assinaturaConfere", () => {
  it("aceita uma assinatura legítima", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO;
    const ok = assinaturaConfere({
      xSignature: assinar("123456789", "req-abc"),
      xRequestId: "req-abc",
      dataId: "123456789",
    });
    assert.equal(ok, true);
  });

  it("recusa assinatura de outro pagamento", () => {
    // O ataque óbvio: pegar uma notificação real e trocar o id do pagamento.
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO;
    const ok = assinaturaConfere({
      xSignature: assinar("123456789", "req-abc"),
      xRequestId: "req-abc",
      dataId: "999999999",
    });
    assert.equal(ok, false);
  });

  it("recusa assinatura feita com outro segredo", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = "outro-segredo-completamente-diferente";
    const ok = assinaturaConfere({
      xSignature: assinar("123456789", "req-abc"),
      xRequestId: "req-abc",
      dataId: "123456789",
    });
    assert.equal(ok, false);
  });

  it("recusa quando o request-id não bate", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO;
    const ok = assinaturaConfere({
      xSignature: assinar("123456789", "req-abc"),
      xRequestId: "req-outro",
      dataId: "123456789",
    });
    assert.equal(ok, false);
  });

  it("recusa cabeçalho ausente ou malformado", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO;
    const base = { xRequestId: "req-abc", dataId: "123456789" };
    assert.equal(assinaturaConfere({ ...base, xSignature: null }), false);
    assert.equal(assinaturaConfere({ ...base, xSignature: "" }), false);
    assert.equal(assinaturaConfere({ ...base, xSignature: "lixo" }), false);
    assert.equal(assinaturaConfere({ ...base, xSignature: "ts=1758000000" }), false);
    assert.equal(assinaturaConfere({ ...base, xSignature: "v1=abc" }), false);
  });

  it("trata o id sem diferenciar maiúsculas", () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO;
    const ok = assinaturaConfere({
      xSignature: assinar("abc123", "req-abc"),
      xRequestId: "req-abc",
      dataId: "ABC123",
    });
    assert.equal(ok, true);
  });

  it("devolve null quando não há segredo cadastrado", () => {
    // Nesse caso quem chama decide; a reconsulta na API é que protege.
    const r = assinaturaConfere({ xSignature: "ts=1,v1=2", xRequestId: "x", dataId: "1" });
    assert.equal(r, null);
  });
});
