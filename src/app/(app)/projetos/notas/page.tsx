import type { Metadata } from "next"
import { PaginaNotas } from "@/features/paginas/pagina-notas"

export const metadata: Metadata = { title: "Notas" }
export const instant = false

export default function Pagina() {
  return <PaginaNotas />
}
