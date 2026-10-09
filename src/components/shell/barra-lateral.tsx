"use client"

import * as React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LogOut, Monitor, Moon, Search, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { EXTRAS, GRUPOS, HOJE, ativo, grupoDaRota, type ItemNav } from "@/lib/navegacao"
import type { Area } from "@/lib/areas"
import { useSessao, useTema, type Tema } from "@/components/provedores"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from "@/components/ui/menu"
import { BotaoNovo } from "./novo"
import { abrirBusca } from "./busca"

const corTraco: Record<Area, string> = {
  rotina: "bg-rotina",
  projetos: "bg-projetos",
  estudos: "bg-estudos",
  conteudo: "bg-conteudo",
  geral: "bg-ink-3",
}

function LinkNav({ item, area }: { item: ItemNav; area?: Area }) {
  const pathname = usePathname()
  const sel = ativo(pathname, item.href)
  const Icone = item.icone
  return (
    <Link
      href={item.href}
      aria-current={sel ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        sel ? "bg-surface text-ink font-medium shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-ink-2 hover:bg-surface hover:text-ink",
      )}
    >
      {sel && area ? (
        <span aria-hidden className={cn("absolute -left-3 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full", corTraco[area])} />
      ) : null}
      <Icone className={cn("size-4 shrink-0", sel ? "text-ink" : "text-ink-3 group-hover:text-ink-2")} />
      <span className="truncate">{item.rotulo}</span>
    </Link>
  )
}

const CHAVE_FECHADOS = "dml:menu-fechados"

export function BarraLateral() {
  const pathname = usePathname()
  const atual = grupoDaRota(pathname)?.area
  const [fechados, setFechados] = React.useState<string[]>([])

  React.useEffect(() => {
    try {
      setFechados(JSON.parse(localStorage.getItem(CHAVE_FECHADOS) ?? "[]"))
    } catch {}
  }, [])

  const alternar = (area: Area) => {
    const novo = fechados.includes(area) ? fechados.filter((a) => a !== area) : [...fechados, area]
    setFechados(novo)
    try {
      localStorage.setItem(CHAVE_FECHADOS, JSON.stringify(novo))
    } catch {}
  }

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-bg px-3 pb-3 pt-5 lg:flex">
      <div className="mb-5 flex items-center justify-between px-2.5">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          My Life
        </Link>
      </div>

      <div className="mb-4 grid gap-1.5 px-0.5">
        <BotaoNovo />
        <button
          type="button"
          onClick={abrirBusca}
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-3 hover:border-line-strong hover:text-ink-2"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="rounded border border-line px-1.5 text-[11px] font-sans">Ctrl K</kbd>
        </button>
      </div>

      <nav aria-label="Principal" className="-mr-1 flex-1 overflow-y-auto pl-3 pr-1 scrollbar-thin">
        <LinkNav item={HOJE} area="geral" />
        {GRUPOS.map((g) => {
          // O grupo da página atual fica sempre aberto, para o item marcado não sumir
          const aberto = g.area === atual || !fechados.includes(g.area)
          return (
            <div key={g.area} className="mt-5">
              <button
                type="button"
                aria-expanded={aberto}
                disabled={g.area === atual}
                onClick={() => alternar(g.area)}
                className="group mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left text-xs font-medium text-ink-3 enabled:hover:text-ink-2"
              >
                <span aria-hidden className={cn("size-1.5 rounded-full", corTraco[g.area])} />
                <span className="flex-1">{g.rotulo}</span>
                {g.area === atual ? null : (
                  <ChevronRight aria-hidden className={cn("size-3.5 transition-transform", aberto && "rotate-90")} />
                )}
              </button>
              {aberto ? (
                <div className="grid gap-0.5">
                  {g.itens.map((i) => (
                    <LinkNav key={i.href} item={i} area={g.area} />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
        <div className="mt-5 grid gap-0.5 border-t border-line pt-4">
          {EXTRAS.map((i) => (
            <LinkNav key={i.href} item={i} area="geral" />
          ))}
        </div>
      </nav>

      <MenuUsuario />
    </aside>
  )
}

const temas: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "sistema", rotulo: "Igual ao sistema", icone: Monitor },
]

export function MenuUsuario({ compacto }: { compacto?: boolean }) {
  const { usuario, sair } = useSessao()
  const { tema, mudarTema } = useTema()
  // A sessão só existe no navegador; antes de montar, servidor e cliente mostram o mesmo vazio
  const montado = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const email = montado ? (usuario?.email ?? "") : ""
  const inicial = (email[0] ?? "").toUpperCase()
  return (
    <Menu>
      <MenuGatilho
        className={cn(
          "mt-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface",
          compacto && "mt-0 size-11 justify-center p-0",
        )}
        aria-label="Conta e tema"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-pen-soft font-display text-sm font-semibold text-pen">
          {inicial}
        </span>
        {compacto ? null : <span className="min-w-0 flex-1 truncate text-ink-2">{email || "Conta"}</span>}
      </MenuGatilho>
      <MenuConteudo align={compacto ? "end" : "start"} side={compacto ? "bottom" : "top"}>
        <MenuRotulo>Tema</MenuRotulo>
        {temas.map((t) => (
          <MenuItem key={t.valor} onSelect={() => mudarTema(t.valor)}>
            <t.icone />
            <span className="flex-1">{t.rotulo}</span>
            {tema === t.valor ? <span className="size-1.5 rounded-full bg-pen" /> : null}
          </MenuItem>
        ))}
        <MenuSeparador />
        <MenuItem onSelect={() => sair()}>
          <LogOut />
          Sair
        </MenuItem>
      </MenuConteudo>
    </Menu>
  )
}
