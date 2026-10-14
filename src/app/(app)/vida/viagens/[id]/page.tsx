import type { Metadata } from "next"
import { PaginaViagem } from "@/features/viagens/pagina-viagem"

export const metadata: Metadata = { title: "Viagem" }
export const instant = false

export default function Pagina() {
  return <PaginaViagem />
}
