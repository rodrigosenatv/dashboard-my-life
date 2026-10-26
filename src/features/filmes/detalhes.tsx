"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { Check, ImageIcon, Minus, Play, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { isoDia, plural } from "@/lib/utils"
import { resumoDoTexto } from "@/features/pessoal/logica"
import { useChaveTmdb, useDetalhesTmdb, useGravarFilmes } from "./dados"
import { estrelas, gradienteDoTitulo, imagemTmdb, linkDoItem, proximoEpisodio, textoProgresso, type Provedor, type Titulo } from "./logica"
import { JanelaAdicionar } from "./adicionar"
import { COLUNA, CapaGerada, EscolherNota, Estrelas, JanelaTrailer, useAvancarEpisodio } from "./ui"

/** A janela de um título: imagem, progresso, trailer, assistido, episódios, nota, onde assistir, sinopse e anotações. */
export function JanelaDetalhes({ titulo: t, aberta, aoMudar }: { titulo: Titulo | null; aberta: boolean; aoMudar: (v: boolean) => void }) {
  const gravar = useGravarFilmes()
  const { chave } = useChaveTmdb()
  const detalhes = useDetalhesTmdb(chave, t?.tmdb).data
  const avancar = useAvancarEpisodio()
  const [trailerAberto, setTrailerAberto] = React.useState(false)
  const [escolhendoCartaz, setEscolhendoCartaz] = React.useState(false)

  if (!t) return null

  const trailer = detalhes?.trailer ?? null
  const serie = t.tipo === "serie"
  const terminou = proximoEpisodio(t).fim
  const duracao = detalhes?.duracao ? (serie ? `${detalhes.duracao} min por episódio` : `${detalhes.duracao} min`) : null
  const temporadas = serie && detalhes?.temporadas ? plural(detalhes.temporadas, "temporada") : null
  const generos = detalhes?.generos.length ? detalhes.generos.join(", ") : null
  const linha = [t.tmdb?.ano, serie ? "Série" : "Filme", duracao, temporadas, generos].filter(Boolean).join(" · ")
  const progresso = textoProgresso(t)
  const temAnotacao = t.anotacoes.trim() !== ""
  const provedores = detalhes?.ondeAssistir
  const grupos = provedores
    ? ([
        ["Assinatura", provedores.assinatura],
        ["Aluguel", provedores.aluguel],
        ["Compra", provedores.compra],
      ] as const).filter(([, lista]) => lista.length > 0)
    : []

  // Cada alteração grava na hora (a tela muda antes do banco)
  const marcarAssistido = (ligar: boolean) => {
    const hoje = isoDia()
    void gravar.mudarProps(
      t.item,
      (p) => {
        p[COLUNA.assistido] = ligar
        if (ligar && !t.data) p[COLUNA.data] = hoje
      },
      "filmes",
    )
    if (ligar) toast.success("Marcado como assistido")
  }

  const mudarPosicao = (coluna: string, valor: number) => {
    void gravar.mudarProps(t.item, (p) => {
      p[coluna] = valor
    }, "filmes")
  }

  const mudarNota = (n: number | null) => {
    void gravar.mudarProps(
      t.item,
      (p) => {
        if (n === null) delete p[COLUNA.nota]
        else p[COLUNA.nota] = estrelas(n)
      },
      "filmes",
    )
  }

  // Excluir fecha a janela e avisa; "Desfazer" recria o título com o mesmo id e os mesmos dados
  const excluir = () => {
    const item = t.item
    aoMudar(false)
    void gravar.excluir([item])
    toast.success("Título excluído", {
      action: {
        label: "Desfazer",
        onClick: () =>
          void gravar
            .criar("filmes", { id: item.id, title: item.title, props: (item.props ?? {}) as Record<string, Json>, content: item.content, position: item.position })
            .catch(() => undefined),
      },
    })
  }

  const imagem = imagemTmdb(t.tmdb?.fundo, "w780")
  const poster = imagemTmdb(t.tmdb?.poster, "w342")

  return (
    <>
      <Janela
        aberta={aberta}
        aoMudar={aoMudar}
        titulo={t.nome}
        largura="lg"
        rodape={
          <>
            <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={excluir}>
              <Trash2 /> Excluir
            </Botao>
            <Botao variante="secundario" onClick={() => aoMudar(false)}>
              Fechar
            </Botao>
          </>
        }
      >
        <div className="grid gap-6">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2">
            {imagem ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagem} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />
            ) : poster ? (
              <>
                <span aria-hidden className="absolute inset-0" style={{ backgroundImage: gradienteDoTitulo(t.nome) }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster} alt="" decoding="async" className="absolute inset-y-0 left-1/2 h-full -translate-x-1/2 object-contain" />
              </>
            ) : (
              <CapaGerada nome={t.nome} className="absolute inset-0" />
            )}
            {progresso ? (
              <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-sm font-medium text-white">{progresso}</span>
            ) : null}
            {/* Com a chave: escolher o cartaz certo (ou trocar um que veio errado) */}
            {chave ? (
              <Botao
                tamanho="sm"
                className="absolute bottom-3 right-3 border-0 bg-black/70 text-white backdrop-blur hover:bg-black/85 hover:text-white"
                onClick={() => setEscolhendoCartaz(true)}
              >
                <ImageIcon /> {t.tmdb ? "Trocar cartaz" : "Escolher cartaz"}
              </Botao>
            ) : null}
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              {linha ? <span>{linha}</span> : null}
              {t.nota !== null ? <Estrelas nota={t.nota} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {trailer ? (
                <Botao variante="contorno" onClick={() => setTrailerAberto(true)}>
                  <Play /> Trailer
                </Botao>
              ) : null}
              <Botao variante={t.assistido ? "primario" : "contorno"} aria-pressed={t.assistido} onClick={() => marcarAssistido(!t.assistido)}>
                <Check /> Assistido
              </Botao>
            </div>
            {t.tmdb?.sinopse ? <p className="text-[15px] leading-relaxed text-ink-2">{t.tmdb.sinopse}</p> : null}
          </div>

          {serie ? (
            <div className="grid gap-3 rounded-xl border border-line p-4">
              <Contador
                rotulo="Temporada"
                valor={t.temporada}
                anterior="Temporada anterior"
                proxima="Próxima temporada"
                aoMudar={(v) => mudarPosicao(COLUNA.temporada, v)}
              />
              <Contador rotulo="Episódio" valor={t.episodio} anterior="Episódio anterior" proxima="Próximo episódio" aoMudar={(v) => mudarPosicao(COLUNA.episodio, v)} />
              <div>
                <Botao variante="primario" onClick={() => avancar(t)}>
                  {terminou ? "Terminei a série" : "+1 episódio"}
                </Botao>
              </div>
            </div>
          ) : null}

          <Bloco titulo="Sua nota">
            <EscolherNota valor={t.nota} aoMudar={mudarNota} />
          </Bloco>

          {grupos.length || t.plataforma ? (
            <Bloco titulo="Onde assistir">
              {grupos.length ? (
                <div className="grid gap-3">
                  <dl className="grid gap-3">
                    {grupos.map(([rotulo, lista]) => (
                      <div key={rotulo} className="grid gap-1.5">
                        <dt className="text-xs font-medium text-ink-3">{rotulo}</dt>
                        <dd className="flex flex-wrap gap-2">
                          {lista.map((p) => (
                            <ChipProvedor key={p.nome} provedor={p} />
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-ink-3">
                    Dados do JustWatch
                    {provedores?.link ? (
                      <>
                        {" · "}
                        <a href={provedores.link} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
                          Ver no TMDB
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-2">{t.plataforma}</p>
              )}
            </Bloco>
          ) : null}

          <Bloco titulo="Suas anotações">
            {temAnotacao ? <p className="text-[15px] leading-relaxed text-ink-2">{resumoDoTexto(t.anotacoes, 300)}</p> : <p className="text-sm text-ink-3">Nenhuma anotação ainda.</p>}
            <div className="mt-2">
              <Botao asChild variante="fantasma" tamanho="sm">
                <Link href={linkDoItem(t.id, !temAnotacao)}>{temAnotacao ? "Abrir anotações" : "Escrever anotações"}</Link>
              </Botao>
            </div>
          </Bloco>
        </div>
      </Janela>

      {trailer ? <JanelaTrailer chave={trailer} nome={t.nome} aberta={trailerAberto} aoMudar={setTrailerAberto} /> : null}
      {chave ? <JanelaAdicionar aberta={escolhendoCartaz} aoMudar={setEscolhendoCartaz} trocarCartazDe={t} /> : null}
    </>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      {children}
    </section>
  )
}

/** Um provedor de onde assistir: o logo (do TMDB) e o nome. */
function ChipProvedor({ provedor }: { provedor: Provedor }) {
  const logo = imagemTmdb(provedor.logo, "w45")
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" loading="lazy" decoding="async" className="size-5 rounded" />
      ) : null}
      {provedor.nome}
    </span>
  )
}

/** Temporada ou episódio com − e +; o mínimo é 1. */
function Contador({
  rotulo,
  valor,
  anterior,
  proxima,
  aoMudar,
}: {
  rotulo: string
  valor: number | null
  anterior: string
  proxima: string
  aoMudar: (v: number) => void
}) {
  const atual = valor ?? 0
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-ink-2">{rotulo}</span>
      <div className="flex items-center gap-1">
        <Botao variante="contorno" tamanho="icone" aria-label={anterior} disabled={atual <= 1} onClick={() => aoMudar(Math.max(1, atual - 1))}>
          <Minus />
        </Botao>
        <span aria-live="polite" className="tabular w-12 text-center text-base font-semibold">
          {valor ?? "–"}
        </span>
        <Botao variante="contorno" tamanho="icone" aria-label={proxima} onClick={() => aoMudar(atual + 1)}>
          <Plus />
        </Botao>
      </div>
    </div>
  )
}
