import type { Metadata } from "next"
import { Suspense } from "react"
import { SoNoNavegador } from "@/components/shell/so-no-navegador"
import { Leitor } from "@/features/leitor/leitor"

export const metadata: Metadata = { title: "Leitura" }
// O livro fica no aparelho e é aberto no navegador; não há casca estática para validar.
export const instant = false

/** Leitor em tela cheia, fora da moldura do app (sem barra lateral nem barra de baixo). */
export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <SoNoNavegador esqueleto={null}>
        <Leitor />
      </SoNoNavegador>
    </Suspense>
  )
}
