import type { Metadata } from "next"
import { PaginaRecursos } from "@/features/segundo-cerebro/paginas"

export const metadata: Metadata = { title: "Recursos" }
export const instant = false

export default function Pagina() {
  return <PaginaRecursos />
}
