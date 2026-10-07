import type { Metadata } from "next"
import { PaginaLinks } from "@/features/links/pagina-links"

export const metadata: Metadata = { title: "Links úteis" }
export const instant = false

export default function Pagina() {
  return <PaginaLinks />
}
