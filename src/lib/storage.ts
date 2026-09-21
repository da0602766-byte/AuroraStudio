import { randomBytes } from "crypto";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function looksLikeImage(buf: Buffer, type: string) {
  if (type === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === "image/png") return buf.subarray(0, 4).toString("hex") === "89504e47";
  if (type === "image/webp") return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  return false;
}

/** Salva uma foto e devolve a URL pública. */
export async function saveImage(file: File, folder: string): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Envie uma foto em JPG, PNG ou WEBP.");
  if (file.size > MAX_BYTES) throw new Error("A foto precisa ter no máximo 4 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(buf, file.type)) throw new Error("O arquivo enviado não é uma imagem válida.");

  const name = `${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(name, buf, { access: "public", contentType: file.type });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Armazenamento de fotos não configurado (BLOB_READ_WRITE_TOKEN).");
  }
  const { mkdir, writeFile } = await import("fs/promises");
  const path = await import("path");
  const full = path.join(process.cwd(), "public", "uploads", name);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return `/uploads/${name}`;
}

export async function deleteImage(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.includes("blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
  } catch (e) {
    console.error("Falha ao remover imagem", e);
  }
}

/** Retorna o arquivo do formulário, se houver um de fato. */
export function fileFrom(form: FormData, key: string): File | null {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}
