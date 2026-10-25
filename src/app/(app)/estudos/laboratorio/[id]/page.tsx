import type { Metadata } from "next"
import { PaginaExperimento } from "@/features/laboratorio/pagina-experimento"

export const metadata: Metadata = { title: "Experimento" }
export const instant = false

export default function Pagina() {
  return <PaginaExperimento />
}
