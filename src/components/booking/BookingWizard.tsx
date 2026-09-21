"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type ServiceOption = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  price: string;
  duration: string;
  depositCents: number;
};

type Slot = { time: string; available: boolean };
type Step = 1 | 2 | 3 | 4;

const STEPS = ["Serviço", "Dia e horário", "Seus dados", "Confirmar"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEK_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// Datas tratadas como texto AAAA-MM-DD, sem depender do fuso do aparelho
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const parts = (s: string) => s.split("-").map(Number) as [number, number, number];
const addDays = (s: string, n: number) => {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (s: string) => {
  const [y, m, d] = parts(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const timeLabel = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)}h${m === "00" ? "" : m}`;
};
const dateLabel = (s: string) => {
  const [, m, d] = parts(s);
  return `${WEEK_FULL[weekday(s)]}, ${d} de ${MONTHS[m - 1]}`;
};
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function BookingWizard(props: {
  services: ServiceOption[];
  initialSlug: string | null;
  today: string;
  windowDays: number;
  cancelMinHours: number;
  holdMinutes: number;
  whatsappLink: string | null;
}) {
  const router = useRouter();
  const initial = props.services.find((s) => s.slug === props.initialSlug) ?? null;

  const [step, setStep] = useState<Step>(initial ? 2 : 1);
  const [serviceId, setServiceId] = useState<string | null>(initial?.id ?? null);
  const [month, setMonth] = useState(() => props.today.slice(0, 7));
  const [days, setDays] = useState<Record<string, number>>({});
  const [daysLoading, setDaysLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [allergic, setAllergic] = useState<boolean | null>(null);
  const [allergyDetails, setAllergyDetails] = useState("");
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const service = props.services.find((s) => s.id === serviceId) ?? null;
  const lastDate = addDays(props.today, props.windowDays);

  // Foco no título de cada etapa, para leitores de tela e teclado
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Disponibilidade do mês
  useEffect(() => {
    if (!serviceId || step !== 2) return;
    const [y, m] = month.split("-").map(Number);
    const first = ymd(y, m, 1) < props.today ? props.today : ymd(y, m, 1);
    const last = ymd(y, m, daysIn(y, m)) > lastDate ? lastDate : ymd(y, m, daysIn(y, m));
    if (first > last) {
      setDays({});
      return;
    }
    const ctrl = new AbortController();
    setDaysLoading(true);
    fetch(`/api/disponibilidade?servico=${serviceId}&de=${first}&ate=${last}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { days: { date: string; available: number }[] }) => {
        setDays(Object.fromEntries(data.days.map((d) => [d.date, d.available])));
        setError(null);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError("Não foi possível carregar a agenda. Verifique sua conexão e tente novamente.");
      })
      .finally(() => setDaysLoading(false));
    return () => ctrl.abort();
  }, [serviceId, month, step, props.today, lastDate]);

  const loadSlots = useCallback(
    async (d: string) => {
      if (!serviceId) return;
      setSlotsLoading(true);
      setSlots(null);
      try {
        const r = await fetch(`/api/disponibilidade?servico=${serviceId}&data=${d}`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        const data = (await r.json()) as { slots: Slot[] };
        setSlots(data.slots);
      } catch {
        setError("Não foi possível carregar os horários. Tente novamente.");
      } finally {
        setSlotsLoading(false);
      }
    },
    [serviceId]
  );

  const calendar = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const blanks = weekday(ymd(y, m, 1));
    const cells: (string | null)[] = Array(blanks).fill(null);
    for (let d = 1; d <= daysIn(y, m); d++) cells.push(ymd(y, m, d));
    return { y, m, cells };
  }, [month]);

  function shiftMonth(delta: number) {
    const { y, m } = calendar;
    const nm = m + delta;
    const ny = y + Math.floor((nm - 1) / 12);
    const mm = ((nm - 1 + 12) % 12) + 1;
    setMonth(`${ny}-${pad(mm)}`);
  }
  const canPrev = month > props.today.slice(0, 7);
  const canNext = `${month}-31` < lastDate;

  function pickService(id: string) {
    setServiceId(id);
    setDate(null);
    setTime(null);
    setSlots(null);
    setStep(2);
  }

  function pickDate(d: string) {
    setDate(d);
    setTime(null);
    setError(null);
    loadSlots(d);
  }

  function validateData() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Informe seu nome.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) e.phone = "Informe seu WhatsApp com DDD.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Confira o e-mail.";
    if (allergic === null) e.allergic = "Responda se você tem alguma alergia.";
    if (allergic && allergyDetails.trim().length < 2) e.allergyDetails = "Conte a que você tem alergia.";
    if (pregnant === null) e.pregnant = "Responda se você está gestante.";
    if (!consent) e.consent = "É preciso autorizar para continuar.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!service || !date || !time) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          date,
          time,
          name,
          phone,
          email,
          isAllergic: !!allergic,
          allergyDetails: allergic ? allergyDetails : "",
          isPregnant: !!pregnant,
          notes,
          healthConsent: consent,
          website,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.token) {
        router.push(`/reserva/${data.token}?nova=1`);
        return;
      }
      if (r.status === 409) {
        setTime(null);
        setStep(2);
        if (date) loadSlots(date);
      } else if (data.field && ["name", "phone", "email", "allergyDetails", "consent"].includes(data.field)) {
        setStep(3);
        setFieldErrors({ [data.field]: data.error });
      }
      setError(data.error ?? "Não foi possível concluir a reserva. Tente novamente.");
    } catch {
      setError("Sem conexão no momento. Verifique a internet e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8">
      {/* Progresso */}
      <ol className="flex gap-2" aria-label="Etapas do agendamento">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          const state = n < step ? "feito" : n === step ? "atual" : "próximo";
          return (
            <li key={label} className="flex-1" aria-current={n === step ? "step" : undefined}>
              <span className={`block h-1 rounded-full ${n <= step ? "bg-bordo" : "bg-linha"}`} />
              <span className={`mt-2 block text-xs ${n === step ? "font-medium text-bordo" : "text-marrom-claro"}`}>
                <span className="sr-only">{state}: </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="mt-6 rounded-2xl border border-bordo/30 bg-bordo/5 px-4 py-3 text-[15px] text-bordo">
          {error}
        </div>
      )}

      {/* 1. Serviço */}
      {step === 1 && (
        <section className="mt-8">
          <h2 ref={headingRef} tabIndex={-1} className="text-3xl outline-none">Qual serviço você quer fazer?</h2>
          <ul className="mt-6 divide-y divide-linha border-y border-linha">
            {props.services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pickService(s.id)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left hover:text-bordo"
                >
                  <span>
                    <span className="block text-lg font-medium">{s.name}</span>
                    <span className="text-sm text-marrom-medio">
                      {s.category ? `${s.category}, ` : ""}
                      {s.duration}
                    </span>
                  </span>
                  <span className="shrink-0 font-display text-lg text-bordo">{s.price}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2. Dia e horário */}
      {step === 2 && service && (
        <section className="mt-8">
          <h2 ref={headingRef} tabIndex={-1} className="text-3xl outline-none">Escolha o dia e o horário</h2>
          <p className="mt-2 text-marrom-medio">
            {service.name}, {service.duration}.{" "}
            <button type="button" onClick={() => setStep(1)} className="text-bordo underline underline-offset-4">
              Trocar serviço
            </button>
          </p>

          <div className="mt-6 rounded-3xl border border-linha bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => shiftMonth(-1)} disabled={!canPrev} className="btn-contorno btn-pequeno w-11 px-0" aria-label="Mês anterior">‹</button>
              <p className="font-display text-xl capitalize" aria-live="polite">
                {MONTHS[calendar.m - 1]} {calendar.y}
              </p>
              <button type="button" onClick={() => shiftMonth(1)} disabled={!canNext} className="btn-contorno btn-pequeno w-11 px-0" aria-label="Próximo mês">›</button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-marrom-claro" aria-hidden="true">
              {WEEK.map((w, i) => <span key={i}>{w}</span>)}
            </div>
            <div className={`mt-1 grid grid-cols-7 gap-1 ${daysLoading ? "opacity-50" : ""}`} aria-busy={daysLoading}>
              {calendar.cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} />;
                const avail = days[d] ?? 0;
                const enabled = avail > 0 && !daysLoading;
                const selected = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!enabled}
                    onClick={() => pickDate(d)}
                    aria-pressed={selected}
                    aria-label={`${dateLabel(d)}${enabled ? `, ${avail} horário${avail > 1 ? "s" : ""} livre${avail > 1 ? "s" : ""}` : ", sem horários"}`}
                    className={`relative aspect-square rounded-full text-[15px] transition-colors ${
                      selected
                        ? "bg-bordo text-white"
                        : enabled
                          ? "text-marrom hover:bg-po-escuro"
                          : "cursor-not-allowed text-marrom-claro/50"
                    }`}
                  >
                    {Number(d.slice(8))}
                    {enabled && !selected && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-ouro" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {!daysLoading && Object.values(days).every((n) => n === 0) && (
              <p className="mt-4 text-sm text-marrom-medio">Nenhum horário livre neste mês. Veja o próximo mês.</p>
            )}
          </div>

          {date && (
            <div className="mt-6">
              <h3 className="text-xl capitalize">{dateLabel(date)}</h3>
              {slotsLoading && <p className="mt-3 text-marrom-medio" role="status">Carregando horários…</p>}
              {slots && slots.length === 0 && (
                <p className="mt-3 text-marrom-medio">Nenhum horário disponível nesta data. Selecione outro dia.</p>
              )}
              {slots && slots.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setTime(s.time)}
                      aria-pressed={time === s.time}
                      aria-label={`${timeLabel(s.time)}${s.available ? "" : ", indisponível"}`}
                      className={`min-h-[48px] rounded-xl border text-[15px] transition-colors ${
                        time === s.time
                          ? "border-bordo bg-bordo text-white"
                          : s.available
                            ? "border-linha bg-white hover:border-bordo"
                            : "cursor-not-allowed border-transparent bg-po-escuro/60 text-marrom-claro line-through"
                      }`}
                    >
                      {timeLabel(s.time)}
                    </button>
                  ))}
                </div>
              )}
              {slots && slots.some((s) => !s.available) && (
                <p className="mt-2 text-xs text-marrom-claro">Horários riscados já estão ocupados.</p>
              )}
            </div>
          )}

          {props.whatsappLink && (
            <p className="mt-6 text-sm text-marrom-medio">
              Não encontrou um horário?{" "}
              <a href={props.whatsappLink} target="_blank" rel="noopener noreferrer" className="text-bordo underline underline-offset-4">
                Fale pelo WhatsApp
              </a>
            </p>
          )}

          <div className="mt-8 flex justify-end">
            <button type="button" className="btn-primario w-full sm:w-auto" disabled={!date || !time} onClick={() => { setError(null); setStep(3); }}>
              Continuar
            </button>
          </div>
        </section>
      )}

      {/* 3. Dados */}
      {step === 3 && (
        <section className="mt-8">
          <h2 ref={headingRef} tabIndex={-1} className="text-3xl outline-none">Seus dados</h2>
          <form
            className="mt-6 space-y-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validateData()) {
                setError(null);
                setStep(4);
              }
            }}
          >
            <div>
              <label htmlFor="nome" className="rotulo">Nome completo</label>
              <input id="nome" className="campo" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "nome-erro" : undefined} />
              {fieldErrors.name && <p id="nome-erro" className="erro">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="fone" className="rotulo">WhatsApp</label>
              <input id="fone" className="campo" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? "fone-erro" : undefined} />
              {fieldErrors.phone && <p id="fone-erro" className="erro">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label htmlFor="email" className="rotulo">E-mail <span className="font-normal text-marrom-claro">(opcional)</span></label>
              <input id="email" className="campo" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErrors.email} />
              {fieldErrors.email && <p className="erro">{fieldErrors.email}</p>}
            </div>

            <fieldset>
              <legend className="rotulo">Você tem alguma alergia?</legend>
              <YesNo name="alergia" value={allergic} onChange={setAllergic} />
              {fieldErrors.allergic && <p className="erro">{fieldErrors.allergic}</p>}
            </fieldset>
            {allergic && (
              <div>
                <label htmlFor="alergia-qual" className="rotulo">A quê?</label>
                <input id="alergia-qual" className="campo" placeholder="Ex.: esmalte, cola de cílios, henna, látex" value={allergyDetails} onChange={(e) => setAllergyDetails(e.target.value)} maxLength={300} aria-invalid={!!fieldErrors.allergyDetails} />
                {fieldErrors.allergyDetails && <p className="erro">{fieldErrors.allergyDetails}</p>}
              </div>
            )}

            <fieldset>
              <legend className="rotulo">Você está gestante?</legend>
              <YesNo name="gestante" value={pregnant} onChange={setPregnant} />
              {fieldErrors.pregnant && <p className="erro">{fieldErrors.pregnant}</p>}
              {pregnant && (
                <p className="ajuda">Alguns procedimentos precisam de avaliação durante a gestação. Se for o caso, a profissional entra em contato com você.</p>
              )}
            </fieldset>

            <div>
              <label htmlFor="obs" className="rotulo">Observações <span className="font-normal text-marrom-claro">(opcional)</span></label>
              <textarea id="obs" className="campo min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>

            {/* Campo invisível contra robôs */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Site</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <div>
              <label className="flex items-start gap-3 text-[15px] leading-relaxed">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-bordo" />
                <span>
                  Autorizo o uso destas informações, inclusive as de saúde, somente para organizar e realizar meu atendimento.{" "}
                  <Link href="/privacidade" target="_blank" className="text-bordo underline underline-offset-4">Política de privacidade</Link>
                </span>
              </label>
              {fieldErrors.consent && <p className="erro">{fieldErrors.consent}</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
              <button type="button" className="btn-contorno" onClick={() => setStep(2)}>Voltar</button>
              <button type="submit" className="btn-primario">Revisar reserva</button>
            </div>
          </form>
        </section>
      )}

      {/* 4. Revisão */}
      {step === 4 && service && date && time && (
        <section className="mt-8">
          <h2 ref={headingRef} tabIndex={-1} className="text-3xl outline-none">Confira e confirme</h2>
          <dl className="mt-6 divide-y divide-linha rounded-3xl border border-linha bg-white px-5">
            <Row label="Serviço" value={service.name} />
            <Row label="Quando" value={<span className="capitalize">{dateLabel(date)}, {timeLabel(time)}</span>} />
            <Row label="Valor" value={service.price} />
            <Row label="Nome" value={name} />
            <Row label="WhatsApp" value={phone} />
            <Row label="Alergia" value={allergic ? allergyDetails : "Não"} />
            <Row label="Gestante" value={pregnant ? "Sim" : "Não"} />
          </dl>

          {service.depositCents > 0 ? (
            <p className="mt-5 leading-relaxed text-marrom-medio">
              Depois de confirmar, você terá {props.holdMinutes} minutos para pagar o sinal de{" "}
              <strong className="text-marrom">{brl(service.depositCents)}</strong> via Pix. O valor é descontado do procedimento.
            </p>
          ) : null}
          <p className="mt-3 text-sm text-marrom-medio">
            Cancelamentos e remarcações com pelo menos {props.cancelMinHours} horas de antecedência.
          </p>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" className="btn-contorno" onClick={() => setStep(3)} disabled={submitting}>Voltar</button>
            <button type="button" className="btn-primario" onClick={submit} disabled={submitting}>
              {submitting ? "Reservando…" : "Confirmar reserva"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3.5">
      <dt className="text-marrom-medio">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function YesNo({ name, value, onChange }: { name: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { v: false, label: "Não" },
        { v: true, label: "Sim" },
      ].map((o) => (
        <label
          key={o.label}
          className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border text-[15px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ouro ${
            value === o.v ? "border-bordo bg-bordo text-white" : "border-linha bg-white"
          }`}
        >
          <input type="radio" name={name} className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
