import type { Metadata } from "next"
import { PaginaBiblioteca } from "@/features/paginas/pagina-biblioteca"

export const metadata: Metadata = { title: "Biblioteca" }
export const instant = false

export default function Pagina() {
  return <PaginaBiblioteca />
}
