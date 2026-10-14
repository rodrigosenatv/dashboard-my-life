import type { Metadata } from "next"
import { PaginaAlimentacao } from "@/features/alimentacao/pagina-alimentacao"

export const metadata: Metadata = { title: "Alimentação" }
export const instant = false

export default function Pagina() {
  return <PaginaAlimentacao />
}
