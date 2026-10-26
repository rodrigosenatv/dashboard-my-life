"use client"

import * as React from "react"
import { partesDoPrompt } from "./logica"

/** O texto de um prompt com os campos a preencher ([TÓPICO], {número}) acesos. */
export function TextoPrompt({ texto }: { texto: string }) {
  return (
    <>
      {partesDoPrompt(texto).map((p, i) =>
        p.campo ? (
          <span key={i} className="campo-prompt">
            {p.texto}
          </span>
        ) : (
          <React.Fragment key={i}>{p.texto}</React.Fragment>
        ),
      )}
    </>
  )
}
