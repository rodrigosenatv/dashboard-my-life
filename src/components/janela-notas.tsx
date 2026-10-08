"use client"

import { Janela } from "@/components/ui/janela"
import { EditorMarkdown } from "@/components/markdown"

/** Janela larga para ler e editar as anotações de um item (curso, disciplina, assunto…). */
export function JanelaNotas({
  aberta,
  aoMudar,
  titulo,
  texto,
  aoSalvar,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  titulo: string
  texto: string | null | undefined
  aoSalvar: (v: string) => void
}) {
  return (
    <Janela aberta={aberta} aoMudar={aoMudar} titulo={titulo} largura="xl">
      {aberta ? <EditorMarkdown rotulo={`anotações de ${titulo}`} valor={texto ?? ""} aoSalvar={aoSalvar} /> : null}
    </Janela>
  )
}
