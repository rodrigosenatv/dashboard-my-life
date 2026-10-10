"use client"

import dynamic from "next/dynamic"

/**
 * O leitor de markdown é uma das partes mais pesadas do app. Onde o texto só aparece
 * depois de um clique (expandir uma anotação, abrir uma janela), ele é baixado nessa hora.
 */
export const MarkdownSobDemanda = dynamic(() => import("./markdown").then((m) => m.Markdown), {
  ssr: false,
  loading: () => <span aria-hidden className="block h-16 animate-pulse rounded-md bg-surface-2" />,
})
