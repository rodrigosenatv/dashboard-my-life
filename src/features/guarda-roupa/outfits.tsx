"use client"

import * as React from "react"
import { CalendarCheck, Check, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { cn } from "@/lib/utils"
import { useGravarGuardaRoupa } from "./dados"
import {
  CLIMAS,
  HORAS,
  LUGARES,
  alternarUsoHoje,
  contarPorTipo,
  filtrarPorTipo,
  metaDoOutfit,
  nomePadraoOutfit,
  opcoesCom,
  ordenarPecas,
  propsDoOutfit,
  rotuloDoOutfit,
  usoDoOutfit,
  type Outfit,
  type Peca,
} from "./logica"
import { ColagemOutfit, Dado, EscolhaVarias, FiltroChips, FotoPeca } from "./ui"

/** Um cartão da grade de outfits: a colagem das peças, o nome e, embaixo, lugar e uso. */
export function CartaoOutfit({ outfit: o, aoAbrir, hoje }: { outfit: Outfit; aoAbrir: (o: Outfit) => void; hoje: string }) {
  const meta = metaDoOutfit(o)
  return (
    <li>
      <button
        type="button"
        aria-label={rotuloDoOutfit(o, hoje)}
        onClick={() => aoAbrir(o)}
        className="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/50"
      >
        <ColagemOutfit pecas={o.pecas} className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.02]" />
        <span aria-hidden className="mt-2 block">
          <span className="line-clamp-2 block text-sm font-medium leading-snug text-ink">{o.nome}</span>
          {meta ? <span className="mt-0.5 block truncate text-xs text-ink-3">{meta}</span> : null}
          <span className="mt-0.5 block truncate text-xs text-ink-3">{usoDoOutfit(o, hoje)}</span>
        </span>
      </button>
    </li>
  )
}

/** Um outfit: as peças em grade, os dados e o registro de uso ("Usei hoje" marca ou desmarca o dia de hoje). */
export function JanelaOutfit({
  outfit: o,
  aberta,
  aoMudar,
  aoEditar,
  hoje,
}: {
  outfit: Outfit | null
  aberta: boolean
  aoMudar: (v: boolean) => void
  aoEditar: (o: Outfit) => void
  hoje: string
}) {
  const gravar = useGravarGuardaRoupa()
  if (!o) return null

  const usadoHoje = o.usos.includes(hoje)

  // Excluir fecha a janela e avisa; "Desfazer" recria o outfit com o mesmo id e os mesmos dados
  const excluir = () => {
    const item = o.item
    aoMudar(false)
    void gravar.excluir([item])
    toast.success("Outfit excluído", {
      action: {
        label: "Desfazer",
        onClick: () =>
          void gravar
            .criar("outfits", {
              id: item.id,
              title: item.title,
              props: (item.props ?? {}) as Record<string, Json>,
              content: item.content,
              position: item.position,
            })
            .catch(() => undefined),
      },
    })
  }

  const alternarHoje = () => void gravar.mudar(o.item, (atual) => ({ props: alternarUsoHoje((atual.props ?? {}) as Record<string, Json>, hoje) }), "outfits")

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={o.nome}
      largura="lg"
      rodape={
        <>
          <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={excluir}>
            <Trash2 /> Excluir
          </Botao>
          <Botao variante="contorno" onClick={() => aoEditar(o)}>
            <Pencil /> Editar
          </Botao>
          <Botao variante="primario" aria-pressed={usadoHoje} onClick={alternarHoje}>
            {usadoHoje ? (
              <>
                <Check /> Usado hoje
              </>
            ) : (
              <>
                <CalendarCheck /> Usei hoje
              </>
            )}
          </Botao>
        </>
      }
    >
      <div className="grid gap-5">
        {o.pecas.length ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {o.pecas.map((p) => (
              <li key={p.id} className="grid min-w-0 gap-1.5">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
                  <FotoPeca peca={p} className="absolute inset-0" />
                  {!p.comprado ? (
                    <span aria-hidden className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      Desejo
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 text-xs text-ink">{p.nome}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">Nenhuma peça neste outfit. Toque em Editar para escolher.</p>
        )}

        {o.lugares.length || o.horas.length || o.climas.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {o.lugares.length ? <Dado rotulo="Lugar">{o.lugares.join(", ")}</Dado> : null}
            {o.horas.length ? <Dado rotulo="Hora">{o.horas.join(", ")}</Dado> : null}
            {o.climas.length ? <Dado rotulo="Clima">{o.climas.join(", ")}</Dado> : null}
          </dl>
        ) : null}

        <p className="text-sm text-ink-2">{o.usos.length ? usoDoOutfit(o, hoje) : "Ainda não usado."}</p>
      </div>
    </Janela>
  )
}

/**
 * Montar ou editar um outfit: o nome, as peças (com desejos, para planejar a compra) e lugar, hora e clima.
 * Sem peça escolhida, não salva.
 */
export function JanelaMontarOutfit({
  aberta,
  aoMudar,
  outfit,
  pecas,
  outfits,
  aoAdicionarPeca,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  outfit?: Outfit
  pecas: Peca[]
  outfits: Outfit[]
  aoAdicionarPeca: () => void
}) {
  const gravar = useGravarGuardaRoupa()
  const [nome, setNome] = React.useState("")
  const [escolhidas, setEscolhidas] = React.useState<string[]>([])
  const [filtro, setFiltro] = React.useState<string | null>(null)
  const [lugares, setLugares] = React.useState<string[]>([])
  const [horas, setHoras] = React.useState<string[]>([])
  const [climas, setClimas] = React.useState<string[]>([])
  const [erro, setErro] = React.useState<string | null>(null)

  // Ao abrir (ou trocar de outfit), começa do que está gravado; em branco, para um outfit novo
  React.useEffect(() => {
    if (!aberta) return
    setNome(outfit?.nome ?? "")
    setEscolhidas(outfit?.pecas.map((p) => p.id) ?? [])
    setFiltro(null)
    setLugares(outfit?.lugares ?? [])
    setHoras(outfit?.horas ?? [])
    setClimas(outfit?.climas ?? [])
    setErro(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, outfit?.id])

  // Primeiro as peças compradas, depois os desejos; cada grupo por nome
  const ordenadas = ordenarPecas(pecas, "nome", [])
  const lista = [...ordenadas.filter((p) => p.comprado), ...ordenadas.filter((p) => !p.comprado)]
  const contagem = contarPorTipo(pecas)
  const tipoAtual = filtro !== null && contagem.some((c) => c.tipo === filtro) ? filtro : null
  const visiveis = filtrarPorTipo(lista, tipoAtual)

  const alternar = (id: string) => {
    setErro(null)
    setEscolhidas((atuais) => (atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]))
  }

  // O aviso de "escolha uma peça" fica logo abaixo do título "Peças"; se a pessoa salvou lá embaixo, a janela rola até ele
  const refErro = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (erro) refErro.current?.scrollIntoView({ block: "nearest" })
  }, [erro])

  const n = escolhidas.length
  const textoEscolhidas = n === 0 ? "Nenhuma peça escolhida" : n === 1 ? "1 peça escolhida" : `${n} peças escolhidas`
  const idForm = "form-outfit"

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const selecionadas = escolhidas.map((id) => pecas.find((p) => p.id === id)).filter((p): p is Peca => p !== undefined)
    if (selecionadas.length === 0) return setErro("Escolha pelo menos uma peça.")
    setErro(null)

    const titulo = nome.trim() || nomePadraoOutfit(outfits)
    const campos = { pecas: selecionadas, lugares, horas, climas }
    if (outfit) {
      void gravar.mudar(outfit.item, (atual) => ({ title: titulo, props: propsDoOutfit((atual.props ?? null) as Record<string, Json> | null, campos) }), "outfits")
      toast.success("Alterações salvas")
    } else {
      void gravar
        .criar("outfits", { title: titulo, props: propsDoOutfit(null, campos), position: Date.now() })
        .catch(() => undefined)
      toast.success(`Outfit “${titulo}” salvo`)
    }
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={outfit ? "Editar outfit" : "Montar outfit"}
      largura="lg"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm}>
            Salvar outfit
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-5" noValidate>
        <Campo rotulo="Nome" htmlFor="outfit-nome">
          <Entrada
            id="outfit-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={nomePadraoOutfit(outfits)}
            autoComplete="off"
            enterKeyHint="done"
          />
        </Campo>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-ink-2">Peças</span>
            <span aria-live="polite" className="text-sm text-ink-3">
              {textoEscolhidas}
            </span>
          </div>
          {erro ? (
            <p ref={refErro} role="alert" className="text-sm text-danger">
              {erro}
            </p>
          ) : null}
          {pecas.length ? (
            <>
              <FiltroChips
                rotulo="Filtrar por tipo"
                todos={{ rotulo: "Todas", n: pecas.length }}
                opcoes={contagem.map((c) => ({ valor: c.tipo, n: c.n }))}
                valor={tipoAtual}
                aoMudar={setFiltro}
              />
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {visiveis.map((p) => {
                  const ativa = escolhidas.includes(p.id)
                  return (
                    <li key={p.id} className="min-w-0">
                      <button
                        type="button"
                        aria-pressed={ativa}
                        aria-label={p.comprado ? p.nome : `${p.nome} (desejo)`}
                        onClick={() => alternar(p.id)}
                        className="group grid w-full gap-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/50"
                      >
                        <span className={cn("relative block aspect-square overflow-hidden rounded-lg bg-surface-2", ativa ? "ring-2 ring-pen" : "ring-1 ring-line")}>
                          <FotoPeca peca={p} className="absolute inset-0" />
                          {!p.comprado ? (
                            <span aria-hidden className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                              Desejo
                            </span>
                          ) : null}
                          {ativa ? (
                            <span aria-hidden className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-pen text-pen-ink">
                              <Check className="size-3" />
                            </span>
                          ) : null}
                        </span>
                        <span aria-hidden className="line-clamp-1 text-xs text-ink">
                          {p.nome}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <div className="grid justify-items-start gap-3 rounded-lg border border-dashed border-line-strong px-4 py-5">
              <p className="text-sm text-ink-2">Cadastre peças ou desejos para montar um outfit.</p>
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  aoMudar(false)
                  aoAdicionarPeca()
                }}
              >
                <Plus /> Adicionar peça
              </Botao>
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Lugar</span>
          <EscolhaVarias rotulo="Lugar" opcoes={opcoesCom(LUGARES, lugares)} valores={lugares} aoMudar={setLugares} />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Hora</span>
          <EscolhaVarias rotulo="Hora" opcoes={opcoesCom(HORAS, horas)} valores={horas} aoMudar={setHoras} />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Clima</span>
          <EscolhaVarias rotulo="Clima" opcoes={opcoesCom(CLIMAS, climas)} valores={climas} aoMudar={setClimas} />
        </div>
      </form>
    </Janela>
  )
}
