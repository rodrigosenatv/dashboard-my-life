import type { Metadata } from "next"
import { PaginaCurso } from "@/features/cursos/pagina-curso"

export const metadata: Metadata = { title: "Curso" }
export const instant = false

export default function Pagina() {
  return <PaginaCurso />
}
