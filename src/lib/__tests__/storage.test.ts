import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicIdFromUrl } from "../storage";

describe("publicIdFromUrl", () => {
  it("extrai o identificador de uma URL do Cloudinary", () => {
    assert.equal(
      publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/v1712345678/aurora/servicos/abc123.jpg"),
      "aurora/servicos/abc123"
    );
  });

  it("funciona sem o número de versão", () => {
    assert.equal(
      publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/aurora/portfolio/foto.webp"),
      "aurora/portfolio/foto"
    );
  });

  it("mantém as pastas intermediárias", () => {
    // Apagar pelo identificador errado removeria a foto de outro lugar.
    assert.equal(
      publicIdFromUrl("https://res.cloudinary.com/demo/image/upload/v1/aurora/site/hero-1.png"),
      "aurora/site/hero-1"
    );
  });

  it("devolve null para o que não é URL de upload", () => {
    assert.equal(publicIdFromUrl("/uploads/servicos/foto.jpg"), null);
    assert.equal(publicIdFromUrl("https://exemplo.com/foto.jpg"), null);
  });
});
