import type { Metadata } from "next"
import { PaginaArquivo } from "@/features/segundo-cerebro/paginas"

export const metadata: Metadata = { title: "Arquivo" }
export const instant = false

export default function Pagina() {
  return <PaginaArquivo />
}
