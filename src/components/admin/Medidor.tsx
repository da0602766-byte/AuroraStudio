import type { Medida, Nivel } from "@/lib/limites";
import { limiteDaMedida, nivelDe, porcentagem, valorDaMedida } from "@/lib/limites";

/*
 * As cores aqui são de estado, não da marca: verde, âmbar e vermelho são o
 * que qualquer pessoa lê sem legenda. Elas nunca aparecem sozinhas — cada
 * situação leva também um desenho e uma palavra, porque cor sozinha some
 * para quem não distingue verde de vermelho e para quem imprime a página.
 *
 * O trilho vazio é a mesma cor da barra, bem mais clara, para que o estado
 * se leia na barra inteira e não só no pedaço preenchido.
 */
const ESTADO: Record<Nivel, { cor: string; trilho: string; palavra: string }> = {
  tranquilo: { cor: "#0C8A0C", trilho: "rgba(12,138,12,0.14)", palavra: "Tranquilo" },
  atencao: { cor: "#B57A05", trilho: "rgba(250,178,25,0.20)", palavra: "Atenção" },
  limite: { cor: "#C0392B", trilho: "rgba(208,59,59,0.14)", palavra: "No limite" },
  "sem-leitura": { cor: "#6B5249", trilho: "rgba(107,82,73,0.12)", palavra: "Sem leitura" },
  desligado: { cor: "#9C8379", trilho: "rgba(156,131,121,0.14)", palavra: "Desligado" },
  informativo: { cor: "#6B5249", trilho: "rgba(107,82,73,0.10)", palavra: "Só no painel" },
};

function Icone({ nivel }: { nivel: Nivel }) {
  const comum = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  const traco = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (nivel === "tranquilo")
    return (
      <svg {...comum}>
        <circle cx="8" cy="8" r="6.4" {...traco} />
        <path d="M5.3 8.2 7.2 10l3.5-3.9" {...traco} />
      </svg>
    );
  if (nivel === "atencao")
    return (
      <svg {...comum}>
        <path d="M8 2.2 14.4 13.4H1.6L8 2.2Z" {...traco} />
        <path d="M8 6.6v2.8M8 11.4h.01" {...traco} />
      </svg>
    );
  if (nivel === "limite")
    return (
      <svg {...comum}>
        <circle cx="8" cy="8" r="6.4" {...traco} />
        <path d="M8 4.6v4M8 11.1h.01" {...traco} />
      </svg>
    );
  if (nivel === "desligado")
    return (
      <svg {...comum}>
        <circle cx="8" cy="8" r="6.4" {...traco} />
        <path d="M3.8 3.8l8.4 8.4" {...traco} />
      </svg>
    );
  if (nivel === "informativo")
    return (
      <svg {...comum}>
        <path d="M13.4 8.6V12a1.4 1.4 0 0 1-1.4 1.4H4A1.4 1.4 0 0 1 2.6 12V4A1.4 1.4 0 0 1 4 2.6h3.4" {...traco} />
        <path d="M10 2.6h3.4V6M13.4 2.6 7.6 8.4" {...traco} />
      </svg>
    );
  return (
    <svg {...comum}>
      <circle cx="8" cy="8" r="6.4" {...traco} />
      <path d="M6.2 6.3a1.8 1.8 0 1 1 2 2.5v.7M8 11.4h.01" {...traco} />
    </svg>
  );
}

export function Selo({ nivel }: { nivel: Nivel }) {
  const e = ESTADO[nivel];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-marrom"
      style={{ backgroundColor: e.trilho }}
    >
      <span style={{ color: e.cor }} className="flex">
        <Icone nivel={nivel} />
      </span>
      {e.palavra}
    </span>
  );
}

/** Uma barra só: quanto de um teto já foi usado. */
export function Medidor({ medida }: { medida: Medida }) {
  const pct = porcentagem(medida.usado, medida.limite);
  const teto = limiteDaMedida(medida);
  const e = ESTADO[nivelDe(pct)];
  const valor = valorDaMedida(medida);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-marrom-medio">{medida.rotulo}</span>
        <span className="text-sm text-marrom">
          <strong className="font-semibold">{valor}</strong>
          {teto && <span className="text-marrom-claro"> de {teto}</span>}
          {pct !== null && <span className="text-marrom-medio"> · {pct}%</span>}
        </span>
      </div>

      {pct === null ? null : (
        <div
          role="progressbar"
          aria-label={medida.rotulo}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${pct}% — ${valor}${teto ? ` de ${teto}` : ""}`}
          className="mt-1.5 h-2 w-full overflow-hidden rounded"
          style={{ backgroundColor: e.trilho }}
        >
          {/* Um traço mínimo para que "quase nada" não vire "nada nenhum". */}
          <div
            className="h-full rounded"
            style={{ width: `${medida.usado > 0 ? Math.max(pct, 1.5) : 0}%`, backgroundColor: e.cor }}
          />
        </div>
      )}

      {medida.nota && <p className="mt-1.5 text-xs leading-relaxed text-marrom-claro">{medida.nota}</p>}
    </div>
  );
}
