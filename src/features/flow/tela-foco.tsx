"use client"

import { Dialog } from "radix-ui"
import * as React from "react"
import { Pause, Play, RotateCw, X } from "lucide-react"
import { useTelaAcesa } from "@/lib/tela-acesa"
import { cn } from "@/lib/utils"
import { duracao, mmss, rodando, rotuloBotao, ROTULO_FASE } from "./logica"
import { progressoDaFase } from "./quadro-logica"
import { foco, useRestante, useSessaoFoco } from "./relogio"

/**
 * A tela de foco: o quadro dos alvos inteiro, grande, e o timer discreto embaixo (a fase, quanto falta, a tarefa
 * e pausar ou continuar). A tela fica acesa enquanto ela está aberta. Esc, o X ou sair da tela cheia fecham.
 */
export function TelaDeFoco({ url, aoFechar }: { url: string; aoFechar: () => void }) {
  const s = useSessaoFoco()
  const restante = useRestante(1000)
  const total = duracao(s.ritmo, s.fase)
  const contando = rodando(s)
  const pausada = !contando && restante < total
  const principal = React.useRef<HTMLButtonElement>(null)
  // No celular em pé, um quadro deitado fica pequeno: uma dica rápida sugere deitar o aparelho
  const [dica, setDica] = React.useState(false)
  const mostrarDica = (img: HTMLImageElement) => {
    const emPe = window.matchMedia("(orientation: portrait) and (width < 40rem)").matches
    if (emPe && img.naturalWidth > img.naturalHeight * 1.2) setDica(true)
  }
  React.useEffect(() => {
    if (!dica) return
    const t = window.setTimeout(() => setDica(false), 6000)
    return () => window.clearTimeout(t)
  }, [dica])
  // Quem abriu (o quadro ou "Tela de foco"): o foco do teclado volta para ele ao fechar
  const quemAbriu = React.useRef<HTMLElement | null>(null)
  useTelaAcesa(true)

  const fechar = React.useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    aoFechar()
  }, [aoFechar])

  // Como no feed de vídeos: sem o espaço da barra de rolagem (no computador virava uma faixa) e com a barra do
  // sistema do celular preta, enquanto a tela de foco está aberta
  React.useLayoutEffect(() => {
    const html = document.documentElement
    const antes = { gutter: html.style.getPropertyValue("scrollbar-gutter"), overflow: html.style.getPropertyValue("overflow") }
    html.style.setProperty("scrollbar-gutter", "auto")
    html.style.setProperty("overflow", "hidden")
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    const cores = metas.map((m) => m.content)
    for (const m of metas) m.content = "#000000"
    return () => {
      html.style.setProperty("scrollbar-gutter", antes.gutter)
      html.style.setProperty("overflow", antes.overflow)
      metas.forEach((m, i) => (m.content = cores[i]))
    }
  }, [])

  // Saiu da tela cheia pelo navegador (Esc, gesto do sistema): a tela de foco fecha junto
  React.useEffect(() => {
    let estavaEmTelaCheia = Boolean(document.fullscreenElement)
    const aoMudar = () => {
      if (document.fullscreenElement) estavaEmTelaCheia = true
      else if (estavaEmTelaCheia) aoFechar()
    }
    document.addEventListener("fullscreenchange", aoMudar)
    return () => document.removeEventListener("fullscreenchange", aoMudar)
  }, [aoFechar])

  return (
    <Dialog.Root open onOpenChange={(aberta) => !aberta && fechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none data-[state=open]:animate-[fade-in_200ms_ease-out]"
          onOpenAutoFocus={(e) => {
            // O foco começa em pausar/continuar: Espaço e Enter já fazem o que se espera
            e.preventDefault()
            quemAbriu.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            principal.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            quemAbriu.current?.focus({ preventScroll: true })
          }}
          onKeyDown={(e) => {
            // Espaço pausa e continua mesmo com o foco fora dos botões (depois de um toque na imagem)
            if (e.key !== " " || e.altKey || e.ctrlKey || e.metaKey) return
            if ((e.target as HTMLElement).closest("button, a")) return
            e.preventDefault()
            foco.alternar()
          }}
        >
          <Dialog.Title className="sr-only">Tela de foco</Dialog.Title>
          <Dialog.Description className="sr-only">O quadro dos alvos e o timer do Flow. Espaço pausa e continua; Esc sai.</Dialog.Description>

          {/* O quadro: inteiro, o maior possível; atrás, ele mesmo desfocado preenche as sobras com as cores dele */}
          <div tabIndex={-1} className="relative min-h-0 flex-1 overflow-hidden outline-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do storage, já otimizado no envio */}
            <img src={url} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-35 blur-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do storage, já otimizado no envio */}
            <img
              src={url}
              alt="Quadro dos alvos"
              onLoad={(e) => mostrarDica(e.currentTarget)}
              className="absolute inset-0 size-full object-contain sm:p-6 lg:p-8 baixa:p-1.5"
            />
            {dica ? (
              <p role="status" className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] mx-auto flex w-fit items-center gap-2 rounded-full bg-black/60 px-3.5 py-2 text-sm text-white/90 backdrop-blur-sm">
                <RotateCw aria-hidden className="size-4" /> Deite o celular para ver o quadro maior
              </p>
            ) : null}
          </div>

          {/* O timer, discreto: a barra fina mostra quanto da fase já passou */}
          <div className="relative shrink-0 border-t border-white/10 bg-black/85">
            <div aria-hidden className="absolute inset-x-0 -top-px h-0.5 bg-white/10">
              <div
                className={cn("h-full motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear", s.fase === "foco" ? "bg-estudos" : "bg-rotina")}
                style={{ width: `${progressoDaFase(restante, total) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-3 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5 sm:gap-5 sm:px-6 baixa:pb-[max(0.5rem,env(safe-area-inset-bottom))] baixa:pt-2">
              <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-5">
                {/* Em tela baixa, a fase e o tempo ficam numa linha só */}
                <div className="shrink-0 baixa:flex baixa:items-baseline baixa:gap-3">
                  <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-white/70">
                    <span aria-hidden className={cn("size-1.5 rounded-full", s.fase === "foco" ? "bg-estudos" : "bg-rotina", contando && "motion-safe:animate-pulse")} />
                    {ROTULO_FASE[s.fase]}
                    {pausada ? <span className="text-white/50"> · pausado</span> : null}
                  </p>
                  <p role="timer" aria-live="off" className={cn("font-display text-4xl font-semibold leading-tight tracking-tight tabular sm:text-5xl baixa:text-3xl", !contando && "text-white/80")}>
                    {mmss(restante)}
                  </p>
                </div>
                {s.tarefa ? (
                  <p className="mt-0.5 min-w-0 truncate text-sm text-white/75 sm:mt-0 sm:border-l sm:border-white/15 sm:pl-5 sm:text-base" title={s.tarefa.titulo}>
                    <span className="sr-only">Focando em: </span>
                    {s.tarefa.titulo}
                  </p>
                ) : null}
              </div>
              <button
                ref={principal}
                type="button"
                onClick={() => foco.alternar()}
                aria-label={rotuloBotao(s)}
                className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-3.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5 baixa:h-11 [&_svg]:size-5"
              >
                {contando ? <Pause aria-hidden /> : <Play aria-hidden />}
                <span className="hidden sm:inline">{rotuloBotao(s)}</span>
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Sair da tela de foco"
                  title="Sair (Esc)"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&_svg]:size-5"
                >
                  <X aria-hidden />
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
