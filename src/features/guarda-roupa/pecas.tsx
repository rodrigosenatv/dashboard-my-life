"use client"

import Link from "next/link"
import * as React from "react"
import { ExternalLink, Pencil, ShoppingBag, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { reais } from "@/features/viagens/logica"
import { dominio } from "@/lib/utils"
import { useGravarGuardaRoupa } from "./dados"
import { linkDoItem, marcarComprado, metaDaPeca, outfitsDaPeca, rotuloDaPeca, textoUltimoUso, ultimoUsoDaPeca, type Outfit, type Peca } from "./logica"
import { CorBolinha, Dado, FotoPeca } from "./ui"

/** A grade de peças ou de desejos: duas colunas no celular, até cinco no computador. */
export function GradePecas({ pecas, aoAbrir, desejo }: { pecas: Peca[]; aoAbrir: (p: Peca) => void; desejo: boolean }) {
  return (
    <ul aria-label={desejo ? "Desejos" : "Peças"} className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {pecas.map((p) => (
        <CartaoPeca key={p.id} peca={p} aoAbrir={aoAbrir} />
      ))}
    </ul>
  )
}

/** Um cartão: a foto em destaque e, embaixo, o nome e a linha de preço (desejo) ou de detalhes (peça). */
export function CartaoPeca({ peca, aoAbrir }: { peca: Peca; aoAbrir: (p: Peca) => void }) {
  const meta = metaDaPeca(peca)
  return (
    <li>
      <button
        type="button"
        aria-label={rotuloDaPeca(peca)}
        onClick={() => aoAbrir(peca)}
        className="group block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/50"
      >
        <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line">
          <FotoPeca peca={peca} className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.03]" />
        </span>
        <span aria-hidden className="mt-2 block">
          <span className="line-clamp-2 block text-sm font-medium leading-snug text-ink">{peca.nome}</span>
          {!peca.comprado ? (
            // O preço em destaque; sem preço, discreto. Depois, marca e tamanho em cinza (como em linhaDoDesejo)
            <span className="mt-0.5 block truncate text-sm">
              {peca.valor !== null ? <span className="font-semibold text-ink">{reais(peca.valor)}</span> : <span className="text-ink-3">sem preço</span>}
              {meta ? <span className="text-ink-3">{` · ${meta}`}</span> : null}
            </span>
          ) : meta ? (
            <span className="mt-0.5 block truncate text-xs text-ink-3">{meta}</span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

/** A janela de uma peça ou de um desejo: a foto, os dados e, na peça, os outfits em que ela aparece. */
export function JanelaPeca({
  peca,
  outfits,
  aberta,
  aoMudar,
  aoEditar,
  hoje,
}: {
  peca: Peca | null
  outfits: Outfit[]
  aberta: boolean
  aoMudar: (v: boolean) => void
  aoEditar: (p: Peca) => void
  hoje: string
}) {
  const gravar = useGravarGuardaRoupa()
  if (!peca) return null

  const desejo = !peca.comprado
  const outfitsDela = outfitsDaPeca(peca.id, outfits)
  // Só as linhas que têm valor: a lista some quando a peça não tem nenhum dado para mostrar
  const temDados = peca.tipos.length > 0 || peca.cores.length > 0 || Boolean(peca.tamanho || peca.marca) || (!desejo && (Boolean(peca.conservacao) || peca.valor !== null))

  // Excluir fecha a janela e avisa; "Desfazer" recria a peça com o mesmo id e os mesmos dados
  const excluir = () => {
    const item = peca.item
    aoMudar(false)
    void gravar.excluir([item])
    toast.success(desejo ? "Desejo excluído" : "Peça excluída", {
      action: {
        label: "Desfazer",
        onClick: () =>
          void gravar
            .criar("pecas", {
              id: item.id,
              title: item.title,
              props: (item.props ?? {}) as Record<string, Json>,
              content: item.content,
              cover_path: item.cover_path,
              position: item.position,
            })
            .catch(() => undefined),
      },
    })
  }

  // "Comprei" passa o desejo para as peças; "Desfazer" grava de volta as propriedades de antes do clique
  const comprei = () => {
    const item = peca.item
    const antes = { ...((item.props ?? {}) as Record<string, Json>) }
    aoMudar(false)
    void gravar.mudar(item, (atual) => ({ props: marcarComprado((atual.props ?? {}) as Record<string, Json>) }), "pecas")
    toast.success(`“${peca.nome}” foi para Peças`, {
      action: {
        label: "Desfazer",
        onClick: () => void gravar.mudar(item, () => ({ props: antes }), "pecas"),
      },
    })
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={peca.nome}
      largura="lg"
      rodape={
        <>
          <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={excluir}>
            <Trash2 /> Excluir
          </Botao>
          <Botao variante="contorno" onClick={() => aoEditar(peca)}>
            <Pencil /> Editar
          </Botao>
          {desejo ? (
            <Botao variante="primario" onClick={comprei}>
              <ShoppingBag /> Comprei
            </Botao>
          ) : (
            <Botao variante="secundario" onClick={() => aoMudar(false)}>
              Fechar
            </Botao>
          )}
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
        <div className="relative aspect-[4/5] max-h-[45dvh] w-full overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line sm:max-h-none">
          <FotoPeca peca={peca} contain alt={`Foto de ${peca.nome}`} className="absolute inset-0" />
        </div>

        <div className="grid content-start gap-4">
          {desejo ? (
            <p className="font-display text-2xl font-semibold">{peca.valor !== null ? reais(peca.valor) : "Sem preço"}</p>
          ) : null}

          {temDados ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {peca.tipos.length ? <Dado rotulo="Tipo">{peca.tipos.join(", ")}</Dado> : null}
              {peca.cores.length ? (
                <Dado rotulo="Cor">
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {peca.cores.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1.5">
                        <CorBolinha cor={c} />
                        {c}
                      </span>
                    ))}
                  </span>
                </Dado>
              ) : null}
              {peca.tamanho ? <Dado rotulo="Tamanho">{peca.tamanho}</Dado> : null}
              {peca.marca ? <Dado rotulo="Marca">{peca.marca}</Dado> : null}
              {!desejo && peca.conservacao ? <Dado rotulo="Conservação">{peca.conservacao}</Dado> : null}
              {!desejo && peca.valor !== null ? <Dado rotulo="Valor">{reais(peca.valor)}</Dado> : null}
            </dl>
          ) : null}

          {desejo && peca.site ? (
            <Botao asChild variante="contorno" className="justify-self-start">
              <a href={peca.site} target="_blank" rel="noreferrer">
                <ExternalLink /> Ver na loja <span className="text-ink-3">{dominio(peca.site)}</span>
              </a>
            </Botao>
          ) : null}

          {!desejo ? (
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold text-ink">Outfits</h3>
              {outfitsDela.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {outfitsDela.map((o) => (
                    <li key={o.id} className="rounded-full border border-line px-3 py-1 text-sm text-ink-2">
                      {o.nome}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">Ainda não está em nenhum outfit.</p>
              )}
              <p className="text-sm text-ink-3">{textoUltimoUso(ultimoUsoDaPeca(peca.id, outfits), hoje, "a")}</p>
            </section>
          ) : null}

          {/* No toque, o link ganha 44px de altura para ser fácil de acertar */}
          <Link href={linkDoItem(peca.id)} className="inline-flex items-center justify-self-start text-sm text-pen underline-offset-2 hover:underline toque:min-h-11">
            Abrir página da peça
          </Link>
        </div>
      </div>
    </Janela>
  )
}
