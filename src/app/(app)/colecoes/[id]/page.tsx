import type { Metadata } from "next"
import { PaginaColecao } from "@/features/colecoes/pagina-colecao"

export const metadata: Metadata = { title: "Coleção" }
export const instant = false

export default function Pagina() {
  return <PaginaColecao />
}
