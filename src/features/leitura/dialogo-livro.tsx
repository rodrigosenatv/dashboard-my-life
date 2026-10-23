"use client"

import type { ComponentProps } from "react"
import { FormularioSobDemanda } from "@/components/formulario-sob-demanda"

const carregar = () => import("./formulario-livro").then(m => ({ default: m.DialogoLivro }))

/** O formulário e suas consultas só existem enquanto a janela está aberta. */
export function DialogoLivro(props: ComponentProps<typeof import("./formulario-livro").DialogoLivro>) {
  if (!props.aberta) return null
  return <FormularioSobDemanda carregar={carregar} propriedades={props} titulo="Livro" />
}
