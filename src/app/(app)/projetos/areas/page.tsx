import type { Metadata } from "next"
import { PaginaAreas } from "@/features/segundo-cerebro/paginas"

export const metadata: Metadata = { title: "Áreas" }
export const instant = false

export default function Pagina() {
  return <PaginaAreas />
}
