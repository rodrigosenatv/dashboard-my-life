import type { Metadata } from "next"
import { Suspense } from "react"
import { SoNoNavegador } from "@/components/shell/so-no-navegador"
import { FeedDeVideos } from "@/features/videos/feed"

export const metadata: Metadata = { title: "Vídeos" }
// O feed depende da sessão e do aparelho; não há casca estática para validar.
export const instant = false

/** Os vídeos em tela cheia, um por vez, fora da moldura do app (sem barra lateral nem barra de baixo). */
export default function Pagina() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <SoNoNavegador esqueleto={<div className="fixed inset-0 bg-black" />}>
        <FeedDeVideos />
      </SoNoNavegador>
    </Suspense>
  )
}
