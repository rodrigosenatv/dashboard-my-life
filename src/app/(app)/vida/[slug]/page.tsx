import type { Metadata } from "next"
import { PaginaHub } from "@/features/vida/pagina-hub"

export const metadata: Metadata = { title: "Vida pessoal" }
export const instant = false

export default function Pagina() {
  return <PaginaHub />
}
