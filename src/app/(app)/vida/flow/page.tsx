import type { Metadata } from "next"
import { PaginaFlow } from "@/features/flow/pagina-flow"

export const metadata: Metadata = { title: "Flow" }
export const instant = false

export default function Pagina() {
  return <PaginaFlow />
}
