import type { Metadata } from "next"
import { PaginaProjeto } from "@/features/projetos/pagina-projeto"

export const metadata: Metadata = { title: "Projeto" }
export const instant = false

export default function Pagina() {
  return <PaginaProjeto />
}
