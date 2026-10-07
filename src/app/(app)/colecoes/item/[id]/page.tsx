import type { Metadata } from "next"
import { PaginaItem } from "@/features/colecoes/pagina-item"

export const metadata: Metadata = { title: "Item" }
export const instant = false

export default function Pagina() {
  return <PaginaItem />
}
