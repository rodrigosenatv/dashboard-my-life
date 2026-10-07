import type { Metadata } from "next"
import { PaginaCapturas } from "@/features/capturas/pagina-capturas"

export const metadata: Metadata = { title: "Capturas" }
export const instant = false

export default function Pagina() {
  return <PaginaCapturas />
}
