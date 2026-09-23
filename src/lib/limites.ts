import { createHash } from "crypto";
import { prisma } from "./db";
import { cloudinaryConfigurado, usoDoCloudinary } from "./storage";
import { contaBrevo, emailConfigurado } from "./mail";

/**
 * Quanto de cada cota gratuita já foi usado.
 *
 * O site vive de graça em quatro serviços, e cada um tem um teto diferente.
 * Quando um deles enche, o sintoma que aparece para a proprietária é vago —
 * "o site não salva a foto", "parou de chegar e-mail" —, e a causa fica
 * escondida no painel de um fornecedor que ela não abre nunca. Esta página
 * junta tudo em um lugar só.
 *
 * Regra que vale para todos os números daqui: só vira medidor o que dá para
 * medir de verdade. O tamanho do banco sai do próprio PostgreSQL, a cota do
 * Cloudinary sai da API dele. O que não dá para ler daqui — os contadores da
 * Netlify, que exigem um token de conta — aparece como referência escrita,
 * com link para o painel, e nunca como uma barra inventada.
 */

const MB = 1024 * 1024;

export type Nivel =
  /** Medido e longe do teto. */
  | "tranquilo"
  /** Medido, passando de 70% do teto. */
  | "atencao"
  /** Medido, passando de 90% do teto. */
  | "limite"
  /** Configurado, mas a consulta falhou agora — isso é problema. */
  | "sem-leitura"
  /** Não configurado: o recurso está desligado, de propósito ou não. */
  | "desligado"
  /** Não há o que medir daqui, e isso é o normal deste serviço. */
  | "informativo";

export type Medida = {
  rotulo: string;
  usado: number;
  /** `null` quando o valor é só informativo e não tem teto para comparar. */
  limite: number | null;
  unidade: "bytes" | "itens" | "creditos";
  /** De onde saiu o teto, quando ele não é medido e sim informado. */
  nota?: string;
};

export type Servico = {
  id: string;
  nome: string;
  fornecedor: string;
  paraQue: string;
  nivel: Nivel;
  medidas: Medida[];
  /** Limites que não dá para medir daqui, mostrados como texto. */
  referencia: { rotulo: string; valor: string }[];
  recado: string;
  painel: { rotulo: string; href: string };
};

// ─── Contas ───────────────────────────────────────────────────────────

export function porcentagem(usado: number, limite: number | null): number | null {
  if (limite === null || limite <= 0) return null;
  return Math.min(100, Math.round((usado / limite) * 100));
}

export function nivelDe(pct: number | null): Nivel {
  if (pct === null) return "sem-leitura";
  if (pct >= 90) return "limite";
  if (pct >= 70) return "atencao";
  return "tranquilo";
}

const GRAVIDADE: Record<Nivel, number> = {
  tranquilo: 0,
  // "Informativo" não é falta de nada: é um serviço que nunca teve medidor.
  // Somar alarme por isso deixaria o resumo do topo eternamente amarelo.
  informativo: 0,
  desligado: 1,
  "sem-leitura": 2,
  atencao: 3,
  limite: 4,
};

/** O nível de um conjunto é o do pior item — é o que precisa de atenção. */
export function pior(niveis: Nivel[]): Nivel {
  return niveis.reduce<Nivel>((a, b) => (GRAVIDADE[b] > GRAVIDADE[a] ? b : a), "tranquilo");
}

/** Nível de um serviço a partir das medidas que têm teto. */
function nivelDasMedidas(medidas: Medida[]): Nivel {
  const comTeto = medidas.filter((m) => m.limite !== null);
  if (!comTeto.length) return "sem-leitura";
  return pior(comTeto.map((m) => nivelDe(porcentagem(m.usado, m.limite))));
}

export function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
  return `${(mb / 1024).toFixed(2).replace(".", ",")} GB`;
}

export function valorDaMedida(m: Medida): string {
  if (m.unidade === "bytes") return tamanho(m.usado);
  if (m.unidade === "creditos") return m.usado.toFixed(2).replace(".", ",");
  return m.usado.toLocaleString("pt-BR");
}

export function limiteDaMedida(m: Medida): string | null {
  if (m.limite === null) return null;
  if (m.unidade === "bytes") return tamanho(m.limite);
  if (m.unidade === "creditos") return String(m.limite);
  return m.limite.toLocaleString("pt-BR");
}

/** Corta a espera: um fornecedor lento não pode travar a página. */
async function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  const prazo = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error("A consulta demorou demais.")), ms);
  });
  try {
    return await Promise.race([p, prazo]);
  } finally {
    clearTimeout(t!);
  }
}

function limiteEmMb(variavel: string, padrao: number): number {
  const v = Number(process.env[variavel]);
  return (Number.isFinite(v) && v > 0 ? v : padrao) * MB;
}

// ─── Banco de dados ───────────────────────────────────────────────────

async function medirBanco(): Promise<Servico> {
  const base = {
    id: "banco",
    nome: "Banco de dados",
    fornecedor: "Neon",
    paraQue: "Guarda as reservas, as clientes, os serviços e todo o histórico.",
    painel: { rotulo: "Abrir o painel do Neon", href: "https://console.neon.tech" },
  };

  try {
    const [[espaco], reservas, clientes] = await comPrazo(
      Promise.all([
        prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`,
        prisma.booking.count(),
        prisma.client.count(),
      ]),
      8_000
    );

    const medidas: Medida[] = [
      {
        rotulo: "Espaço usado",
        usado: Number(espaco.size),
        limite: limiteEmMb("LIMITE_BANCO_MB", 512),
        unidade: "bytes",
        nota: process.env.LIMITE_BANCO_MB
          ? "Teto que você cadastrou em LIMITE_BANCO_MB."
          : "Teto suposto do plano gratuito. O número exato está no painel do Neon — se lá for outro, cadastre LIMITE_BANCO_MB.",
      },
      { rotulo: "Reservas guardadas", usado: reservas, limite: null, unidade: "itens" },
      { rotulo: "Clientes cadastradas", usado: clientes, limite: null, unidade: "itens" },
    ];

    return {
      ...base,
      medidas,
      referencia: [],
      nivel: nivelDasMedidas(medidas),
      recado:
        "Se encher, o site para de salvar reservas novas. Antes de pagar por mais espaço, vale apagar fotos antigas do portfólio e reservas muito velhas.",
    };
  } catch {
    return {
      ...base,
      medidas: [],
      referencia: [],
      nivel: "sem-leitura",
      recado: "Não deu para medir o banco agora. Se o site está funcionando, foi só uma falha passageira na consulta.",
    };
  }
}

// ─── Fotos ────────────────────────────────────────────────────────────

async function medirFotos(): Promise<Servico> {
  const base = {
    id: "fotos",
    nome: "Fotos",
    fornecedor: "Cloudinary",
    paraQue: "Guarda e entrega as fotos dos serviços, do portfólio e da galeria.",
    painel: { rotulo: "Abrir o painel do Cloudinary", href: "https://console.cloudinary.com/console" },
  };

  if (!cloudinaryConfigurado()) {
    return {
      ...base,
      medidas: [],
      referencia: [],
      nivel: "desligado",
      recado:
        "Não configurado: sem as variáveis CLOUDINARY_*, o site recusa o envio de fotos novas em produção. As que já estão publicadas continuam aparecendo.",
    };
  }

  try {
    const u = await comPrazo(usoDoCloudinary(), 8_000);
    if (!u) throw new Error("sem leitura");

    const medidas: Medida[] = [];
    if (u.creditosUsados !== null) {
      medidas.push({
        rotulo: "Cota do mês",
        usado: u.creditosUsados,
        limite: u.creditosDoPlano,
        unidade: "creditos",
        nota: "Créditos: cada um vale 1 GB guardado, 1 GB entregue às visitantes ou mil ajustes de imagem. O teto vem do próprio Cloudinary.",
      });
    }
    if (u.bytesGuardados !== null) {
      medidas.push({ rotulo: "Fotos guardadas", usado: u.bytesGuardados, limite: null, unidade: "bytes" });
    }
    if (u.bytesEnviados !== null) {
      medidas.push({ rotulo: "Entregue às visitantes (mês)", usado: u.bytesEnviados, limite: null, unidade: "bytes" });
    }
    if (u.fotos !== null) {
      medidas.push({ rotulo: "Arquivos", usado: u.fotos, limite: null, unidade: "itens" });
    }

    return {
      ...base,
      medidas,
      referencia: u.plano ? [{ rotulo: "Plano", valor: u.plano }] : [],
      nivel: nivelDasMedidas(medidas),
      recado:
        "Se a cota acabar, as fotos param de ser enviadas até o mês virar. Para gastar menos, apague do portfólio o que não usa mais.",
    };
  } catch {
    return {
      ...base,
      medidas: [],
      referencia: [],
      nivel: "sem-leitura",
      recado: "Não deu para consultar o Cloudinary agora. Confira direto no painel dele.",
    };
  }
}

// ─── E-mails ──────────────────────────────────────────────────────────

async function medirEmails(): Promise<Servico> {
  const base = {
    id: "emails",
    nome: "Avisos por e-mail",
    fornecedor: "Brevo",
    paraQue: "Manda o aviso de reserva nova, o lembrete da véspera, o pedido de avaliação e os alertas de erro.",
    painel: { rotulo: "Abrir o painel do Brevo", href: "https://app.brevo.com" },
  };

  if (!emailConfigurado()) {
    return {
      ...base,
      medidas: [],
      referencia: [],
      nivel: "desligado",
      recado:
        "Não configurado: o site funciona igual, só que em silêncio — nenhum aviso de reserva, nenhum lembrete e nenhum alerta de erro chega até você.",
    };
  }

  const referencia = [{ rotulo: "Plano gratuito", valor: "300 e-mails por dia" }];
  try {
    const conta = await comPrazo(contaBrevo(), 8_000);
    return {
      ...base,
      medidas: [],
      referencia: [
        ...referencia,
        ...(conta?.creditos !== null && conta?.creditos !== undefined
          ? [{ rotulo: "Créditos na conta", valor: conta.creditos.toLocaleString("pt-BR") }]
          : []),
      ],
      nivel: "tranquilo",
      recado:
        "Conectado e respondendo. Um salão manda alguns e-mails por dia, bem longe do teto — o contador do dia fica no painel do Brevo.",
    };
  } catch {
    return {
      ...base,
      medidas: [],
      referencia,
      nivel: "sem-leitura",
      recado:
        "O Brevo não respondeu à consulta agora. Se os avisos pararam de chegar, confira no painel dele se a chave ainda vale.",
    };
  }
}

// ─── Erros avisados ───────────────────────────────────────────────────

/**
 * O alerta de erro por e-mail já se limita a 20 avisos por dia, e a conta
 * desse teto fica no mesmo balde que segura o limite. Lê-la aqui custa uma
 * consulta e responde a pergunta que traz a proprietária a esta página:
 * "está dando algum problema?".
 */
const TETO_ALERTAS = 20;

async function medirErros(): Promise<Servico> {
  const base = {
    id: "erros",
    nome: "Erros do site",
    fornecedor: "últimas 24 horas",
    paraQue: "Conta quantas falhas o site avisou por e-mail desde ontem.",
    painel: { rotulo: "Ver as reservas", href: "/admin/reservas" },
  };

  try {
    const chave = createHash("sha256").update("alerta:total").digest("hex");
    const balde = await comPrazo(prisma.rateLimitBucket.findUnique({ where: { key: chave } }), 8_000);
    const avisados = balde && balde.resetAt > new Date() ? balde.count : 0;
    const medidas: Medida[] = [
      {
        rotulo: "Erros avisados",
        usado: Math.min(avisados, TETO_ALERTAS),
        limite: TETO_ALERTAS,
        unidade: "itens",
        nota: "Passando de 20 num dia, o site para de mandar aviso para não estourar a cota de e-mail.",
      },
    ];
    return {
      ...base,
      medidas,
      referencia: [],
      nivel: avisados === 0 ? "tranquilo" : nivelDasMedidas(medidas),
      recado:
        avisados === 0
          ? "Nenhuma falha avisada desde ontem."
          : "Cada erro chegou no seu e-mail com a explicação. Erros iguais são agrupados e avisados uma vez por hora.",
    };
  } catch {
    return {
      ...base,
      medidas: [],
      referencia: [],
      nivel: "sem-leitura",
      recado: "Não deu para ler o contador de erros agora.",
    };
  }
}

// ─── Hospedagem ───────────────────────────────────────────────────────

/**
 * A Netlify não deixa o próprio site ler os contadores dela sem um token de
 * conta, que daria acesso a bem mais coisa do que uma página de leitura
 * precisa. Então aqui vai o que o plano oferece, por escrito, e o link para
 * onde os números de verdade moram. Uma barra aqui seria invenção.
 */
function hospedagem(): Servico {
  return {
    id: "site",
    nome: "Site no ar",
    fornecedor: "Netlify",
    paraQue: "Publica o site e roda as páginas do painel e as chamadas de reserva.",
    nivel: "informativo",
    medidas: [],
    referencia: [
      { rotulo: "Visitantes ao mesmo tempo", valor: "sem limite fixado" },
      { rotulo: "Tráfego", valor: "100 GB por mês" },
      { rotulo: "Chamadas do servidor", valor: "125 mil por mês" },
      { rotulo: "Tempo de publicação", valor: "300 minutos por mês" },
    ],
    recado:
      "A Netlify não deixa o site ler os próprios contadores sem um token de conta, então estes são os valores do plano — o quanto já foi gasto aparece no painel dela, em Usage.",
    painel: { rotulo: "Ver o consumo na Netlify", href: "https://app.netlify.com" },
  };
}

// ─── Tudo junto ───────────────────────────────────────────────────────

export async function situacaoDosServicos(): Promise<Servico[]> {
  const [banco, fotos, emails, erros] = await Promise.all([
    medirBanco(),
    medirFotos(),
    medirEmails(),
    medirErros(),
  ]);
  return [banco, fotos, emails, erros, hospedagem()];
}
