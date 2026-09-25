"use client";

/**
 * Última rede de segurança: entra quando a falha é no próprio layout raiz,
 * caso em que nem as outras telas de erro chegam a aparecer. Por isso este
 * arquivo traz as próprias tags <html> e <body>, e não depende de CSS.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#FAF3F0", color: "#3B2A2F", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>O site está fora do ar no momento</h1>
          <p style={{ marginTop: 12, color: "#6B5459", lineHeight: 1.6 }}>
            Estamos com um problema técnico. Tente novamente em alguns instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 32, background: "#5E1A2C", color: "#fff", border: 0, borderRadius: 999, padding: "14px 28px", fontSize: 15, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
          {error.digest && (
            <p style={{ marginTop: 32, fontSize: 12, color: "#8A7378" }}>Código do erro: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
