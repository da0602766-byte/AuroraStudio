"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ehPendencia, juntarAvisos, type Aviso, type Novidades, type TipoAviso } from "@/lib/avisos";

/*
 * O sino do painel.
 *
 * A proprietária não fica olhando a tela esperando reserva. Este sino
 * pergunta ao servidor de tempos em tempos se aconteceu algo e, quando
 * acontece, avisa de três jeitos ao mesmo tempo: um número vermelho no
 * sino, um som curto e uma notificação do sistema — que é a única das três
 * que aparece quando ela está em outra aba ou em outro aplicativo. Com a
 * permissão concedida, o navegador também fica inscrito em Web Push (ver
 * `ativarPushSeGranted`), que é o que alcança quando ela fecha tudo: aí quem
 * acorda a notificação é o servidor, não mais esta aba.
 *
 * Por que perguntar de tempos em tempos em vez de manter uma conexão
 * aberta: o site roda em funções da Netlify, que morrem em segundos. Uma
 * conexão contínua (SSE, WebSocket) cairia o tempo todo ali. Perguntar a
 * cada trinta segundos custa pouco, funciona sempre e, para uma reserva de
 * estúdio, meio minuto é tempo real.
 *
 * A aba escondida pergunta menos: o navegador já segura os relógios de aba
 * de fundo, e cada pergunta é uma função cobrada da cota do plano gratuito.
 */

const INTERVALO_ABERTO = 30_000;
const INTERVALO_OCULTO = 90_000;
const CHAVE_VISTOS = "aurora:avisos-vistos";
const CHAVE_SOM = "aurora:avisos-som";
const LEMBRAR_VISTOS = 200;

const DESENHO: Record<TipoAviso, { cor: string; caminho: string }> = {
  reserva: { cor: "#0C8A0C", caminho: "M3 6.2h14M5.6 2.8v2.6M14.4 2.8v2.6M3 6.2v9.4a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4V6.2" },
  pagamento: { cor: "#0C8A0C", caminho: "M2.6 5.8h14.8v8.4H2.6zM2.6 8.6h14.8M5.4 11.8h2.8" },
  comprovante: { cor: "#B57A05", caminho: "M10 2.6 17.4 16H2.6L10 2.6ZM10 7.6v3.2M10 13.2h.01" },
  sinal: { cor: "#C0392B", caminho: "M10 3.4a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2ZM10 6.6v3.8M10 13.2h.01" },
};

function Icone({ tipo }: { tipo: TipoAviso }) {
  const d = DESENHO[tipo];
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ color: d.cor }} className="mt-0.5 shrink-0">
      <path d={d.caminho} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sino() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 2.6a4.6 4.6 0 0 0-4.6 4.6c0 3.4-1.2 4.5-1.7 5a.6.6 0 0 0 .4 1h11.8a.6.6 0 0 0 .4-1c-.5-.5-1.7-1.6-1.7-5A4.6 4.6 0 0 0 10 2.6ZM8.3 15.6a1.9 1.9 0 0 0 3.4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/*
 * Duas preferências só existem no navegador: se as notificações do sistema
 * foram liberadas e se o som está ligado. Lê-las dentro de um efeito daria
 * um piscar entre o HTML do servidor e o do navegador; lidas assim, o React
 * já monta com o valor certo — e, de quebra, o painel aberto em duas abas
 * fica combinado, porque o evento "storage" avisa a outra.
 */
const ouvintes = new Set<() => void>();

function avisarMudancaDePreferencia() {
  for (const f of ouvintes) f();
}

function assinarPreferencias(f: () => void) {
  ouvintes.add(f);
  window.addEventListener("storage", f);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", f);
  };
}

function lerSom(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "0";
  } catch {
    return true;
  }
}

function lerPermissao(): NotificationPermission | "indisponivel" {
  return typeof Notification === "undefined" ? "indisponivel" : Notification.permission;
}

/*
 * Web Push: a mesma permissão do sino ("Notification"), só que entregue por
 * um service worker, que o navegador consegue acordar mesmo com o site
 * fechado. Uma vez concedida a permissão, inscrever é automático — sem
 * gesto extra da proprietária, sem botão a mais.
 *
 * Sem `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (ambiente sem as chaves configuradas)
 * a função não faz nada: o sino continua funcionando normalmente, só sem
 * esse alcance extra.
 */
const CHAVE_PUBLICA_VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function chavePublicaParaBytes(base64: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Seguro = (base64 + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64Seguro);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function ativarPushSeGranted() {
  if (!CHAVE_PUBLICA_VAPID) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const registro = await navigator.serviceWorker.register("/sw-push.js");
    let inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) {
      inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chavePublicaParaBytes(CHAVE_PUBLICA_VAPID) as BufferSource,
      });
    }
    await fetch("/api/admin/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(inscricao.toJSON()),
    });
  } catch {
    /* navegador recusou ou não suporta; o sino segue funcionando com a aba aberta */
  }
}

function horaDe(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function Avisos() {
  const router = useRouter();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [aberto, setAberto] = useState(false);
  const [naoLidos, setNaoLidos] = useState(0);
  const permissao = useSyncExternalStore(assinarPreferencias, lerPermissao, () => "indisponivel" as const);
  const som = useSyncExternalStore(assinarPreferencias, lerSom, () => true);

  const desde = useRef<string | null>(null);
  const vistos = useRef<Set<string>>(new Set());
  const audio = useRef<AudioContext | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  // No celular o cabeçalho é alto e o sino não fica na beirada da tela: uma
  // caixa presa à direita dele sairia pela esquerda. Ali ela ocupa a largura
  // toda, logo abaixo do sino — e é preciso medir onde o sino está.
  const [topo, setTopo] = useState(0);

  function apitar() {
    if (!lerSom() || typeof window === "undefined") return;
    try {
      const Construtor =
        window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Construtor) return;
      const ctx = (audio.current ??= new Construtor());
      if (ctx.state === "suspended") void ctx.resume();
      const nota = ctx.createOscillator();
      const volume = ctx.createGain();
      nota.type = "sine";
      nota.frequency.setValueAtTime(880, ctx.currentTime);
      nota.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
      volume.gain.setValueAtTime(0.0001, ctx.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
      nota.connect(volume);
      volume.connect(ctx.destination);
      nota.start();
      nota.stop(ctx.currentTime + 0.4);
    } catch {
      /* som é enfeite: nunca pode derrubar o aviso */
    }
  }

  useEffect(() => {
    let vivo = true;
    let relogio: ReturnType<typeof setTimeout> | undefined;

    // Quais avisos este navegador já anunciou, para o mesmo sinal atrasado
    // não apitar de novo a cada consulta.
    try {
      const lista = localStorage.getItem(CHAVE_VISTOS);
      if (lista) vistos.current = new Set(JSON.parse(lista) as string[]);
    } catch {
      /* navegador sem armazenamento: segue sem memória entre sessões */
    }

    function guardarVistos() {
      try {
        localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...vistos.current].slice(-LEMBRAR_VISTOS)));
      } catch {
        /* sem armazenamento, só perde a memória */
      }
    }

    function mostrarNaTela(lista: Aviso[]) {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      // Três é o bastante para entender; o resto vira uma linha só, para não
      // empilhar dez caixinhas na tela de quem voltou do almoço.
      for (const a of lista.slice(0, 3)) {
        try {
          const n = new Notification(a.titulo, { body: a.texto, tag: a.id, icon: "/icon.svg" });
          n.onclick = () => {
            window.focus();
            router.push(a.href);
            n.close();
          };
        } catch {
          /* alguns navegadores só permitem notificação vinda de service worker */
        }
      }
      if (lista.length > 3) {
        try {
          new Notification("Aurora Studio", { body: `E mais ${lista.length - 3} avisos no painel.`, tag: "aurora-resumo" });
        } catch {
          /* idem */
        }
      }
    }

    async function consultar(primeira: boolean) {
      try {
        const q = desde.current ? `?desde=${encodeURIComponent(desde.current)}` : "";
        const r = await fetch(`/api/admin/novidades${q}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as Novidades;
        desde.current = d.agora;
        setAvisos((anteriores) => juntarAvisos(anteriores, d.novos, d.pendentes));

        const chegando = [...d.pendentes, ...d.novos];
        const ineditos = chegando.filter((a) => !vistos.current.has(a.id));
        for (const a of chegando) vistos.current.add(a.id);
        guardarVistos();

        // A primeira consulta traz o que já existia antes de ela abrir o
        // painel. Apitar aí seria alarme falso: só enche a lista.
        if (!primeira && ineditos.length) {
          setNaoLidos((n) => n + ineditos.length);
          mostrarNaTela(ineditos);
          apitar();
          // A página embaixo do sino fica velha quando chega reserva nova.
          router.refresh();
        }
      } catch {
        /* rede oscilou; a próxima rodada tenta de novo */
      }
    }

    async function ciclo(primeira = false) {
      await consultar(primeira);
      if (!vivo) return;
      relogio = setTimeout(() => void ciclo(), document.hidden ? INTERVALO_OCULTO : INTERVALO_ABERTO);
    }

    void ciclo(true);
    void ativarPushSeGranted();

    function aoVoltarParaAba() {
      if (document.hidden || !vivo) return;
      clearTimeout(relogio);
      void ciclo();
    }
    document.addEventListener("visibilitychange", aoVoltarParaAba);

    return () => {
      vivo = false;
      clearTimeout(relogio);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
    // O laço só se apoia em refs e em setters, que não mudam entre renders.
  }, [router]);

  // Fechar clicando fora ou no Esc.
  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  async function ligarAvisos() {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
      avisarMudancaDePreferencia();
      void ativarPushSeGranted();
    } catch {
      /* navegador recusou o pedido */
    }
    // Este clique é a única chance de destravar o som: navegador nenhum
    // toca nada antes de a pessoa tocar na tela.
    apitar();
  }

  function trocarSom() {
    const proximo = !som;
    try {
      localStorage.setItem(CHAVE_SOM, proximo ? "1" : "0");
    } catch {
      /* sem armazenamento */
    }
    avisarMudancaDePreferencia();
    if (proximo) apitar();
  }

  const pendencias = avisos.filter((a) => ehPendencia(a.tipo));
  const eventos = avisos.filter((a) => !ehPendencia(a.tipo));

  return (
    <div className="relative" ref={caixa}>
      <button
        ref={botao}
        type="button"
        onClick={() => {
          const r = botao.current?.getBoundingClientRect();
          if (r) setTopo(Math.round(r.bottom + 8));
          setAberto((v) => !v);
          setNaoLidos(0);
        }}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="relative rounded-full px-3 py-2 text-white/80 hover:text-white"
      >
        <Sino />
        <span className="sr-only">
          Avisos{naoLidos > 0 ? `, ${naoLidos} sem ler` : ""}
          {pendencias.length > 0 ? `, ${pendencias.length} esperando você` : ""}
        </span>
        {(naoLidos > 0 || pendencias.length > 0) && (
          <span
            aria-hidden="true"
            className={`absolute right-1 top-0.5 min-w-[18px] rounded-full px-1 text-[11px] font-semibold leading-[18px] ${
              naoLidos > 0 ? "bg-ouro-claro text-bordo-escuro" : "bg-white/30 text-white"
            }`}
          >
            {naoLidos > 0 ? naoLidos : pendencias.length}
          </span>
        )}
      </button>

      {/* Para leitor de tela, que não vê o número mudar de cor. */}
      <span aria-live="polite" className="sr-only">
        {naoLidos > 0 ? `${naoLidos} aviso${naoLidos > 1 ? "s" : ""} no painel.` : ""}
      </span>

      {aberto && (
        <div
          role="dialog"
          aria-label="Avisos"
          style={{ "--topo-avisos": `${topo}px` } as React.CSSProperties}
          className="fixed inset-x-3 top-[var(--topo-avisos)] z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-linha bg-white p-4 text-marrom shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          {pendencias.length === 0 && eventos.length === 0 && (
            <p className="py-2 text-sm text-marrom-medio">Nada novo por enquanto.</p>
          )}

          {pendencias.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-marrom-claro">Esperando você</p>
              <ul className="mb-3 space-y-1">
                {pendencias.map((a) => (
                  <Item key={a.id} aviso={a} aoIr={() => setAberto(false)} />
                ))}
              </ul>
            </>
          )}

          {eventos.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-marrom-claro">Aconteceu hoje</p>
              <ul className="space-y-1">
                {eventos.map((a) => (
                  <Item key={a.id} aviso={a} aoIr={() => setAberto(false)} />
                ))}
              </ul>
            </>
          )}

          <div className="mt-3 border-t border-linha pt-3 text-sm">
            {permissao === "default" && (
              <button type="button" onClick={ligarAvisos} className="btn-contorno btn-pequeno w-full">
                Avisar na tela mesmo fechado
              </button>
            )}
            {permissao === "denied" && (
              <p className="text-xs leading-relaxed text-marrom-claro">
                Os avisos na tela estão bloqueados por este navegador. Para voltar, libere as notificações deste site
                nas permissões do navegador.
              </p>
            )}
            {permissao === "indisponivel" && (
              <p className="text-xs leading-relaxed text-marrom-claro">
                Este navegador não mostra avisos na tela. O sino continua funcionando enquanto o painel estiver aberto.
              </p>
            )}
            {permissao === "granted" && (
              <label className="flex items-center justify-between gap-3">
                <span>Tocar um som ao chegar</span>
                <input type="checkbox" checked={som} onChange={trocarSom} className="h-4 w-4 accent-bordo" />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ aviso, aoIr }: { aviso: Aviso; aoIr: () => void }) {
  return (
    <li>
      <Link href={aviso.href} onClick={aoIr} className="flex gap-2 rounded-xl p-2 hover:bg-po">
        <Icone tipo={aviso.tipo} />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{aviso.titulo}</span>
          <span className="block text-sm leading-snug text-marrom-medio">{aviso.texto}</span>
          <span className="block text-xs text-marrom-claro">{horaDe(aviso.em)}</span>
        </span>
      </Link>
    </li>
  );
}
