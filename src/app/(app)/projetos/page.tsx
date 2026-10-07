import type { Metadata } from "next"
import { PaginaProjetos } from "@/features/projetos/pagina-projetos"

export const metadata: Metadata = { title: "Projetos" }
export const instant = false

export default function Pagina() {
  return <PaginaProjetos />
}
