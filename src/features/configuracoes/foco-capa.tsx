"use client"

import * as React from "react"
import type { FocoCapa } from "@/features/hoje/logica"

const prender = (v: number) => Math.min(100, Math.max(0, Math.round(v)))

/**
 * O ponto da imagem de capa que fica sempre à vista. A capa corta a imagem quando ela não cabe inteira (em cima
 * e embaixo no computador, dos lados no celular); o corte acompanha este ponto. Um toque na imagem escolhe o
 * ponto (com o mouse, dá para arrastar); com o teclado, as setas movem o marcador (Shift: passos maiores).
 */
export function EscolherFoco({ url, foco, aoMudar }: { url: string; foco: FocoCapa; aoMudar: (foco: FocoCapa) => void }) {
  const area = React.useRef<HTMLDivElement>(null)
  // O ponto escolhido aqui vale até o gravado chegar (sem o marcador voltar para trás enquanto grava)
  const [local, setLocal] = React.useState<FocoCapa | null>(null)
  React.useEffect(() => setLocal(null), [foco.x, foco.y])
  // Com o mouse dá para arrastar o ponto; no toque, só um toque parado marca (arrastar o dedo rola a página)
  const inicio = React.useRef<{ x: number; y: number; mouse: boolean } | null>(null)
  const gravarDepois = React.useRef<number | undefined>(undefined)
  React.useEffect(() => () => window.clearTimeout(gravarDepois.current), [])
  const ponto = local ?? foco

  const doPonteiro = (e: React.PointerEvent): FocoCapa => {
    const r = area.current!.getBoundingClientRect()
    return { x: prender(((e.clientX - r.left) / r.width) * 100), y: prender(((e.clientY - r.top) / r.height) * 100) }
  }

  const gravar = (f: FocoCapa) => {
    if (f.x === foco.x && f.y === foco.y) setLocal(null)
    else aoMudar(f)
  }

  return (
    <div
      ref={area}
      className="relative w-full max-w-md cursor-crosshair touch-manipulation select-none overflow-hidden rounded-xl border border-line bg-surface-2"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        const mouse = e.pointerType === "mouse"
        inicio.current = { x: e.clientX, y: e.clientY, mouse }
        if (mouse) {
          e.currentTarget.setPointerCapture(e.pointerId)
          setLocal(doPonteiro(e))
        }
      }}
      onPointerMove={(e) => {
        if (inicio.current?.mouse) setLocal(doPonteiro(e))
      }}
      onPointerUp={(e) => {
        const i = inicio.current
        inicio.current = null
        if (!i || (!i.mouse && Math.hypot(e.clientX - i.x, e.clientY - i.y) > 10)) return
        const f = doPonteiro(e)
        setLocal(f)
        gravar(f)
      }}
      onPointerCancel={() => {
        inicio.current = null
        setLocal(null)
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do storage, já otimizado no envio */}
      <img src={url} alt="" draggable={false} className="block h-auto w-full" />
      {/* As linhas que se cruzam no ponto ajudam a mirar */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white/70 shadow-[0_0_2px_rgb(0_0_0/0.8)]" style={{ left: `${ponto.x}%` }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 h-px -translate-y-1/2 bg-white/70 shadow-[0_0_2px_rgb(0_0_0/0.8)]" style={{ top: `${ponto.y}%` }} />
      <button
        type="button"
        className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-black/25 shadow-[0_0_0_1.5px_rgb(0_0_0/0.5),0_2px_8px_rgb(0_0_0/0.45)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]/70"
        style={{ left: `${ponto.x}%`, top: `${ponto.y}%` }}
        aria-label={`Ponto que fica sempre à vista na capa: ${ponto.x}% da largura e ${ponto.y}% da altura. Use as setas para mover.`}
        onKeyDown={(e) => {
          const passo = e.shiftKey ? 10 : 2
          let f: FocoCapa
          if (e.key === "ArrowLeft") f = { ...ponto, x: prender(ponto.x - passo) }
          else if (e.key === "ArrowRight") f = { ...ponto, x: prender(ponto.x + passo) }
          else if (e.key === "ArrowUp") f = { ...ponto, y: prender(ponto.y - passo) }
          else if (e.key === "ArrowDown") f = { ...ponto, y: prender(ponto.y + passo) }
          else return
          e.preventDefault()
          setLocal(f)
          // Segurar a seta move o ponto várias vezes: grava uma vez só, depois da pausa
          window.clearTimeout(gravarDepois.current)
          gravarDepois.current = window.setTimeout(() => gravar(f), 700)
        }}
      />
    </div>
  )
}
