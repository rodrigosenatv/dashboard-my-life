import type { Metadata } from "next"
import { PaginaMetas } from "@/features/metas/pagina-metas"

export const metadata: Metadata = { title: "Metas" }
export const instant = false

export default function Pagina() {
  return <PaginaMetas />
}
