type LoaderProps = { src: string; width: number; quality?: number };

/** Entrega as fotos já redimensionadas e convertidas pelo CDN do Cloudinary. */
export default function cloudinaryLoader({ src, width, quality }: LoaderProps) {
  if (!src.includes("res.cloudinary.com") || !src.includes("/upload/")) return src;
  const transform = `f_auto,q_${quality ?? 75},c_limit,w_${width}`;
  return src.replace("/upload/", `/upload/${transform}/`);
}
