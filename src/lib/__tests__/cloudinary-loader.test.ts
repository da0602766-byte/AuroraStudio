import assert from "node:assert/strict";
import { describe, it } from "node:test";
import cloudinaryLoader from "../cloudinary-loader";

describe("cloudinaryLoader", () => {
  it("pede ao Cloudinary uma imagem limitada, comprimida e no formato ideal", () => {
    assert.equal(
      cloudinaryLoader({
        src: "https://res.cloudinary.com/aurora/image/upload/v1/portfolio/foto.jpg",
        width: 828,
      }),
      "https://res.cloudinary.com/aurora/image/upload/f_auto,q_75,c_limit,w_828/v1/portfolio/foto.jpg",
    );
  });

  it("respeita a qualidade escolhida pelo componente Image", () => {
    assert.match(
      cloudinaryLoader({ src: "https://res.cloudinary.com/aurora/image/upload/foto.jpg", width: 640, quality: 90 }),
      /f_auto,q_90,c_limit,w_640/,
    );
  });

  it("não altera imagens que não estão no Cloudinary", () => {
    const src = "/marca.svg";
    assert.equal(cloudinaryLoader({ src, width: 256 }), src);
  });
});
