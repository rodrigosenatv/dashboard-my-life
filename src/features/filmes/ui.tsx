"use client"

import * as React from "react"
import { toast } from "sonner"
import { MidiaIncorporada } from "@/components/midia"
import { Janela } from "@/components/ui/janela"
import { cn, isoDia } from "@/lib/utils"
import { useGravarFilmes } from "./dados"
import { gradienteDoTitulo, imagemTmdb, proximoEpisodio, type Titulo } from "./logica"

/** As colunas de Filmes & Séries no banco (o Notion grava com estes nomes). */
export const COLUNA = {
  tipo: "Filme/Série",
  assistido: "Assistido",
  nota: "Avaliação",
  categoria: "Categoria",
  data: "Data",
  temporada: "Temporada",
  episodio: "Episódio",
  plataforma: "Plataforma",
} as const

/** Sem cartaz (ou se a imagem falhar): um degradê fixo por nome, com o nome escrito por cima. */
export function CapaGerada({ nome, className }: { nome: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-full place-items-center p-3 text-center", className)} style={{ backgroundImage: gradienteDoTitulo(nome) }}>
      <span className="line-clamp-4 font-display text-[15px] font-semibold leading-snug text-white">{nome}</span>
    </span>
  )
}

/** O cartaz do TMDB; sem ele (ou se a imagem não carregar), a capa gerada. */
export function Cartaz({ titulo, tamanho = "w342", className }: { titulo: Titulo; tamanho?: string; className?: string }) {
  const [falhou, setFalhou] = React.useState<string | null>(null)
  const src = imagemTmdb(titulo.tmdb?.poster, tamanho)
  if (!src || falhou === src) return <CapaGerada nome={titulo.nome} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(src)}
      className={cn("size-full object-cover", className)}
    />
  )
}

/** As estrelas de uma nota, só para ver (quem muda a nota usa EscolherNota). */
export function Estrelas({ nota, className }: { nota: number; className?: string }) {
  return (
    <span role="img" aria-label={`${nota} de 5 estrelas`} className={cn("inline-flex text-warning", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden>
          {n <= nota ? "★" : "☆"}
        </span>
      ))}
    </span>
  )
}

/** A nota de 1 a 5. Tocar na nota que já está marcada tira a nota. */
export function EscolherNota({ valor, aoMudar }: { valor: number | null; aoMudar: (v: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Sua nota" className="flex flex-wrap gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const marcada = valor !== null && n <= valor
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={n === 1 ? "1 estrela" : `${n} estrelas`}
            onClick={() => aoMudar(valor === n ? null : n)}
            className={cn(
              "grid size-9 place-items-center rounded-md text-2xl leading-none transition-colors hover:bg-surface-2 toque:size-11",
              marcada ? "text-warning" : "text-ink-3 hover:text-ink-2",
            )}
          >
            <span aria-hidden>{marcada ? "★" : "☆"}</span>
          </button>
        )
      })}
    </div>
  )
}

/** O trailer do YouTube numa janela, sem sair do app. */
export function JanelaTrailer({ chave, nome, aberta, aoMudar }: { chave: string; nome: string; aberta: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <Janela aberta={aberta} aoMudar={aoMudar} titulo={`Trailer de ${nome}`} largura="lg">
      <MidiaIncorporada endereco={`https://www.youtube.com/watch?v=${chave}`} iniciar className="[--video-altura:64dvh]" />
    </Janela>
  )
}

/**
 * O "+1 episódio": anda para o próximo episódio. No último (com a lista de episódios do TMDB), marca a
 * série como assistida, como "Terminei a série".
 */
export function useAvancarEpisodio() {
  const gravar = useGravarFilmes()
  return (t: Titulo) => {
    const proximo = proximoEpisodio(t)
    const hoje = isoDia()
    void gravar.mudarProps(
      t.item,
      (p) => {
        p[COLUNA.temporada] = proximo.temporada
        p[COLUNA.episodio] = proximo.episodio
        if (proximo.fim) {
          p[COLUNA.assistido] = true
          if (!t.data) p[COLUNA.data] = hoje
        }
      },
      "filmes",
    )
    if (proximo.fim) toast.success("Marcado como assistido")
  }
}

/** Mensagem de erro de um campo ou de uma busca (lida por leitor de tela). */
export function MensagemErro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {texto}
    </p>
  )
}

/** A atribuição que o TMDB exige, com o link para o site dele. */
export function AtribuicaoTmdb({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-ink-3", className)}>
      Cartazes e informações:{" "}
      <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
        TMDB
      </a>
      . Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
    </p>
  )
}
