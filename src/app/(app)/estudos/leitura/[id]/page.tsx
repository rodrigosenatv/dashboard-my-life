import type { Metadata } from "next"
import { PaginaLivro } from "@/features/leitura/pagina-livro"

export const metadata: Metadata = { title: "Livro" }
export const instant = false

export default function Pagina() {
  return <PaginaLivro />
}
