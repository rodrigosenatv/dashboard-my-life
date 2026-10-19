import type { Metadata } from "next"
import { PaginaGuardaRoupa } from "@/features/guarda-roupa/pagina-guarda-roupa"

export const metadata: Metadata = { title: "Guarda Roupa" }
export const instant = false

export default function Pagina() {
  return <PaginaGuardaRoupa />
}
