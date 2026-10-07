import type { Metadata } from "next"
import { PaginaHabitos } from "@/features/habitos/pagina-habitos"

export const metadata: Metadata = { title: "Hábitos" }
export const instant = false

export default function Pagina() {
  return <PaginaHabitos />
}
