import type { Metadata } from "next"
import { PaginaPessoal } from "@/features/pessoal/pagina-pessoal"

export const metadata: Metadata = { title: "Pessoal" }
export const instant = false

export default function Pagina() {
  return <PaginaPessoal />
}
