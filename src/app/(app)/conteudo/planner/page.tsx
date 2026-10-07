import type { Metadata } from "next"
import { PaginaPlanner } from "@/features/planner/pagina-planner"

export const metadata: Metadata = { title: "Planner de conteúdo" }
export const instant = false

export default function Pagina() {
  return <PaginaPlanner />
}
