"use client"

import type { ComponentProps } from "react"
import { FormularioSobDemanda } from "@/components/formulario-sob-demanda"

const carregar = () => import("./formulario-captura").then(m => ({ default: m.DialogoCaptura }))

/** O formulário e suas consultas só existem enquanto a janela está aberta. */
export function DialogoCaptura(props: ComponentProps<typeof import("./formulario-captura").DialogoCaptura>) {
  if (!props.aberta) return null
  return <FormularioSobDemanda carregar={carregar} propriedades={props} titulo="Captura" />
}
