"use client"

import Link from "next/link"
import * as React from "react"
import { Globe, Layers, Quote, Shuffle } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"
import { cn, isoDia, urlValida } from "@/lib/utils"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { fraseDoDia, iniciais } from "./logica"

/** Iniciais num círculo. O nome já está escrito ao lado, então o leitor de tela pula isto. */
export function Iniciais({ nome, className }: { nome: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2", className)}>
      {iniciais(nome)}
    </span>
  )
}

/** A frase do dia (da página Pessoal do Notion), com um botão para ver outra. */
export function FraseDoDia({ frases }: { frases: string[] }) {
  const [deslocamento, setDeslocamento] = React.useState(0)
  const frase = fraseDoDia(frases, isoDia(), deslocamento)
  if (!frase) return null
  return (
    <figure aria-label="Frase do dia" className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
      <Quote aria-hidden className="mt-0.5 size-4 shrink-0 text-pen" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-3">Frase do dia</p>
        <blockquote className="mt-0.5 font-display text-[15px] leading-relaxed text-ink">“{frase}”</blockquote>
      </div>
      {frases.length > 1 ? (
        <Botao variante="fantasma" tamanho="icone-sm" aria-label="Mostrar outra frase" onClick={() => setDeslocamento((d) => d + 1)}>
          <Shuffle />
        </Botao>
      ) : null}
    </figure>
  )
}

/** Os sites favoritos da tela Links, em pílulas que abrem em outra aba. */
export function SitesFavoritos({ sites }: { sites: { id: string; title: string; url: string | null }[] }) {
  return (
    <Secao
      titulo="Sites favoritos"
      acao={
        <Botao asChild variante="fantasma" tamanho="sm">
          <Link href="/links">Gerenciar</Link>
        </Botao>
      }
    >
      {sites.length ? (
        <ul className="flex flex-wrap gap-2">
          {sites.slice(0, 12).map((s) => (
            <li key={s.id} className="min-w-0 max-w-full">
              <a
                href={urlValida(s.url) ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-line-strong toque:min-h-11"
              >
                <Globe aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                <span className="min-w-0 truncate">{s.title}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">
          Nenhum site favorito ainda.{" "}
          <Link href="/links" className="underline underline-offset-2">
            Adicione em Links úteis
          </Link>
          .
        </p>
      )}
    </Secao>
  )
}

/** As outras listas que moram na página Pessoal e que a tela não usa em cartão próprio. */
export function OutrasListas({ colecoes }: { colecoes: Colecao[] }) {
  return (
    <Secao titulo="Outras listas">
      <ul className="flex flex-wrap gap-2">
        {colecoes.map((c) => (
          <li key={c.id} className="min-w-0 max-w-full">
            <Link
              href={`/colecoes/${c.id}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-line-strong toque:min-h-11"
            >
              <Layers aria-hidden className="size-3.5 shrink-0 text-ink-3" />
              <span className="min-w-0 truncate">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Secao>
  )
}
