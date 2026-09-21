"use client";

import { useState } from "react";

/**
 * Campo de foto que reduz a imagem no próprio aparelho antes do envio
 * (máx. 1600px, JPEG), deixando o upload rápido mesmo com fotos do celular.
 */
export function ImageInput({ name, label, current }: { name: string; label: string; current?: string | null }) {
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem.");
      input.value = "";
      return;
    }
    setBusy(true);
    try {
      const compressed = await compress(file);
      const dt = new DataTransfer();
      dt.items.add(compressed);
      input.files = dt.files;
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setPreview(URL.createObjectURL(file)); // envia o original se a redução falhar
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={`img-${name}`} className="rotulo">{label}</label>
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-po-escuro" aria-hidden="true" />
        )}
        <input id={`img-${name}`} name={name} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={onChange} className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-po-escuro file:px-4 file:py-2 file:text-marrom" />
      </div>
      {busy && <p className="ajuda" role="status">Preparando a foto…</p>}
      {error && <p className="erro" role="alert">{error}</p>}
    </div>
  );
}

async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.84));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
