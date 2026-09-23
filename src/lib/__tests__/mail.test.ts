import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { emailConfigurado, emailDaProprietaria, esc, moldura } from "../mail";

function limpar() {
  delete process.env.BREVO_API_KEY;
  delete process.env.EMAIL_REMETENTE;
  delete process.env.EMAIL_PROPRIETARIA;
  delete process.env.ADMIN_EMAIL;
}
beforeEach(limpar);
afterEach(limpar);

describe("emailConfigurado", () => {
  it("exige a chave e o remetente", () => {
    assert.equal(emailConfigurado(), false);
    process.env.BREVO_API_KEY = "chave";
    assert.equal(emailConfigurado(), false, "só a chave não basta");
    process.env.EMAIL_REMETENTE = "estudio@exemplo.com";
    assert.equal(emailConfigurado(), true);
  });
});

describe("emailDaProprietaria", () => {
  it("usa o e-mail dedicado quando existe", () => {
    process.env.ADMIN_EMAIL = "login@exemplo.com";
    process.env.EMAIL_PROPRIETARIA = "avisos@exemplo.com";
    assert.equal(emailDaProprietaria(), "avisos@exemplo.com");
  });

  it("cai no e-mail de login quando não há outro", () => {
    process.env.ADMIN_EMAIL = "login@exemplo.com";
    assert.equal(emailDaProprietaria(), "login@exemplo.com");
  });

  it("devolve null sem nenhum dos dois", () => {
    assert.equal(emailDaProprietaria(), null);
  });
});

describe("esc", () => {
  it("neutraliza HTML vindo da cliente", () => {
    // O nome e a observação da cliente entram no e-mail da proprietária.
    assert.equal(
      esc('<script>alert("x")</script>'),
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    assert.equal(esc("Maria & Ana"), "Maria &amp; Ana");
    assert.equal(esc("d'Ávila"), "d&#39;Ávila");
  });

  it("aguenta vazio e nulo", () => {
    assert.equal(esc(null), "");
    assert.equal(esc(undefined), "");
    assert.equal(esc(""), "");
  });
});

describe("moldura", () => {
  it("escapa o título e mantém o corpo já montado", () => {
    const html = moldura("<b>Oi</b>", "<p>corpo</p>");
    assert.ok(html.includes("&lt;b&gt;Oi&lt;/b&gt;"), "título deve ser escapado");
    assert.ok(html.includes("<p>corpo</p>"), "corpo já vem montado pelo chamador");
    assert.ok(html.startsWith("<!doctype html>"));
  });
});
