"use client"

import * as React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { EXTRAS, GRUPOS, HOJE, ativo, grupoDaRota, type ItemNav } from "@/lib/navegacao"
import type { Area } from "@/lib/areas"
import { CHAVE_MENU_RECOLHIDO, useSessao, useTema, type Tema } from "@/components/provedores"
import { LinkIntencao } from "@/components/ui/link-intencao"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from "@/components/ui/menu"
import { BotaoNovo } from "./novo"
import { abrirBusca } from "./busca"

/** Item do menu. Na página aberta, acende com a luz da área (as cores ficam no bloco "A cabine" do globals.css). */
function LinkNav({ item, area }: { item: ItemNav; area?: Area }) {
  const pathname = usePathname()
  const sel = ativo(pathname, item.href)
  const Icone = item.icone
  return (
    <LinkIntencao
      href={item.href}
      title={item.rotulo}
      aria-current={sel ? "page" : undefined}
      data-area={area}
      className="cabine-item flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm recolhido:justify-center recolhido:px-0 recolhido:py-2.5"
    >
      <Icone className="size-4 shrink-0" />
      <span className="truncate recolhido:hidden">{item.rotulo}</span>
    </LinkIntencao>
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

  // A largura vem de um atributo no <html>, posto antes da pintura; o estado só acompanha para o rótulo do botão
  const [recolhida, setRecolhida] = React.useState(false)

  React.useEffect(() => {
    setRecolhida(document.documentElement.dataset.menu === "recolhido")
  }, [])

  const alternarMenu = React.useCallback(() => {
    const html = document.documentElement
    const novo = html.dataset.menu !== "recolhido"
    if (novo) html.dataset.menu = "recolhido"
    else delete html.dataset.menu
    setRecolhida(novo)
    try {
      localStorage.setItem(CHAVE_MENU_RECOLHIDO, novo ? "1" : "0")
    } catch {}
  }, [])

  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "b") return
      // Em campos de texto o Ctrl+B pertence ao campo; em telas sem barra lateral não há o que recolher
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest("input, textarea, select, [contenteditable=true]")) return
      if (!matchMedia("(min-width: 64rem)").matches) return
      e.preventDefault()
      alternarMenu()
    }
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [alternarMenu])

  // O item da página aberta fica à vista: com a lista mais alta que a tela (Conteúdo e IA, Vida pessoal), ela
  // rola até ele, sem mexer na página
  const nav = React.useRef<HTMLElement>(null)
  React.useEffect(() => {
    const lista = nav.current
    const item = lista?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!lista || !item) return
    const l = lista.getBoundingClientRect()
    const i = item.getBoundingClientRect()
    if (i.top < l.top || i.bottom > l.bottom - 24) lista.scrollTop += i.top - l.top - l.height / 2 + i.height / 2
  }, [pathname])

  const alternar = (area: Area) => {
    const novo = fechados.includes(area) ? fechados.filter((a) => a !== area) : [...fechados, area]
    setFechados(novo)
    try {
      localStorage.setItem(CHAVE_FECHADOS, JSON.stringify(novo))
    } catch {}
  }

  return (
    <aside className="cabine cabine-lateral sticky top-0 hidden h-dvh w-60 shrink-0 flex-col px-3 pb-3 pt-4 transition-[width] duration-150 recolhido:w-16 recolhido:px-2 lg:flex">
      <div className="mb-4 flex h-11 items-center justify-between pl-2.5 recolhido:justify-center recolhido:pl-0">
        {/* A mesma assinatura da capa do painel, acesa */}
        <Link href="/" aria-label="My Life, ir para Hoje" className="cabine-assinatura font-assinatura pt-1.5 text-[2.15rem] leading-none recolhido:hidden">
          My life
        </Link>
        <button
          type="button"
          onClick={alternarMenu}
          aria-expanded={!recolhida}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          <PanelLeftClose className="size-4 recolhido:hidden" />
          <PanelLeftOpen className="hidden size-4 recolhido:block" />
        </button>
      </div>

      <div className="mb-4 grid gap-2 px-0.5">
        <BotaoNovo />
        <button
          type="button"
          onClick={abrirBusca}
          aria-label="Buscar"
          title="Buscar (Ctrl+K)"
          className="cabine-vidro flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm recolhido:justify-center recolhido:px-0"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left recolhido:hidden">Buscar</span>
          <kbd className="rounded-md border border-[var(--b-borda)] bg-black/25 px-1.5 font-sans text-[10px] tracking-wider recolhido:hidden">Ctrl K</kbd>
        </button>
      </div>

      {/* A lista some aos poucos embaixo: sinal de que ela rola */}
      <nav ref={nav} aria-label="Principal" className="-mr-1 flex-1 overflow-y-auto pb-5 pl-3 pr-1 scrollbar-thin [mask-image:linear-gradient(to_bottom,#000_calc(100%-1.5rem),transparent)] recolhido:mr-0 recolhido:px-0.5 recolhido:[scrollbar-width:none]">
        <LinkNav item={HOJE} area="geral" />
        {GRUPOS.map((g) => {
          // O grupo da página atual fica sempre aberto, para o item marcado não sumir
          const aberto = g.area === atual || !fechados.includes(g.area)
          return (
            <div key={g.area} data-area={g.area} className="mt-5 recolhido:mt-3 recolhido:border-t recolhido:border-line recolhido:pt-2">
              <button
                type="button"
                title={g.rotulo}
                aria-expanded={aberto}
                disabled={g.area === atual}
                onClick={() => alternar(g.area)}
                className="cabine-grupo group mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left enabled:hover:text-ink-2 recolhido:justify-center recolhido:px-0 recolhido:py-2"
              >
                <span aria-hidden className="cabine-ponto" />
                <span className="shrink-0 recolhido:hidden">{g.rotulo}</span>
                <span aria-hidden className="cabine-fio min-w-3 flex-1 recolhido:hidden" />
                {g.area === atual ? null : (
                  <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 transition-transform recolhido:hidden", aberto && "rotate-90")} />
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
        <div className="relative mt-5 grid gap-0.5 pt-4">
          <span aria-hidden className="cabine-fio absolute inset-x-0 top-0" />
          {EXTRAS.map((i) => (
            <LinkNav key={i.href} item={i} area="geral" />
          ))}
        </div>
      </nav>

      <span aria-hidden className="cabine-fio mx-1 mt-1" />
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
          "mt-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.06] recolhido:justify-center recolhido:px-0",
          compacto && "mt-0 size-11 justify-center rounded-full p-0",
        )}
        aria-label="Conta e tema"
      >
        <span className="cabine-avatar grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-semibold">
          {inicial}
        </span>
        {compacto ? null : <span className="min-w-0 flex-1 truncate text-ink-2 recolhido:hidden">{email || "Conta"}</span>}
      </MenuGatilho>
      <MenuConteudo align={compacto ? "end" : "start"} side={compacto ? "bottom" : "top"} className="cabine">
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
