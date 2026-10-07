import type { Metadata } from "next"
import { PaginaCursos } from "@/features/cursos/pagina-cursos"

export const metadata: Metadata = { title: "Cursos" }
export const instant = false

export default function Pagina() {
  return <PaginaCursos />
}
