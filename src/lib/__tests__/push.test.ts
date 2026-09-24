import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { pushConfigurado } from "../push";

// Par gerado só para este teste, sem uso em produção.
const CHAVE_PUBLICA = "BPIRTvwg_zs7efH4s-T4vYBg32RBhoIp5IWNBLImDE3O5w9OZhjBWEL_aixc88YLGvuJnaV1l31p0A4tSpKJ3iw";
const CHAVE_PRIVADA = "1IaGG1LXZENoWii4rfqcd6Jo9nsBAJwJUx-RO1FrPds";

function limpar() {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
}
beforeEach(limpar);
afterEach(limpar);

describe("pushConfigurado", () => {
  it("exige as duas chaves VAPID", () => {
    assert.equal(pushConfigurado(), false);
    process.env.VAPID_PUBLIC_KEY = CHAVE_PUBLICA;
    assert.equal(pushConfigurado(), false, "só a pública não basta");
  });

  it("fica pronto com as duas chaves válidas", () => {
    process.env.VAPID_PUBLIC_KEY = CHAVE_PUBLICA;
    process.env.VAPID_PRIVATE_KEY = CHAVE_PRIVADA;
    assert.equal(pushConfigurado(), true);
  });

  it("não derruba a chamada com uma chave malformada", () => {
    process.env.VAPID_PUBLIC_KEY = "isto-nao-e-uma-chave-vapid-valida";
    process.env.VAPID_PRIVATE_KEY = "nem-esta";
    assert.equal(pushConfigurado(), false);
  });
});
