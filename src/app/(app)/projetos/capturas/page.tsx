import type { Metadata } from "next"
import { PaginaAnotacoes } from "@/features/segundo-cerebro/paginas"

export const metadata: Metadata = { title: "Anotações" }
export const instant = false

export default function Pagina() {
  return <PaginaAnotacoes />
}
