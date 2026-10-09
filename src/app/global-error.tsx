"use client"

import * as React from "react"

/**
 * Erro no próprio esqueleto do app. Esta tela substitui o layout raiz e não recebe
 * os estilos globais, por isso traz o próprio HTML e as próprias cores.
 */
export default function ErroGlobal({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#191919",
          color: "#ececec",
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          lineHeight: 1.5,
        }}
      >
        <title>Erro | My Life</title>
        <main style={{ maxWidth: "22rem", textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem", lineHeight: 1.25 }}>O app encontrou um erro</h1>
          <p style={{ margin: 0, color: "#a8a8a8" }}>Seus dados estão salvos. Tente abrir de novo.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 24,
              height: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 8,
              background: "#4aa3c2",
              color: "#0f1d23",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  )
}
