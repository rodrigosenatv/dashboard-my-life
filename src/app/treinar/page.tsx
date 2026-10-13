import type { Metadata } from "next"
import { Suspense } from "react"
import { SoNoNavegador } from "@/components/shell/so-no-navegador"
import { ModoTreino } from "@/features/treino/modo-treino"

export const metadata: Metadata = { title: "Treinando" }
// O treino em andamento fica no aparelho; não há casca estática para validar.
export const instant = false

/** Modo treino em tela cheia, fora da moldura do app (sem barra lateral nem barra de baixo). */
export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <SoNoNavegador esqueleto={null}>
        <ModoTreino />
      </SoNoNavegador>
    </Suspense>
  )
}
