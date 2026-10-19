import type { Metadata } from "next"
import { PaginaFilmes } from "@/features/filmes/pagina-filmes"

export const metadata: Metadata = { title: "Filmes & Séries" }
export const instant = false

export default function Pagina() {
  return <PaginaFilmes />
}
