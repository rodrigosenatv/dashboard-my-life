import type { Metadata } from "next"
import { PaginaHobbies } from "@/features/hobbies/pagina-hobbies"

export const metadata: Metadata = { title: "Hobbies" }
export const instant = false

export default function Pagina() {
  return <PaginaHobbies />
}
