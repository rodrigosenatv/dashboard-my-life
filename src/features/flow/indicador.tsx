"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { mmss, ROTA_FLOW, ROTULO_FASE, rodando, type Fase } from "./logica"
import { useRestante, useSessaoFoco } from "./relogio"

/** A pílula do timer: quanto falta e, ao toque, leva ao Flow (ou ao timer, quando já está na tela). */
export function PilulaFoco({
  fase,
  restante,
  href,
  aoClicar,
  rotulo,
}: {
  fase: Fase
  restante: number
  href?: string
  aoClicar?: () => void
  rotulo: string
}) {
  // No celular ela fica acima da barra de baixo; no computador, no canto
  const classe = cn(
    "fixed bottom-[calc(env(safe-area-inset-bottom)_+_4.75rem)] right-3 z-30 inline-flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3.5 py-2 text-sm font-medium shadow-overlay backdrop-blur hover:border-line-strong toque:min-h-11 lg:bottom-6 lg:right-6",
  )
  const nome = `${ROTULO_FASE[fase]}: faltam ${mmss(restante)}. ${rotulo}`
  const conteudo = (
    <>
      <span aria-hidden className={cn("size-2 rounded-full motion-safe:animate-pulse", fase === "foco" ? "bg-estudos" : "bg-rotina")} />
      <span className="tabular">
        {mmss(restante)} · {ROTULO_FASE[fase]}
      </span>
    </>
  )
  if (href) {
    return (
      <Link href={href} aria-label={nome} className={classe}>
        {conteudo}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={nome} onClick={aoClicar} className={classe}>
      {conteudo}
    </button>
  )
}

/** A pílula fora do Flow: aparece enquanto o timer conta, em qualquer tela do app. */
export function IndicadorFoco() {
  const pathname = usePathname()
  const s = useSessaoFoco()
  const restante = useRestante(1000)
  if (pathname === ROTA_FLOW || !rodando(s)) return null
  return <PilulaFoco fase={s.fase} restante={restante} href={ROTA_FLOW} rotulo="Abrir o Flow" />
}
