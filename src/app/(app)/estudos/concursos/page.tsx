import type { Metadata } from "next"
import { PaginaConcursos } from "@/features/concursos/pagina-concursos"

export const metadata: Metadata = { title: "Concursos" }
export const instant = false

export default function Pagina() {
  return <PaginaConcursos />
}
