"use client";

import { useFormState, useFormStatus } from "react-dom";
import { lookupBooking } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primario w-full" disabled={pending}>
      {pending ? "Procurando…" : "Ver reserva"}
    </button>
  );
}

export function LookupForm() {
  const [state, action] = useFormState(lookupBooking, undefined);
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="code" className="rotulo">Código da reserva</label>
        <input id="code" name="code" className="campo uppercase" autoComplete="off" required />
      </div>
      <div>
        <label htmlFor="phone" className="rotulo">WhatsApp</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" className="campo" placeholder="(00) 00000-0000" required />
      </div>
      {state?.error && <p role="alert" className="erro">{state.error}</p>}
      <Submit />
    </form>
  );
}
