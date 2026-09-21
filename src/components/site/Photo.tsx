import Image from "next/image";

/** Foto otimizada, ou um fundo neutro quando ainda não há imagem cadastrada. */
export function Photo({
  src,
  alt,
  sizes = "(max-width: 640px) 50vw, 25vw",
  className = "",
  priority = false,
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-po-escuro ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-ouro/60">
          <svg viewBox="0 0 400 60" className="w-1/2" fill="none" aria-hidden="true">
            <path d="M4 52 C 70 20, 150 6, 238 10 S 360 34, 396 50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
