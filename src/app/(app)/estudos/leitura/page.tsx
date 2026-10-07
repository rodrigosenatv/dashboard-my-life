import type { Metadata } from "next"
import { PaginaLeitura } from "@/features/leitura/pagina-leitura"

export const metadata: Metadata = { title: "Leitura" }
export const instant = false

export default function Pagina() {
  return <PaginaLeitura />
}
