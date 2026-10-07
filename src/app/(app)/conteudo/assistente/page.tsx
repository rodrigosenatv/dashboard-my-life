import type { Metadata } from "next"
import { PaginaAssistente } from "@/features/assistente/pagina-assistente"

export const metadata: Metadata = { title: "Assistente" }
export const instant = false

export default function Pagina() {
  return <PaginaAssistente />
}
