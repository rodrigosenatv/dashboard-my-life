"use client"

import * as React from "react"
import { Info, Play } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useChaveTmdb, useDetalhesTmdb } from "./dados"
import { gradienteDoTitulo, imagemTmdb, proximoEpisodio, textoProgresso, type Titulo } from "./logica"
import { JanelaTrailer, useAvancarEpisodio } from "./ui"

const MOTIVO = {
  continuar: "Continuar assistindo",
  lista: "Na sua lista",
  assistido: "Você assistiu",
} as const

const BOTAO_CLARO = "border-0 bg-white/20 text-white backdrop-blur hover:bg-white/30 hover:text-white"

/** O título em destaque da página: o cartaz grande, a sinopse e as ações principais. */
export function Destaque({ titulo: t, motivo, aoAbrir }: { titulo: Titulo; motivo: keyof typeof MOTIVO; aoAbrir: () => void }) {
  const { chave } = useChaveTmdb()
  // O trailer só aparece quando os detalhes do TMDB já vieram (são guardados por um dia)
  const trailer = useDetalhesTmdb(chave, t.tmdb).data?.trailer ?? null
  const avancar = useAvancarEpisodio()
  const [trailerAberto, setTrailerAberto] = React.useState(false)

  // A imagem larga do TMDB (ou o cartaz, se não houver); o navegador escolhe o tamanho pela tela
  const fundoGrande = imagemTmdb(t.tmdb?.fundo, "w1280")
  const fundo = fundoGrande ?? imagemTmdb(t.tmdb?.poster, "w780")
  const fundoMenor = fundoGrande ? imagemTmdb(t.tmdb?.fundo, "w780") : null
  const progresso = textoProgresso(t)
  const linha = [t.tmdb?.ano, t.tipo === "serie" ? "Série" : "Filme", progresso, t.plataforma].filter(Boolean).join(" · ")
  // Série em andamento: o botão anda um episódio (ou termina a série, no último)
  const emAndamento = motivo === "continuar"
  const terminou = proximoEpisodio(t).fim

  return (
    <section aria-label="Destaque" className="relative isolate overflow-hidden rounded-2xl bg-black text-white md:aspect-[21/9] md:max-h-[30rem]">
      {/* No celular a imagem fica inteira em cima (16:9) e some no preto onde está o texto; no computador cobre tudo */}
      {fundo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fundo}
          srcSet={fundoMenor && fundoGrande ? `${fundoMenor} 780w, ${fundoGrande} 1280w` : undefined}
          sizes={fundoMenor ? "(min-width: 768px) 75vw, 100vw" : undefined}
          alt=""
          decoding="async"
          className="absolute inset-x-0 top-0 -z-10 aspect-video w-full object-cover md:inset-0 md:aspect-auto md:size-full"
        />
      ) : (
        <span aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: gradienteDoTitulo(t.nome) }} />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute -z-10 bg-gradient-to-t from-black via-black/40 to-transparent",
          fundo ? "inset-x-0 top-0 aspect-video md:inset-0 md:aspect-auto" : "inset-0",
        )}
      />
      <span aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-black/90 via-black/40 to-transparent md:block" />

      <div className="flex flex-col justify-end gap-3 p-5 pt-[36%] sm:p-8 sm:pt-[36%] md:h-full md:max-w-2xl md:justify-center md:pt-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{MOTIVO[motivo]}</p>
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{t.nome}</h2>
        {linha ? <p className="text-sm text-white/80">{linha}</p> : null}
        {/* A sinopse fica na janela do título no celular, para o destaque caber na primeira tela */}
        {t.tmdb?.sinopse ? <p className="hidden max-w-xl text-white/85 sm:line-clamp-3">{t.tmdb.sinopse}</p> : null}
        <div className="mt-1 flex flex-wrap gap-2">
          {emAndamento ? (
            <Botao className="bg-white text-black hover:bg-white/90 hover:text-black" onClick={() => avancar(t)}>
              {terminou ? "Terminei a série" : "+1 episódio"}
            </Botao>
          ) : null}
          {trailer ? (
            <Botao variante="secundario" className={BOTAO_CLARO} onClick={() => setTrailerAberto(true)}>
              <Play /> Trailer
            </Botao>
          ) : null}
          <Botao variante="secundario" className={BOTAO_CLARO} onClick={aoAbrir}>
            <Info /> Mais informações
          </Botao>
        </div>
      </div>

      {trailer ? <JanelaTrailer chave={trailer} nome={t.nome} aberta={trailerAberto} aoMudar={setTrailerAberto} /> : null}
    </section>
  )
}
