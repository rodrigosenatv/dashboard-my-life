import type { Metadata } from "next"
import { PaginaEntrada } from "@/features/segundo-cerebro/paginas"

export const metadata: Metadata = { title: "Caixa de Entrada" }
export const instant = false

export default function Pagina() {
  return <PaginaEntrada />
}
