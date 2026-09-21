"use client";

import { useFormState } from "react-dom";

type Result = { error?: string; ok?: string } | undefined;

/** Formulário que exibe o retorno (erro ou sucesso) de uma ação do servidor. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: Result, form: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p role="alert" className="erro">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-1 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
