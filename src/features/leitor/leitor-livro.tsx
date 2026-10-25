"use client"

import Link from "next/link"
import * as React from "react"
import { ArrowLeft, List, LoaderCircle, Quote, Search, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { cssDoLivro, MARGENS, TEMAS, type Aparencia } from "./aparencia"
import { carregarFoliate, protegerLivro, textoDoMetadado, type ItemSumarioLivro, type Localizacao, type VisaoFoliate } from "./foliate"
import { arrastarFolha, criarDeslize, folhaDisponivel, movimentoReduzido, pararFolha, virarFolha, type ArrastoFolha, type OpcoesFolha, type Sentido } from "./folha"
import { PainelAjustes } from "./painel-ajustes"
import { PainelBusca } from "./painel-busca"
import { PainelSumario } from "./painel-sumario"

export type InfoLugar = { localizacao: Localizacao; paginasTotais: number | null }

type Props = {
  arquivo: File
  titulo: string
  voltarPara: string
  posicaoInicial: string | null
  aparencia: Aparencia
  aoMudarAparencia: (a: Aparencia) => void
  aoMudarLugar: (info: InfoLugar) => void
  /** Guardar o trecho selecionado (nos insights do livro). */
  aoGuardarTrecho?: (texto: string) => void
}

type Painel = "sumario" | "ajustes" | "busca" | null

const ehCampo = (alvo: EventTarget | null) => alvo instanceof HTMLElement && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))

/** O efeito de folha vale agora: escolhido, no modo de páginas e com suporte no navegador. */
const folhaLigada = (a: Aparencia) => a.virada === "folha" && a.modo === "paginas" && folhaDisponivel()

export function minutos(m: number | undefined): string {
  if (m === undefined || !Number.isFinite(m)) return ""
  const n = Math.max(1, Math.round(m))
  if (n < 60) return `${n} min`
  const h = Math.floor(n / 60)
  const resto = n % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

/** O leitor em si: mostra o livro, vira as páginas e oferece sumário, busca e ajustes. */
export function LeitorLivro({ arquivo, titulo, voltarPara, posicaoInicial, aparencia, aoMudarAparencia, aoMudarLugar, aoGuardarTrecho }: Props) {
  const tela = React.useRef<HTMLDivElement>(null)
  const caixa = React.useRef<HTMLDivElement>(null)
  const visao = React.useRef<VisaoFoliate | null>(null)
  const [pronto, setPronto] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [lugar, setLugar] = React.useState<Localizacao | null>(null)
  const [barras, setBarras] = React.useState(true)
  const [painel, setPainel] = React.useState<Painel>(null)
  const [sumario, setSumario] = React.useState<ItemSumarioLivro[]>([])
  const [paginas, setPaginas] = React.useState<{ label: string; href: string }[]>([])
  const [arrastando, setArrastando] = React.useState<number | null>(null)
  const [trecho, setTrecho] = React.useState<string | null>(null)
  const [tituloDoArquivo, setTituloDoArquivo] = React.useState("")
  const docAtual = React.useRef<Document | null>(null)

  // Referências estáveis para os ouvintes registrados uma vez só
  const aoMudarLugarRef = React.useRef(aoMudarLugar)
  const painelRef = React.useRef(painel)
  const aparenciaRef = React.useRef(aparencia)
  React.useEffect(() => {
    aoMudarLugarRef.current = aoMudarLugar
    painelRef.current = painel
    aparenciaRef.current = aparencia
  })

  /** Chamado a cada página virada (mantém a tela acesa por mais um tempo). */
  const atividade = React.useRef<(() => void) | null>(null)

  const tema = TEMAS[aparencia.tema]
  const paginasTotais = React.useMemo(() => {
    const ultima = Number(paginas.at(-1)?.label)
    return Number.isFinite(ultima) && ultima > 0 ? ultima : paginas.length || null
  }, [paginas])
  const paginasTotaisRef = React.useRef(paginasTotais)
  React.useEffect(() => {
    paginasTotaisRef.current = paginasTotais
  }, [paginasTotais])

  const irPara = React.useCallback((alvo: string | number) => {
    void visao.current?.goTo(alvo)
  }, [])

  /** Como a folha vira agora para esse lado (null no começo ou no fim do livro). */
  const montarFolha = React.useCallback((lado: Sentido): OpcoesFolha | null => {
    const v = visao.current
    const el = caixa.current
    if (!v || !el) return null
    const r = v.renderer
    // Avançar no livro é ir para a direita (para a esquerda nos livros escritos da direita para a esquerda)
    const avancando = (lado === "proxima") !== (v.book?.dir === "rtl")
    if (avancando ? r.atEnd : r.atStart) return null
    const pagina = r.page ?? 0
    const total = r.pages ?? 0
    return {
      caixa: el,
      sentido: lado,
      ir: () => (lado === "anterior" ? v.goLeft() : v.goRight()),
      avisos: r,
      espalhado: (r.heads?.length ?? 1) > 1,
      escuro: TEMAS[aparenciaRef.current.tema].escuro,
      // O paginador tem uma página em branco em cada ponta do capítulo: passar dela abre outro capítulo
      outroCapitulo: avancando ? pagina >= total - 2 : pagina <= 1,
      capitulo: v.lastLocation?.section?.current,
    }
  }, [])

  const virar = React.useCallback(
    (lado: Sentido) => {
      const v = visao.current
      if (!v) return
      setBarras(false)
      if (folhaLigada(aparenciaRef.current)) {
        void virarFolha(() => montarFolha(lado))
        return
      }
      void (lado === "anterior" ? v.goLeft() : v.goRight())
    },
    [montarFolha],
  )

  /** O dedo começou a virar a página: a folha acompanha (null quando ela só vira ao soltar). */
  const arrastarVirada = React.useCallback(
    (lado: Sentido, x: number): ArrastoFolha | null => {
      const v = visao.current
      const o = montarFolha(lado)
      if (!v || !o) return null
      const arrasto = arrastarFolha({ ...o, xInicial: x, voltar: () => (lado === "anterior" ? v.goRight() : v.goLeft()) })
      if (arrasto) setBarras(false)
      return arrasto
    },
    [montarFolha],
  )

  /* Abre o livro --------------------------------------------------- */
  React.useEffect(() => {
    let cancelado = false
    const eventos = new AbortController()
    const esperas = new Set<ReturnType<typeof setTimeout>>()
    let v: VisaoFoliate | null = null

    const aoTocar = (e: MouseEvent, doc?: Document) => {
      if (e.defaultPrevented || painelRef.current) return
      const selecao = (doc ?? document).getSelection()
      if (selecao && !selecao.isCollapsed) return
      const quadro = doc?.defaultView?.frameElement as HTMLElement | null | undefined
      const x = (quadro?.getBoundingClientRect().left ?? 0) + e.clientX
      const largura = window.innerWidth
      if (x < largura * 0.28) virar("anterior")
      else if (x > largura * 0.72) virar("proxima")
      else setBarras((b) => !b)
    }

    // Com o efeito de folha, o deslizar do dedo é do app (o paginador não arrasta o texto): a folha acompanha o dedo
    const deslize = criarDeslize({
      ativo: () => folhaLigada(aparenciaRef.current) && !painelRef.current,
      arrastar: arrastarVirada,
      virar,
    })
    const ouvirDeslize = (alvo: Document | HTMLElement, doc?: Document, vale: (e: Event) => boolean = () => true) => {
      const opcoes = { passive: false, signal: eventos.signal }
      const selecao = () => {
        const s = (doc ?? document).getSelection()
        return Boolean(s && !s.isCollapsed)
      }
      alvo.addEventListener("touchstart", (e) => vale(e) && deslize.inicio(e as TouchEvent, selecao), opcoes)
      alvo.addEventListener("touchmove", (e) => vale(e) && deslize.mover(e as TouchEvent), opcoes)
      alvo.addEventListener("touchend", (e) => vale(e) && deslize.fim(e as TouchEvent), opcoes)
      alvo.addEventListener("touchcancel", (e) => vale(e) && deslize.cancelar(), opcoes)
    }

    let ultimaRoda = 0
    const aoRolar = (e: WheelEvent) => {
      if (aparenciaRef.current.modo === "rolagem" || painelRef.current) return
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || Math.abs(e.deltaY) < 8) return
      const agora = Date.now()
      if (agora - ultimaRoda < 350) return
      ultimaRoda = agora
      virar(e.deltaY > 0 ? "proxima" : "anterior")
    }

    const aoTeclar = (e: KeyboardEvent) => {
      if (ehCampo(e.target)) return
      if (e.key === "Escape") {
        if (painelRef.current) setPainel(null)
        else setBarras((b) => !b)
        return
      }
      if (painelRef.current) return
      const rolagem = aparenciaRef.current.modo === "rolagem"
      if (e.key === "ArrowLeft") virar("anterior")
      else if (e.key === "ArrowRight") virar("proxima")
      else if (e.key === "PageUp" || (!rolagem && e.key === "ArrowUp")) {
        e.preventDefault()
        virar("anterior")
      } else if (e.key === "PageDown" || e.key === " " || (!rolagem && e.key === "ArrowDown")) {
        e.preventDefault()
        virar("proxima")
      }
    }

    const abrir = async () => {
      try {
        await carregarFoliate()
        if (cancelado || !caixa.current) return
        v = document.createElement("foliate-view") as VisaoFoliate
        v.style.display = "block"
        v.style.width = "100%"
        v.style.height = "100%"
        caixa.current.append(v)
        visao.current = v
        await v.open(arquivo)
        if (cancelado) { v.close(); v.remove(); return }
        protegerLivro(v.book)
        aplicarAparencia(v, aparenciaRef.current)
        setSumario(v.book.toc ?? [])
        setTituloDoArquivo(textoDoMetadado(v.book.metadata?.title))
        setPaginas(v.book.pageList ?? [])

        v.addEventListener("relocate", (e) => {
          const detalhe = (e as CustomEvent<Localizacao>).detail
          atividade.current?.()
          setLugar(detalhe)
          escreverMargens(v!, detalhe, paginasTotaisRef.current)
          aoMudarLugarRef.current({ localizacao: detalhe, paginasTotais: paginasTotaisRef.current })
        })
        // Virar a página com o dedo (ou rolar) esconde as barras; abrir, redimensionar ou só tocar não
        let ultimoCfi: string | undefined
        v.renderer.addEventListener("relocate", (e) => {
          const motivo = (e as CustomEvent<{ reason?: string }>).detail?.reason
          const cfi = v?.lastLocation?.cfi
          if ((motivo === "snap" || motivo === "page" || motivo === "scroll") && cfi && ultimoCfi && cfi !== ultimoCfi) setBarras(false)
          ultimoCfi = cfi
        })
        v.addEventListener("load", (e) => {
          const { doc } = (e as CustomEvent<{ doc: Document; index: number }>).detail
          docAtual.current = doc
          setTrecho(null)
          doc.addEventListener("click", (ev) => aoTocar(ev, doc), { signal: eventos.signal })
          doc.addEventListener("keydown", aoTeclar, { signal: eventos.signal })
          doc.addEventListener("wheel", aoRolar, { passive: true, signal: eventos.signal })
          ouvirDeslize(doc, doc)
          // Texto selecionado: oferece guardar o trecho
          let espera: ReturnType<typeof setTimeout> | undefined
          doc.addEventListener("selectionchange", () => {
            clearTimeout(espera)
            if (espera) esperas.delete(espera)
            espera = setTimeout(() => {
              if (espera) esperas.delete(espera)
              if (cancelado) return
              const t = doc.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? ""
              setTrecho(t.length >= 3 ? t : null)
            }, 350)
            esperas.add(espera)
          }, { signal: eventos.signal })
        })
        // Nas margens o toque cai na caixa do livro, fora do texto; enquanto a folha vira (a caixa vira uma
        // imagem), cai na própria tela do leitor. As barras e os painéis ficam de fora
        const fundo = tela.current
        if (fundo) {
          const doLivro = (e: Event) => e.target === fundo || Boolean(caixa.current?.contains(e.target as Node))
          fundo.addEventListener("click", (e) => doLivro(e) && aoTocar(e), { signal: eventos.signal })
          fundo.addEventListener("wheel", (e) => doLivro(e) && aoRolar(e), { passive: true, signal: eventos.signal })
          ouvirDeslize(fundo, undefined, doLivro)
        }

        await v.init({ lastLocation: posicaoInicial, showTextStart: false })
        if (!cancelado) setPronto(true)
        else { v.close(); v.remove() }
      } catch (e) {
        console.error(e)
        if (!cancelado)
          setErro(e instanceof Error && e.name === "UnsupportedTypeError" ? "Formato de arquivo não suportado." : "Não foi possível abrir este livro.")
      }
    }

    window.addEventListener("keydown", aoTeclar)
    void abrir()
    return () => {
      cancelado = true
      deslize.cancelar()
      pararFolha()
      eventos.abort()
      for (const espera of esperas) clearTimeout(espera)
      esperas.clear()
      docAtual.current = null
      window.removeEventListener("keydown", aoTeclar)
      try {
        v?.close()
      } catch {
        // já fechado
      }
      v?.remove()
      visao.current = null
    }
    // A posição inicial só vale na abertura; mudar depois não reabre o livro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo, virar, arrastarVirada])

  // As barras aparecem ao abrir, para mostrar onde ficam os controles, e somem sozinhas
  React.useEffect(() => {
    if (!pronto) return
    const t = setTimeout(() => {
      if (!painelRef.current) setBarras(false)
    }, 2500)
    return () => clearTimeout(t)
  }, [pronto])

  /* Aparência ------------------------------------------------------- */
  React.useEffect(() => {
    if (visao.current?.renderer) aplicarAparencia(visao.current, aparencia)
  }, [aparencia])

  // Tela acesa enquanto a pessoa lê. Solta depois de 10 minutos sem virar a página
  // (para não gastar bateria se ela dormir lendo) e volta na próxima página virada.
  React.useEffect(() => {
    if (!pronto || !aparencia.telaAcesa || !("wakeLock" in navigator)) return
    let trava: WakeLockSentinel | null = null
    let pedindo = false
    let prazo: ReturnType<typeof setTimeout> | undefined
    const soltar = () => {
      void trava?.release().catch(() => {})
      trava = null
    }
    const pedir = async () => {
      if (trava || pedindo || document.visibilityState !== "visible") return
      pedindo = true
      try {
        trava = await navigator.wakeLock.request("screen")
        trava.addEventListener("release", () => {
          trava = null
        })
      } catch {
        // sem permissão ou sem suporte: a tela apaga como de costume
      } finally {
        pedindo = false
      }
    }
    const renovar = () => {
      void pedir()
      clearTimeout(prazo)
      prazo = setTimeout(soltar, 10 * 60_000)
    }
    atividade.current = renovar
    renovar()
    // O sistema solta a trava quando o app vai para segundo plano; ao voltar, pede de novo
    const aoVoltar = () => {
      if (document.visibilityState === "visible") renovar()
    }
    document.addEventListener("visibilitychange", aoVoltar)
    return () => {
      atividade.current = null
      clearTimeout(prazo)
      document.removeEventListener("visibilitychange", aoVoltar)
      soltar()
    }
  }, [pronto, aparencia.telaAcesa])

  // Cor da barra do sistema (celular) igual ao fundo do livro
  React.useEffect(() => {
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
    const antes = metas.map((m) => m.content)
    metas.forEach((m) => (m.content = tema.fundo))
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    return () => {
      metas.forEach((m, i) => (m.content = antes[i]))
      document.documentElement.style.overflow = overflow
    }
  }, [tema.fundo])

  // Capítulo curtinho em duas páginas: o livro pode contar a fração como NaN
  const fracao = arrastando !== null ? arrastando / 1000 : Number.isFinite(lugar?.fraction) ? (lugar?.fraction ?? 0) : 0
  const capitulo = lugar?.tocItem?.label?.trim()
  const pagina = lugar?.pageItem?.label

  const confirmarArraste = () => {
    if (arrastando === null) return
    void visao.current?.goToFraction(arrastando / 1000)
    setArrastando(null)
  }

  const corBarra = { background: "var(--l-painel)", color: "var(--l-texto)", borderColor: "var(--l-borda)" }
  const variaveis = {
    "--l-fundo": tema.fundo,
    "--l-texto": tema.texto,
    "--l-suave": tema.suave,
    "--l-link": tema.link,
    "--l-painel": `color-mix(in srgb, ${tema.fundo} 93%, ${tema.escuro ? "#ffffff" : "#000000"})`,
    "--l-borda": `color-mix(in srgb, ${tema.texto} 14%, transparent)`,
    "--l-realce": `color-mix(in srgb, ${tema.texto} 9%, transparent)`,
    background: tema.fundo,
    color: tema.texto,
    colorScheme: tema.escuro ? "dark" : "light",
  } as React.CSSProperties

  return (
    <div
      ref={tela}
      className="fixed inset-0 z-40 overflow-hidden overscroll-none"
      style={variaveis}
      // A tela do leitor nunca rola (só o livro e os painéis); algo que force a rolagem volta ao lugar
      onScroll={(e) => {
        if (e.currentTarget.scrollTop || e.currentTarget.scrollLeft) e.currentTarget.scrollTo(0, 0)
      }}
    >
      <style>{`
        foliate-view::part(head), foliate-view::part(foot) {
          font: 500 12px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
          color: ${tema.suave};
          opacity: 1;
          letter-spacing: 0.01em;
        }
      `}</style>
      <div ref={caixa} className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] top-[env(safe-area-inset-top)]" />

      {!pronto && !erro ? (
        <div className="absolute inset-0 grid place-items-center">
          <p className="flex items-center gap-2 text-sm" style={{ color: tema.suave }}>
            <LoaderCircle className="size-4 animate-spin" /> Abrindo o livro…
          </p>
        </div>
      ) : null}
      {erro ? (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div className="grid gap-3">
            <p className="font-medium">{erro}</p>
            <Link href={voltarPara} className="text-sm underline underline-offset-4">
              Voltar
            </Link>
          </div>
        </div>
      ) : null}

      {/* Barra de cima */}
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-10 border-b pt-[env(safe-area-inset-top)] transition-[transform,opacity] duration-200",
          barras || painel ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
        )}
        style={corBarra}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
          <Link href={voltarPara} aria-label="Voltar para o livro" className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-[var(--l-realce)]">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-semibold">{titulo || tituloDoArquivo}</p>
            {capitulo ? <p className="truncate text-xs text-[var(--l-suave)]">{capitulo}</p> : null}
          </div>
          <BotaoBarra rotulo="Buscar no livro" ativo={painel === "busca"} onClick={() => setPainel(painel === "busca" ? null : "busca")}>
            <Search className="size-5" />
          </BotaoBarra>
          <BotaoBarra rotulo="Sumário" ativo={painel === "sumario"} onClick={() => setPainel(painel === "sumario" ? null : "sumario")}>
            <List className="size-5" />
          </BotaoBarra>
          <BotaoBarra rotulo="Aparência do texto" ativo={painel === "ajustes"} onClick={() => setPainel(painel === "ajustes" ? null : "ajustes")}>
            <Type className="size-5" />
          </BotaoBarra>
        </div>
      </header>

      {/* Barra de baixo */}
      <footer
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-[transform,opacity] duration-200",
          barras && !painel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        )}
        style={corBarra}
      >
        <div className="mx-auto grid max-w-3xl gap-1 px-4 pt-3">
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(fracao * 1000)}
            aria-label="Posição no livro"
            onChange={(e) => setArrastando(Number(e.target.value))}
            onPointerUp={confirmarArraste}
            onTouchEnd={confirmarArraste}
            onKeyUp={confirmarArraste}
            onBlur={confirmarArraste}
            className="h-6 w-full cursor-pointer"
            style={{ accentColor: tema.link }}
          />
          <div className="tabular flex items-center justify-between gap-3 text-xs text-[var(--l-suave)]">
            <span>{pagina ? `Página ${pagina}${paginasTotais ? ` de ${paginasTotais}` : ""}` : capitulo ? "" : " "}</span>
            <span>
              {arrastando === null && lugar?.time?.section !== undefined && lugar.time.section > 0.5
                ? `${minutos(lugar.time.section)} até o fim do capítulo · `
                : ""}
              {Math.round(fracao * 100)}%
            </span>
          </div>
        </div>
      </footer>

      {trecho && aoGuardarTrecho && !painel ? (
        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-10 flex justify-center px-4">
          <button
            type="button"
            onClick={() => {
              aoGuardarTrecho(trecho)
              docAtual.current?.getSelection()?.removeAllRanges()
              setTrecho(null)
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-lg"
            style={{ background: "var(--l-painel)", borderColor: "var(--l-borda)" }}
          >
            <Quote className="size-4" /> Guardar trecho nos insights
          </button>
        </div>
      ) : null}

      {painel === "ajustes" ? (
        <PainelAjustes aparencia={aparencia} aoMudar={aoMudarAparencia} aoFechar={() => setPainel(null)} />
      ) : painel === "sumario" ? (
        <PainelSumario
          itens={sumario}
          atual={lugar?.tocItem?.href ?? null}
          paginas={paginas}
          paginaAtual={pagina ?? null}
          aoIr={(href) => {
            irPara(href)
            setPainel(null)
          }}
          aoFechar={() => setPainel(null)}
        />
      ) : painel === "busca" ? (
        <PainelBusca
          visao={visao}
          cor={tema.link}
          aoIr={(cfi) => {
            irPara(cfi)
            setPainel(null)
            setBarras(false)
          }}
          aoFechar={() => setPainel(null)}
        />
      ) : null}
    </div>
  )
}

function BotaoBarra({ rotulo, ativo, onClick, children }: { rotulo: string; ativo?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-pressed={ativo}
      title={rotulo}
      onClick={onClick}
      className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--l-realce)]", ativo && "bg-[var(--l-realce)]")}
    >
      {children}
    </button>
  )
}

function aplicarAparencia(v: VisaoFoliate, a: Aparencia) {
  const r = v.renderer
  if (!r) return
  r.setAttribute("flow", a.modo === "rolagem" ? "scrolled" : "paginated")
  r.setAttribute("gap", MARGENS[a.margem].gap)
  r.setAttribute("margin", "44px")
  r.setAttribute("max-inline-size", "680px")
  r.setAttribute("max-column-count", "2")
  // Folha: o app vira a página (e trata o deslizar). Sem suporte no navegador, a folha vira um deslizar.
  const folha = folhaLigada(a)
  const deslizar = !movimentoReduzido() && (a.virada === "deslizar" || (a.virada === "folha" && !folha))
  if (deslizar) r.setAttribute("animated", "")
  else r.removeAttribute("animated")
  if (folha) r.setAttribute("sem-arrastar", "")
  else r.removeAttribute("sem-arrastar")
  r.setStyles?.(cssDoLivro(a))
}

/** Capítulo no alto da página e o número da página do livro embaixo (só no modo de páginas). */
function escreverMargens(v: VisaoFoliate, l: Localizacao, paginasTotais: number | null) {
  const r = v.renderer
  const cabeca = r.heads?.at(-1)
  const pe = r.feet?.at(-1)
  if (cabeca) cabeca.textContent = l.tocItem?.label?.trim() ?? ""
  if (r.heads && r.heads.length > 1) r.heads[0].textContent = ""
  if (pe) {
    const pagina = l.pageItem?.label
    pe.textContent = pagina ? `${pagina}${paginasTotais ? ` de ${paginasTotais}` : ""}` : `${Math.round(l.fraction * 100)}%`
  }
  if (r.feet && r.feet.length > 1) r.feet[0].textContent = ""
}
