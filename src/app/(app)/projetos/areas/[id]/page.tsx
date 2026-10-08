import type { Metadata } from "next"
import { PaginaArea } from "@/features/segundo-cerebro/paginas"

export const metadata: Metadata = { title: "Área" }
export const instant = false

export default function Pagina() {
  return <PaginaArea />
}
