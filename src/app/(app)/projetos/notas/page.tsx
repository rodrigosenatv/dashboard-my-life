import type { Metadata } from "next"
import { PaginaNotas } from "@/features/paginas/pagina-notas"

export const metadata: Metadata = { title: "Páginas" }
export const instant = false

export default function Pagina() {
  return <PaginaNotas />
}
