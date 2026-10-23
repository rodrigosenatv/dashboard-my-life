"use client"

import type { ComponentProps } from "react"
import { FormularioSobDemanda } from "@/components/formulario-sob-demanda"

const carregar = () => import("./formulario-conteudo").then(m => ({ default: m.DialogoConteudo }))

/** O formulário e suas consultas só existem enquanto a janela está aberta. */
export function DialogoConteudo(props: ComponentProps<typeof import("./formulario-conteudo").DialogoConteudo>) {
  if (!props.aberta) return null
  return <FormularioSobDemanda carregar={carregar} propriedades={props} titulo="Conteúdo" />
}
