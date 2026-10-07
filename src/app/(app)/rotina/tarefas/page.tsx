import type { Metadata } from "next"
import { PaginaTarefas } from "@/features/tarefas/pagina-tarefas"

export const metadata: Metadata = { title: "Tarefas" }
export const instant = false

export default function Pagina() {
  return <PaginaTarefas />
}
