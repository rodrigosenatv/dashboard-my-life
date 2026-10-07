import type { Metadata } from "next"
import { PaginaColecoes } from "@/features/colecoes/pagina-colecoes"

export const metadata: Metadata = { title: "Coleções" }
export const instant = false

export default function Pagina() {
  return <PaginaColecoes />
}
