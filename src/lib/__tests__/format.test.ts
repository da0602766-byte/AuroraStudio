import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  centsToInput,
  durationLabel,
  effectivePrice,
  firstName,
  formatPhone,
  normalizePhone,
  parseMoney,
  priceLabel,
  slugify,
} from "../format";

describe("normalizePhone", () => {
  it("acrescenta o DDI 55 a números brasileiros", () => {
    assert.equal(normalizePhone("(11) 98765-4321"), "5511987654321");
    assert.equal(normalizePhone("1132654321"), "551132654321");
  });

  it("aceita número que já vem com DDI", () => {
    assert.equal(normalizePhone("+55 11 98765-4321"), "5511987654321");
  });

  it("descarta zeros à esquerda do DDD", () => {
    assert.equal(normalizePhone("011 98765-4321"), "5511987654321");
  });

  it("recusa o que não é telefone", () => {
    assert.equal(normalizePhone("123"), null);
    assert.equal(normalizePhone(""), null);
    assert.equal(normalizePhone("abc"), null);
    assert.equal(normalizePhone("1198765432198765"), null);
  });
});

describe("formatPhone", () => {
  it("desenha celular e fixo", () => {
    assert.equal(formatPhone("5511987654321"), "(11) 98765-4321");
    assert.equal(formatPhone("551132654321"), "(11) 3265-4321");
  });

  it("devolve o original quando não reconhece", () => {
    assert.equal(formatPhone("123"), "123");
  });
});

describe("parseMoney", () => {
  it("lê os formatos que a proprietária digita", () => {
    assert.equal(parseMoney("15"), 1500);
    assert.equal(parseMoney("15,00"), 1500);
    assert.equal(parseMoney("15.50"), 1550);
    assert.equal(parseMoney("R$ 1.250,50"), 125050);
    assert.equal(parseMoney("1.250,50"), 125050);
  });

  it("recusa vazio e valor negativo", () => {
    assert.equal(parseMoney(""), null);
    assert.equal(parseMoney(null), null);
    assert.equal(parseMoney("-10"), null);
  });

  it("volta ao texto do campo sem alterar o valor", () => {
    assert.equal(parseMoney(centsToInput(125050)), 125050);
    assert.equal(centsToInput(1500), "15,00");
    assert.equal(centsToInput(null), "");
  });
});

describe("effectivePrice", () => {
  it("usa a promoção só quando ela é menor que o preço", () => {
    assert.equal(effectivePrice({ priceCents: 10000, promoPriceCents: 8000 }), 8000);
    assert.equal(effectivePrice({ priceCents: 10000, promoPriceCents: 12000 }), 10000);
    assert.equal(effectivePrice({ priceCents: 10000, promoPriceCents: 0 }), 10000);
    assert.equal(effectivePrice({ priceCents: 10000, promoPriceCents: null }), 10000);
  });
});

describe("priceLabel", () => {
  it("trata preço zero como sob consulta", () => {
    assert.equal(priceLabel(0), "Sob consulta");
    assert.match(priceLabel(1500), /15,00/);
  });
});

describe("durationLabel", () => {
  it("escreve minutos e horas", () => {
    assert.equal(durationLabel(45), "45 min");
    assert.equal(durationLabel(60), "1h");
    assert.equal(durationLabel(90), "1h30");
    assert.equal(durationLabel(65), "1h05");
  });
});

describe("slugify", () => {
  it("tira acentos e espaços", () => {
    assert.equal(slugify("Micropigmentação de Sobrancelha"), "micropigmentacao-de-sobrancelha");
    assert.equal(slugify("  Cílios — Volume Russo  "), "cilios-volume-russo");
  });

  it("não devolve traço solto nas pontas", () => {
    assert.equal(slugify("!!!"), "");
    assert.equal(slugify("--- Henna ---"), "henna");
  });
});

describe("firstName", () => {
  it("pega só o primeiro nome", () => {
    assert.equal(firstName("Maria Clara Souza"), "Maria");
    assert.equal(firstName("  Ana  "), "Ana");
  });
});
