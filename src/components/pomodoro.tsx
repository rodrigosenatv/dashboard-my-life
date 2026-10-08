"use client"

import * as React from "react"
import { Pause, Play, RotateCcw, Timer } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { cn, isoDia } from "@/lib/utils"

type Modo = "foco" | "pausa" | "longa"

const DURACAO: Record<Modo, number> = { foco: 25 * 60, pausa: 5 * 60, longa: 15 * 60 }
const ROTULO: Record<Modo, string> = { foco: "Foco", pausa: "Pausa", longa: "Pausa longa" }
const CHAVE = "dml-pomodoros"

function lerContagem(): number {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as { dia?: string; n?: number }
    return salvo.dia === isoDia() ? (salvo.n ?? 0) : 0
  } catch {
    return 0
  }
}

function salvarContagem(n: number) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ dia: isoDia(), n }))
  } catch {}
}

/** Toque curto ao terminar um ciclo, sem precisar de arquivo de áudio. */
function tocar() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.22)
    })
  } catch {}
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

/**
 * Timer Pomodoro, como o que fica embutido na página de Leitura do Notion.
 * `aoConcluirFoco` recebe os minutos focados (ex.: para registrar um estudo).
 */
export function Pomodoro({ className, aoConcluirFoco }: { className?: string; aoConcluirFoco?: (minutos: number) => void }) {
  const [modo, setModo] = React.useState<Modo>("foco")
  const [restante, setRestante] = React.useState(DURACAO.foco)
  const [rodando, setRodando] = React.useState(false)
  const [feitos, setFeitos] = React.useState(0)
  const fim = React.useRef<number | null>(null)
  const tituloOriginal = React.useRef<string>("")

  React.useEffect(() => setFeitos(lerContagem()), [])

  const terminar = React.useCallback(() => {
    setRodando(false)
    fim.current = null
    tocar()
    if (modo === "foco") {
      const n = lerContagem() + 1
      salvarContagem(n)
      setFeitos(n)
      aoConcluirFoco?.(DURACAO.foco / 60)
      const proximo: Modo = n % 4 === 0 ? "longa" : "pausa"
      setModo(proximo)
      setRestante(DURACAO[proximo])
    } else {
      setModo("foco")
      setRestante(DURACAO.foco)
    }
    try {
      if ("Notification" in window && Notification.permission === "granted") new Notification(modo === "foco" ? "Foco concluído. Hora da pausa." : "Pausa encerrada. De volta ao foco.")
    } catch {}
  }, [modo, aoConcluirFoco])

  React.useEffect(() => {
    if (!rodando) return
    if (!tituloOriginal.current) tituloOriginal.current = document.title
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.round(((fim.current ?? Date.now()) - Date.now()) / 1000))
      setRestante(s)
      document.title = `${mmss(s)} ${ROTULO[modo]}`
      if (s <= 0) terminar()
    }, 250)
    return () => {
      window.clearInterval(id)
      if (tituloOriginal.current) document.title = tituloOriginal.current
    }
  }, [rodando, modo, terminar])

  const alternar = () => {
    if (rodando) {
      setRodando(false)
      fim.current = null
      return
    }
    try {
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission()
    } catch {}
    fim.current = Date.now() + restante * 1000
    setRodando(true)
  }

  const escolher = (m: Modo) => {
    setRodando(false)
    fim.current = null
    setModo(m)
    setRestante(DURACAO[m])
  }

  const total = DURACAO[modo]
  const pct = 1 - restante / total
  const raio = 44
  const volta = 2 * Math.PI * raio

  return (
    <section aria-label="Pomodoro" className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Timer className="size-4 text-estudos" /> Pomodoro
        </p>
        <span className="tabular text-xs text-ink-3" title="Ciclos de foco concluídos hoje">
          {feitos} {feitos === 1 ? "ciclo hoje" : "ciclos hoje"}
        </span>
      </div>
      <div className="mb-3 flex justify-center gap-1">
        {(Object.keys(DURACAO) as Modo[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => escolher(m)}
            aria-pressed={modo === m}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium", modo === m ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink")}
          >
            {ROTULO[m]}
          </button>
        ))}
      </div>
      <div className="relative mx-auto grid size-32 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={raio} fill="none" strokeWidth="5" className="stroke-surface-3" />
          <circle
            cx="50"
            cy="50"
            r={raio}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={volta}
            strokeDashoffset={volta * (1 - pct)}
            className={cn("transition-[stroke-dashoffset] duration-300", modo === "foco" ? "stroke-estudos" : "stroke-rotina")}
          />
        </svg>
        <span className="tabular font-display text-3xl font-semibold" role="timer" aria-live="off">
          {mmss(restante)}
        </span>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <Botao variante="primario" tamanho="sm" onClick={alternar}>
          {rodando ? <Pause /> : <Play />} {rodando ? "Pausar" : restante < total ? "Continuar" : "Começar"}
        </Botao>
        <Botao variante="fantasma" tamanho="icone-sm" aria-label="Reiniciar" onClick={() => escolher(modo)}>
          <RotateCcw />
        </Botao>
      </div>
    </section>
  )
}
