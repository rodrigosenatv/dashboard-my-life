import type { Metadata } from "next"
import { PaginaLaboratorio } from "@/features/laboratorio/pagina-laboratorio"

export const metadata: Metadata = { title: "Laboratório" }
export const instant = false

export default function Pagina() {
  return <PaginaLaboratorio />
}
