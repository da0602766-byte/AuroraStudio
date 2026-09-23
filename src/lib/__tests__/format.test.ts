import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  centsToInput,
  emailParaceValido,
  sugerirEmail,
  validarTelefone,
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
  });

  it("passou a recusar telefone fixo por padrão", () => {
    // Mudança proposital: o número é usado para falar pelo WhatsApp, e um
    // fixo deixaria a cliente sem canal de contato. O painel ainda cadastra
    // fixo, passando `exigirCelular: false`.
    assert.equal(normalizePhone("1132654321"), null);
    assert.equal(normalizePhone("1132654321", { exigirCelular: false }), "551132654321");
  });

  it("aceita número que já vem com DDI", () => {
    assert.equal(normalizePhone("+55 11 98765-4321"), "5511987654321");
  });

  it("descarta o prefixo de discagem sem corromper o DDD", () => {
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

describe("validarTelefone", () => {
  it("aceita celular válido em vários formatos", () => {
    for (const entrada of ["(11) 98765-4321", "11987654321", "+55 11 98765-4321", "0 11 98765-4321"]) {
      const r = validarTelefone(entrada);
      assert.ok(r.ok, `${entrada} deveria passar`);
      if (r.ok) assert.equal(r.numero, "5511987654321");
    }
  });

  it("não corrompe DDD que começa com zero", () => {
    // O bug: tirar o zero à esquerda transformava (01) em DDD 1, gerando um
    // número plausível e inalcançável.
    const r = validarTelefone("(01) 98765-4321");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, /DDD 01/);
  });

  it("recusa DDD que não existe", () => {
    for (const ddd of ["10", "20", "23", "26", "30", "36", "52", "70", "90"]) {
      const r = validarTelefone(`(${ddd}) 98765-4321`);
      assert.equal(r.ok, false, `DDD ${ddd} não deveria passar`);
    }
  });

  it("aceita todos os DDDs reais", () => {
    for (const ddd of [11, 19, 21, 27, 31, 38, 41, 49, 51, 55, 61, 69, 71, 79, 81, 89, 91, 99]) {
      const r = validarTelefone(`(${ddd}) 98765-4321`);
      assert.ok(r.ok, `DDD ${ddd} deveria passar`);
    }
  });

  it("recusa telefone fixo quando o canal é WhatsApp", () => {
    const r = validarTelefone("(11) 3265-4321");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, /celular/i);
  });

  it("aceita fixo quando o painel pede", () => {
    const r = validarTelefone("(11) 3265-4321", { exigirCelular: false });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.numero, "551132654321");
  });

  it("recusa celular sem o 9 inicial", () => {
    assert.equal(validarTelefone("(11) 18765-4321").ok, false);
  });

  it("recusa número com todos os dígitos iguais", () => {
    const r = validarTelefone("11111111111");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.motivo, /não parece real/);
  });

  it("explica quando falta ou sobra dígito", () => {
    const curto = validarTelefone("119876");
    assert.equal(curto.ok, false);
    if (!curto.ok) assert.match(curto.motivo, /Faltam/);
    const longo = validarTelefone("119876543210");
    assert.equal(longo.ok, false);
    if (!longo.ok) assert.match(longo.motivo, /demais/);
  });

  it("normalizePhone continua funcionando para quem já usava", () => {
    assert.equal(normalizePhone("(11) 98765-4321"), "5511987654321");
    assert.equal(normalizePhone("(01) 98765-4321"), null);
  });
});

describe("sugerirEmail", () => {
  it("corrige os erros de digitação mais comuns", () => {
    assert.equal(sugerirEmail("maria@gmail.con"), "maria@gmail.com");
    assert.equal(sugerirEmail("maria@hotmial.com"), "maria@hotmail.com");
    assert.equal(sugerirEmail("maria@outlok.com"), "maria@outlook.com");
  });

  it("não sugere nada quando já está certo", () => {
    assert.equal(sugerirEmail("maria@gmail.com"), null);
    assert.equal(sugerirEmail("maria@uol.com.br"), null);
  });

  it("não mexe em domínio próprio", () => {
    // Domínio de empresa não é erro de digitação: sugerir seria atrapalhar.
    assert.equal(sugerirEmail("contato@auroraestudio.com.br"), null);
    assert.equal(sugerirEmail("maria@empresa.com.br"), null);
  });

  it("ignora entrada que não é e-mail", () => {
    assert.equal(sugerirEmail("maria"), null);
    assert.equal(sugerirEmail("@gmail.com"), null);
    assert.equal(sugerirEmail(""), null);
  });
});

describe("emailParaceValido", () => {
  it("aceita endereços comuns", () => {
    assert.equal(emailParaceValido("maria@gmail.com"), true);
    assert.equal(emailParaceValido("maria.souza@uol.com.br"), true);
    assert.equal(emailParaceValido("ana@aa.com"), true, "domínio curto é legítimo");
    assert.equal(emailParaceValido("aaa@gmail.com"), true, "três letras iguais podem ser reais");
  });

  it("recusa campo preenchido a esmo", () => {
    // Uma letra repetida dezenas de vezes passa em qualquer validação de
    // formato: é sintaticamente perfeito e obviamente não é um endereço.
    assert.equal(emailParaceValido("ooooooooooooooooooooo@oooooooooooooooo.ooo"), false);
    assert.equal(emailParaceValido("aaaaa@gmail.com"), false, "usuário só de repetição");
    assert.equal(emailParaceValido("maria@ooooo.com"), false, "domínio só de repetição");
    assert.equal(emailParaceValido("maria@gmail.ooooo"), false, "final só de repetição");
  });

  it("recusa o que vai falhar na entrega", () => {
    assert.equal(emailParaceValido("maria@gmail"), false, "domínio sem ponto");
    assert.equal(emailParaceValido("maria gmail.com"), false, "com espaço");
    assert.equal(emailParaceValido("maria@@gmail.com"), false);
    assert.equal(emailParaceValido("maria@gmail..com"), false);
    assert.equal(emailParaceValido(""), false);
  });
});
