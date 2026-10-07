import type { Metadata } from "next"
import { PaginaAgenda } from "@/features/agenda/pagina-agenda"

export const metadata: Metadata = { title: "Agenda" }
export const instant = false

export default function Pagina() {
  return <PaginaAgenda />
}
