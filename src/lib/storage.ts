import { randomBytes } from "crypto";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Pasta raiz no Cloudinary, para não misturar com outros projetos da conta. */
const ROOT = "aurora";

function looksLikeImage(buf: Buffer, type: string) {
  if (type === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === "image/png") return buf.subarray(0, 4).toString("hex") === "89504e47";
  if (type === "image/webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return false;
}

function cloudinaryConfigurado() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
}

async function cloudinary() {
  const { v2 } = await import("cloudinary");
  v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return v2;
}

/** Salva uma foto e devolve a URL pública. */
export async function saveImage(file: File, folder: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Envie uma foto em JPG, PNG ou WEBP.");
  if (file.size > MAX_BYTES) throw new Error("A foto precisa ter no máximo 4 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, file.type)) throw new Error("O arquivo enviado não é uma imagem válida.");

  const name = `${Date.now()}-${randomBytes(6).toString("hex")}`;

  if (cloudinaryConfigurado()) {
    const cld = await cloudinary();
    const res = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cld.uploader
        .upload_stream(
          { folder: `${ROOT}/${folder}`, public_id: name, resource_type: "image", overwrite: false },
          (err, result) => (err || !result ? reject(err ?? new Error("Falha no envio da foto.")) : resolve(result))
        )
        .end(buf);
    });
    return res.secure_url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Armazenamento de fotos não configurado (variáveis CLOUDINARY_*).");
  }

  // Em desenvolvimento, sem Cloudinary, a foto fica em public/uploads.
  const { mkdir, writeFile } = await import("fs/promises");
  const path = await import("path");
  const rel = `${folder}/${name}.${ext}`;
  const full = path.join(process.cwd(), "public", "uploads", rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return `/uploads/${rel}`;
}

/**
 * Extrai o identificador do Cloudinary a partir da URL pública.
 * ".../upload/v1234567/aurora/servicos/abc.jpg" → "aurora/servicos/abc"
 */
export function publicIdFromUrl(url: string): string | null {
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!m) return null;
  return m[1].replace(/\.[a-z0-9]+$/i, "");
}

export async function deleteImage(url: string | null | undefined) {
  if (!url || !url.includes("res.cloudinary.com") || !cloudinaryConfigurado()) return;
  try {
    const id = publicIdFromUrl(url);
    if (!id) return;
    const cld = await cloudinary();
    await cld.uploader.destroy(id, { resource_type: "image" });
  } catch (e) {
    console.error("Falha ao remover imagem", e);
  }
}

/** Retorna o arquivo do formulário, se houver um de fato. */
export function fileFrom(form: FormData, key: string): File | null {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}
