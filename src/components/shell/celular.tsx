"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, BrainCircuit, Ellipsis, ListTodo, Search, Sun } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"
import { EXTRAS, GRUPOS, ativo, grupoDaRota } from "@/lib/navegacao"
import type { Area } from "@/lib/areas"
import { Janela } from "@/components/ui/janela"
import { BotaoNovo } from "./novo"
import { abrirBusca } from "./busca"
import { MenuUsuario } from "./barra-lateral"

const corArea: Record<Area, string> = {
  rotina: "text-rotina",
  projetos: "text-projetos",
  estudos: "text-estudos",
  conteudo: "text-conteudo",
  geral: "text-ink",
}

export function TopoCelular() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <Link href="/" aria-label="My Life, ir para Hoje" className="flex h-11 items-center font-assinatura pt-1.5 text-[2rem] leading-none text-pen">
        My life
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={abrirBusca}
          aria-label="Buscar"
          className="grid size-11 place-items-center rounded-md text-ink-2 hover:bg-surface-2"
        >
          <Search className="size-5" />
        </button>
        <BotaoNovo compacto className="relative mx-1 size-9 toque:size-9 after:absolute after:-inset-1" />
        <MenuUsuario compacto />
      </div>
    </header>
  )
}

const fundoArea: Record<Area, string> = {
  rotina: "bg-rotina",
  projetos: "bg-projetos",
  estudos: "bg-estudos",
  conteudo: "bg-conteudo",
  geral: "bg-ink",
}

const ABAS = [
  { rotulo: "Hoje", href: "/", icone: Sun, area: "geral" as Area },
  { rotulo: "Rotina", href: "/rotina/tarefas", icone: ListTodo, area: "rotina" as Area },
  { rotulo: "Cérebro", href: "/projetos", icone: BrainCircuit, area: "projetos" as Area },
  { rotulo: "Estudos", href: "/estudos/leitura", icone: BookOpen, area: "estudos" as Area },
]

export function BarraInferior() {
  const pathname = usePathname()
  const [mais, setMais] = React.useState(false)
  const grupo = grupoDaRota(pathname)

  const selecionada = (area: Area, href: string) => {
    if (area === "geral") return pathname === "/"
    return grupo?.area === area || ativo(pathname, href)
  }
  const emMais = !ABAS.some((a) => selecionada(a.area, a.href))

  React.useEffect(() => setMais(false), [pathname])

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {ABAS.map((a) => {
          const sel = selecionada(a.area, a.href)
          return (
            <Link
              key={a.href}
              href={a.href}
              aria-current={sel ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium",
                sel ? corArea[a.area] : "text-ink-3",
              )}
            >
              <a.icone className="size-5" />
              {a.rotulo}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMais(true)}
          className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium", emMais ? "text-ink" : "text-ink-3")}
        >
          <Ellipsis className="size-5" />
          Mais
        </button>
      </nav>

      <Janela aberta={mais} aoMudar={setMais} titulo="Mais áreas">
        <div className="grid gap-5 pb-2">
          {GRUPOS.map((g) => (
            <div key={g.area}>
              <p className="mb-2 text-sm font-medium text-ink-3">{g.rotulo}</p>
              <div className="grid grid-cols-2 gap-2">
                {g.itens.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-medium"
                  >
                    <i.icone className={cn("size-4", corArea[g.area])} />
                    {i.rotulo}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
            {EXTRAS.map((i) => (
              <Link key={i.href} href={i.href} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-medium">
                <i.icone className="size-4 text-ink-3" />
                {i.rotulo}
              </Link>
            ))}
          </div>
        </div>
      </Janela>
    </>
  )
}

/** Abas da área atual, para telas sem barra lateral. */
export function AbasArea() {
  const pathname = usePathname()
  const grupo = grupoDaRota(pathname)
  const faixa = React.useRef<HTMLDivElement>(null)
  // A aba da tela atual pode ficar fora da vista (ex.: "Pessoal", a 6ª de 8): a faixa rola até ela.
  // Só a faixa rola (nunca a página), e só quando a aba não está inteira à vista.
  React.useLayoutEffect(() => {
    const caixa = faixa.current
    const aba = caixa?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!caixa || !aba) return
    const c = caixa.getBoundingClientRect()
    const a = aba.getBoundingClientRect()
    if (a.left >= c.left && a.right <= c.right) return
    caixa.scrollLeft += a.left + a.width / 2 - (c.left + c.width / 2)
  }, [pathname])
  if (!grupo) return null
  return (
    <div ref={faixa} className={cn("-mx-4 mb-5 overflow-x-auto border-b border-line px-4 scrollbar-thin lg:hidden", grupo.area === "projetos" && "bg-projetos-soft/25")}>
      <div className="flex gap-1">
        {grupo.itens.map((i) => {
          const sel = ativo(pathname, i.href)
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={sel ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors",
                grupo.area === "projetos" && "my-1 h-10 rounded-lg",
                sel ? (grupo.area === "projetos" ? "bg-projetos-soft text-projetos" : "text-ink") : "text-ink-3 hover:text-ink-2",
              )}
            >
              {grupo.area === "projetos" && sel ? <i.icone className="size-3.5 shrink-0" aria-hidden /> : null}
              {i.rotulo}
              {sel && grupo.area !== "projetos" ? <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full", fundoArea[grupo.area])} /> : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
