"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, BrainCircuit, Ellipsis, ListTodo, Search, Sun } from "lucide-react"
import * as React from "react"
import { EXTRAS, GRUPOS, ativo, grupoDaRota } from "@/lib/navegacao"
import type { Area } from "@/lib/areas"
import { Janela } from "@/components/ui/janela"
import { BotaoNovo } from "./novo"
import { abrirBusca } from "./busca"
import { MenuUsuario } from "./barra-lateral"

/** O topo no celular: a cabine de vidro escuro com a assinatura acesa (estilos no bloco "A cabine" do globals.css). */
export function TopoCelular() {
  return (
    <header className="cabine cabine-topo sticky top-0 z-30 flex h-14 items-center gap-2 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
      <Link href="/" aria-label="My Life, ir para Hoje" className="cabine-assinatura flex h-11 items-center font-assinatura pt-1.5 text-[2rem] leading-none">
        My life
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={abrirBusca}
          aria-label="Buscar"
          className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <Search className="size-5" />
        </button>
        <BotaoNovo compacto className="relative mx-1 size-9 toque:size-9 after:absolute after:-inset-1" />
        <MenuUsuario compacto />
      </div>
    </header>
  )
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
        className="cabine cabine-base fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {ABAS.map((a) => {
          const sel = selecionada(a.area, a.href)
          return (
            <Link
              key={a.href}
              href={a.href}
              aria-current={sel ? "page" : undefined}
              data-area={a.area}
              className="cabine-tecla flex min-h-14 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium"
            >
              <a.icone className="size-5" />
              {a.rotulo}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMais(true)}
          data-ativo={emMais || undefined}
          className="cabine-tecla flex min-h-14 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium"
        >
          <Ellipsis className="size-5" />
          Mais
        </button>
      </nav>

      <Janela aberta={mais} aoMudar={setMais} titulo="Mais áreas" className="cabine">
        <div className="grid gap-5 pb-2">
          {GRUPOS.map((g) => (
            <div key={g.area} data-area={g.area}>
              <p className="cabine-grupo mb-2 flex items-center gap-2">
                <span aria-hidden className="cabine-ponto" />
                {g.rotulo}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {g.itens.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    aria-current={ativo(pathname, i.href) ? "page" : undefined}
                    className="cabine-ladrilho flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
                  >
                    <i.icone className="size-4 shrink-0" />
                    <span className="truncate">{i.rotulo}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="relative grid grid-cols-2 gap-2 pt-4">
            <span aria-hidden className="cabine-fio absolute inset-x-0 top-0" />
            {EXTRAS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={ativo(pathname, i.href) ? "page" : undefined}
                className="cabine-ladrilho flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
              >
                <i.icone className="size-4 shrink-0" />
                <span className="truncate">{i.rotulo}</span>
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
  // Colada no topo (o -mt-5 desfaz o respiro de cima do <main>), como a segunda linha da cabine
  return (
    <div ref={faixa} data-area={grupo.area} className="cabine cabine-abas -mx-4 -mt-5 mb-5 overflow-x-auto px-1 scrollbar-thin sm:-mx-6 lg:hidden">
      <div className="flex gap-1">
        {grupo.itens.map((i) => {
          const sel = ativo(pathname, i.href)
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={sel ? "page" : undefined}
              className="cabine-aba flex h-11 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium"
            >
              {/* Só a aba aberta leva o ícone, aceso na cor da área */}
              {sel ? <i.icone className="size-3.5 shrink-0 text-[var(--area)] drop-shadow-[0_0_5px_var(--area)]" aria-hidden /> : null}
              {i.rotulo}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
