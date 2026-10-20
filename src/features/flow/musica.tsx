"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { ExternalLink, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Esqueleto, Secao, Vazio } from "@/components/ui/basicos"
import { Botao } from "@/components/ui/button"
import { Entrada } from "@/components/ui/campos"
import { TelaYoutube } from "@/components/video-youtube"
import { cn } from "@/lib/utils"
import { linkYoutube, miniaturaYoutube } from "@/lib/youtube"
import {
  buscarTituloYoutube,
  faixasDaPagina,
  linhaNovaDaPlaylist,
  linkYoutubeColado,
  useGravarPlaylist,
  usePaginaFlow,
  useTituloYoutube,
  type FaixaPlaylist,
} from "./dados"

/** A música que a pessoa escolheu por último neste aparelho. */
const CHAVE_MUSICA = "flow:musica"

function lerMusicaLembrada(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(CHAVE_MUSICA)
  } catch {
    return null
  }
}

function lembrarMusica(chave: string) {
  try {
    localStorage.setItem(CHAVE_MUSICA, chave)
  } catch {
    // Sem armazenamento: a música volta a ser a primeira da lista
  }
}

/** A playlist de músicas para focar: os vídeos da página Flow, um player e a lista para acrescentar ou tirar. */
export function MusicaParaFocar() {
  const router = useRouter()
  const { pagina, conteudo, carregando } = usePaginaFlow()
  const faixas = React.useMemo(() => faixasDaPagina(conteudo), [conteudo])
  const gravar = useGravarPlaylist()
  const [lembrada] = React.useState<string | null>(lerMusicaLembrada)
  const [escolhidaChave, setEscolhidaChave] = React.useState<string | null>(null)
  const [tocar, setTocar] = React.useState(false)
  const [link, setLink] = React.useState("")
  const [erro, setErro] = React.useState<string | null>(null)
  const [adicionando, setAdicionando] = React.useState(false)

  const atual = faixas.find((f) => f.chave === escolhidaChave) ?? faixas.find((f) => f.chave === lembrada) ?? faixas[0] ?? null
  const consultaAtual = useTituloYoutube(atual?.id ?? "", Boolean(atual && !atual.legenda))
  const carregandoAtual = Boolean(atual && !atual.legenda && consultaAtual.isLoading)
  const nomeAtual = atual ? (atual.legenda ?? consultaAtual.data?.titulo ?? "Vídeo do YouTube") : ""
  const canalAtual = atual && !atual.legenda ? (consultaAtual.data?.canal ?? null) : null

  const tocarFaixa = (chave: string) => {
    setEscolhidaChave(chave)
    setTocar(true)
    lembrarMusica(chave)
  }

  const adicionar = async (e: React.FormEvent) => {
    e.preventDefault()
    const texto = link.trim()
    if (!texto) {
      setErro("Cole o link de um vídeo do YouTube.")
      return
    }
    const video = linkYoutubeColado(texto)
    if (!video) {
      setErro("Esse link não é de um vídeo do YouTube.")
      return
    }
    if (faixas.some((f) => f.id === video.id)) {
      setErro("Esse vídeo já está na playlist.")
      return
    }
    setAdicionando(true)
    try {
      const info = await buscarTituloYoutube(video.id)
      const linha = linhaNovaDaPlaylist(video, info?.titulo ?? null)
      const { paginaId, antes } = await gravar.adicionar(pagina?.id ?? null, linha)
      setLink("")
      toast("Vídeo adicionado à playlist", { action: { label: "Desfazer", onClick: () => gravar.voltar(paginaId, antes) } })
    } catch {
      toast.error("Não deu para adicionar o vídeo.")
    } finally {
      setAdicionando(false)
    }
  }

  const tirar = async (f: FaixaPlaylist) => {
    if (!pagina) return
    try {
      const antes = await gravar.remover(pagina.id, f.chave)
      if (antes === null) {
        toast.error("Esse vídeo está no meio de um texto.", {
          description: "Abra a página Flow para tirar o link.",
          action: { label: "Abrir página", onClick: () => router.push(`/paginas/${pagina.id}`) },
        })
        return
      }
      toast("Vídeo tirado da playlist", { action: { label: "Desfazer", onClick: () => gravar.voltar(pagina.id, antes) } })
      // Tirou a que tocava: a primeira que sobrou fica escolhida, sem tocar sozinha
      if (atual?.chave === f.chave) {
        setEscolhidaChave(faixas.find((x) => x.chave !== f.chave)?.chave ?? null)
        setTocar(false)
      }
    } catch {
      toast.error("Não deu para tirar o vídeo.")
    }
  }

  if (carregando) {
    return (
      <Secao titulo="Música para focar">
        <Esqueleto className="aspect-video w-full rounded-xl" />
      </Secao>
    )
  }

  const formulario = (
    <>
      <form onSubmit={adicionar} className="mt-4 flex gap-2">
        <Entrada
          aria-label="Link do vídeo do YouTube"
          placeholder="Colar link do YouTube"
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            setErro(null)
          }}
        />
        <Botao type="submit" variante="contorno" disabled={adicionando}>
          <Plus aria-hidden /> {adicionando ? "Adicionando…" : "Adicionar"}
        </Botao>
      </form>
      {erro ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erro}
        </p>
      ) : null}
    </>
  )

  return (
    <Secao titulo="Música para focar">
      {atual ? (
        <>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            <TelaYoutube key={`${atual.chave}:${tocar}`} video={atual.video} titulo={nomeAtual} iniciar={tocar} />
          </div>
          {carregandoAtual ? (
            <span className="mt-3 block h-5 w-48 animate-pulse rounded-md bg-surface-2" />
          ) : (
            <p className="mt-3 font-medium leading-snug">{nomeAtual}</p>
          )}
          {canalAtual ? <p className="text-sm text-ink-3">{canalAtual}</p> : null}
          <a
            href={linkYoutube(atual.video)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink toque:min-h-11"
          >
            <ExternalLink aria-hidden className="size-3.5" /> Abrir no YouTube
          </a>
          <ol aria-label="Playlist" className="mt-4 grid gap-1">
            {faixas.map((f) => (
              <ItemPlaylist
                key={f.chave}
                f={f}
                escolhida={f.chave === atual.chave}
                aoTocar={() => tocarFaixa(f.chave)}
                aoTirar={() => tirar(f)}
              />
            ))}
          </ol>
          {formulario}
          <p className="mt-3 text-xs text-ink-3">A música para se você sair desta tela.</p>
        </>
      ) : (
        <>
          <Vazio titulo="Nenhuma música ainda." descricao="Cole o link de um vídeo do YouTube para tocar aqui enquanto você foca." />
          {formulario}
        </>
      )}
    </Secao>
  )
}

/** Uma música da lista: miniatura, título (do YouTube, se a pessoa não deu um) e o botão de tirar. */
function ItemPlaylist({
  f,
  escolhida,
  aoTocar,
  aoTirar,
}: {
  f: FaixaPlaylist
  escolhida: boolean
  aoTocar: () => void
  aoTirar: () => void
}) {
  const consulta = useTituloYoutube(f.id, !f.legenda)
  const carregandoTitulo = !f.legenda && consulta.isLoading
  const nome = f.legenda ?? consulta.data?.titulo ?? "Vídeo do YouTube"
  const canal = f.legenda ? null : (consulta.data?.canal ?? null)

  return (
    <li className={cn("flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-2", escolhida && "bg-surface-2")}>
      <button
        type="button"
        aria-label={`Tocar ${nome}`}
        aria-current={escolhida ? "true" : undefined}
        onClick={aoTocar}
        className="flex min-w-0 flex-1 items-center gap-3 text-left toque:min-h-11"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={miniaturaYoutube(f.id)} alt="" loading="lazy" className="aspect-video w-20 shrink-0 rounded-md bg-surface-3 object-cover" />
        <span className="min-w-0 flex-1">
          {carregandoTitulo ? (
            <span className="block h-4 w-40 animate-pulse rounded-md bg-surface-2" />
          ) : (
            <span className={cn("line-clamp-2 block text-sm font-medium", escolhida && "text-pen")}>{nome}</span>
          )}
          {canal ? <span className="block truncate text-xs text-ink-3">{canal}</span> : null}
        </span>
      </button>
      <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Tirar ${nome} da playlist`} title="Tirar da playlist" onClick={aoTirar}>
        <X />
      </Botao>
    </li>
  )
}
