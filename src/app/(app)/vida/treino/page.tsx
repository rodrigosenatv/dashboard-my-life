import type { Metadata } from "next"
import { PaginaTreino } from "@/features/treino/pagina-treino"

export const metadata: Metadata = { title: "Treino" }
export const instant = false

export default function Pagina() {
  return <PaginaTreino />
}
