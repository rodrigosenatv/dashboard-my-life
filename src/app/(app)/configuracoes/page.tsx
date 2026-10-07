import type { Metadata } from "next"
import { PaginaConfiguracoes } from "@/features/configuracoes/pagina-configuracoes"

export const metadata: Metadata = { title: "Configurações" }
export const instant = false

export default function Pagina() {
  return <PaginaConfiguracoes />
}
