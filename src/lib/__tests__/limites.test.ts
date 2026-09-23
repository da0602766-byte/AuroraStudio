import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limiteDaMedida, nivelDe, pior, porcentagem, tamanho, valorDaMedida } from "../limites";

describe("porcentagem", () => {
  it("arredonda a fração usada", () => {
    assert.equal(porcentagem(512, 1024), 50);
    assert.equal(porcentagem(1, 3), 33);
  });

  it("não passa de 100 quando o uso estoura o teto", () => {
    assert.equal(porcentagem(300, 100), 100);
  });

  it("devolve null sem teto para comparar", () => {
    assert.equal(porcentagem(10, null), null);
    assert.equal(porcentagem(10, 0), null);
  });
});

describe("nivelDe", () => {
  it("separa tranquilo, atenção e limite nos cortes de 70% e 90%", () => {
    assert.equal(nivelDe(0), "tranquilo");
    assert.equal(nivelDe(69), "tranquilo");
    assert.equal(nivelDe(70), "atencao");
    assert.equal(nivelDe(89), "atencao");
    assert.equal(nivelDe(90), "limite");
    assert.equal(nivelDe(100), "limite");
  });

  it("sem número não inventa situação", () => {
    assert.equal(nivelDe(null), "sem-leitura");
  });
});

describe("pior", () => {
  it("o conjunto vale pelo item mais grave", () => {
    assert.equal(pior(["tranquilo", "atencao", "tranquilo"]), "atencao");
    assert.equal(pior(["atencao", "limite"]), "limite");
    assert.equal(pior(["tranquilo", "desligado"]), "desligado");
    assert.equal(pior(["desligado", "sem-leitura"]), "sem-leitura");
  });

  it("um serviço no limite pesa mais que qualquer falta de leitura", () => {
    assert.equal(pior(["sem-leitura", "limite", "desligado"]), "limite");
  });

  it("sem nada a avaliar, fica tranquilo", () => {
    assert.equal(pior([]), "tranquilo");
  });
});

describe("tamanho", () => {
  it("escolhe a unidade que cabe e usa vírgula", () => {
    assert.equal(tamanho(512), "512 B");
    assert.equal(tamanho(2048), "2 KB");
    assert.equal(tamanho(5 * 1024 * 1024), "5,0 MB");
    assert.equal(tamanho(300 * 1024 * 1024), "300 MB");
    assert.equal(tamanho(2.5 * 1024 * 1024 * 1024), "2,50 GB");
  });
});

describe("valorDaMedida e limiteDaMedida", () => {
  it("formata bytes, contagens e créditos de jeitos diferentes", () => {
    assert.equal(valorDaMedida({ rotulo: "x", usado: 1024, limite: null, unidade: "bytes" }), "1 KB");
    assert.equal(valorDaMedida({ rotulo: "x", usado: 1234, limite: null, unidade: "itens" }), "1.234");
    assert.equal(valorDaMedida({ rotulo: "x", usado: 0.19, limite: 25, unidade: "creditos" }), "0,19");
  });

  it("sem teto, não há o que escrever depois do 'de'", () => {
    assert.equal(limiteDaMedida({ rotulo: "x", usado: 1, limite: null, unidade: "itens" }), null);
    assert.equal(limiteDaMedida({ rotulo: "x", usado: 1, limite: 25, unidade: "creditos" }), "25");
  });
});
