"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "../actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primario w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="rotulo">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" className="campo" required />
      </div>
      <div>
        <label htmlFor="password" className="rotulo">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="campo" required />
      </div>
      {state?.error && <p role="alert" className="erro">{state.error}</p>}
      <Submit />
    </form>
  );
}
