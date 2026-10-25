"use client"

import { Pause, Timer } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { mmss, ROTULO_FASE, rodando } from "@/features/flow/logica"
import { foco, useRestante, useSessaoFoco } from "@/features/flow/relogio"

/**
 * O timer de foco do app (o mesmo do Flow) para estudar: um toque começa; contando, mostra quanto falta e
 * pausa. O tempo continua no canto da tela em qualquer página.
 */
export function BotaoFoco({ className }: { className?: string }) {
  const s = useSessaoFoco()
  const restante = useRestante(1000)
  const ligado = rodando(s)
  const fase = ROTULO_FASE[s.fase]

  const alternar = () => {
    if (ligado) {
      foco.pausar()
      return
    }
    foco.comecar()
    toast.success(`${fase} começou. O tempo fica no canto da tela.`)
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={ligado ? `${fase}: faltam ${mmss(restante)}. Pausar` : `Começar ${fase.toLowerCase()} de ${mmss(restante)}`}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
        ligado ? "border-[var(--b-luz)]/60 bg-[var(--b-luz)]/10 text-ink shadow-[0_0_18px_-6px_var(--b-luz)]" : "border-[var(--b-borda-2)] text-ink-2 hover:border-[var(--b-luz)]/60 hover:text-ink",
        className,
      )}
    >
      {ligado ? (
        <>
          <Pause className="size-4 text-[var(--b-luz)]" aria-hidden />
          <span className="tabular">{mmss(restante)}</span>
        </>
      ) : (
        <>
          <Timer className="size-4 text-[var(--b-luz)]" aria-hidden />
          <span>
            {fase} <span className="tabular text-ink-3">{mmss(restante)}</span>
          </span>
        </>
      )}
    </button>
  )
}
