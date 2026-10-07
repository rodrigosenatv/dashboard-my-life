import type { Metadata } from "next"
import { Hoje } from "@/features/hoje/hoje"

export const metadata: Metadata = { title: "Hoje" }
export const instant = false

export default function PaginaHoje() {
  return <Hoje />
}
