import type { Metadata } from "next"
import { PaginaViagens } from "@/features/viagens/pagina-viagens"

export const metadata: Metadata = { title: "Viagens" }
export const instant = false

export default function Pagina() {
  return <PaginaViagens />
}
