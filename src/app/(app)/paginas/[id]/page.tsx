import type { Metadata } from "next"
import { PaginaDocumento } from "@/features/paginas/pagina-documento"

export const metadata: Metadata = { title: "Página" }
export const instant = false

export default function Pagina() {
  return <PaginaDocumento />
}
