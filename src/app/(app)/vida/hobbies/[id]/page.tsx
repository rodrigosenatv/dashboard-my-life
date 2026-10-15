import type { Metadata } from "next"
import { PaginaHobby } from "@/features/hobbies/pagina-hobby"

export const metadata: Metadata = { title: "Hobby" }
export const instant = false

export default function Pagina() {
  return <PaginaHobby />
}
