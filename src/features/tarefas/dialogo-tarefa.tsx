"use client"

import type { ComponentProps } from "react"
import { FormularioSobDemanda } from "@/components/formulario-sob-demanda"

const carregar = () => import("./formulario-tarefa").then(m => ({ default: m.DialogoTarefa }))

/** O formulário e suas consultas só existem enquanto a janela está aberta. */
export function DialogoTarefa(props: ComponentProps<typeof import("./formulario-tarefa").DialogoTarefa>) {
  if (!props.aberta) return null
  return <FormularioSobDemanda carregar={carregar} propriedades={props} titulo="Tarefa" />
}
