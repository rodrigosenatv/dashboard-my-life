"use client"

import * as React from "react"
import { CircleCheck, ClipboardPaste, Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { useRegistro } from "@/lib/data"
import { siteDoLinkCurto } from "@/lib/link-curto"
import { cn } from "@/lib/utils"
import { chaveDoVideo, lerVideoDeSite, linkDoVideo, NOME_DA_FONTE, type VideoDeSite } from "@/lib/videos"
import { miniaturaYoutube } from "@/lib/youtube"
import type { PaginaResumo } from "@/features/paginas/dados"
import type { Hobby } from "@/features/hobbies/dados"
import { ErroAoLerPagina, useGravarVideos, type Destino } from "./dados"
import { linhaDoVideo, partesDoTexto, type ItemFeed } from "./logica"

const CHAVE_ULTIMA = "videos:ultima-pagina"
const NOVA = "nova:"

/** O primeiro endereço de um texto colado ("Olha este reel https://…" também serve). */
function enderecoColado(texto: string): string {
  const t = texto.trim()
  const url = t.match(/https?:\/\/[^\s<>"']+/i)?.[0]
  if (url) return url.replace(/[.,;:!?)\]]+$/, "")
  // "instagram.com/reel/…" sem o https://
  if (/^(www\.|m\.|web\.)?(instagram\.com|youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com|facebook\.com|fb\.watch)\//i.test(t)) return `https://${t.split(/\s/)[0]}`
  return t
}

function descrever(v: VideoDeSite): string {
  if (v.fonte === "youtube") return v.youtube.vertical ? "Short do YouTube" : "Vídeo do YouTube"
  if (v.fonte === "instagram") return v.tipo === "p" ? "Post do Instagram" : "Reel do Instagram"
  if (v.fonte === "facebook") return v.tipo === "reel" ? "Reel do Facebook" : "Vídeo do Facebook"
  return "Vídeo do TikTok"
}

function lembrarPagina(id: string) {
  try {
    localStorage.setItem(CHAVE_ULTIMA, id)
  } catch {}
}

function ultimaPagina(): string | null {
  try {
    return localStorage.getItem(CHAVE_ULTIMA)
  } catch {
    return null
  }
}

/**
 * Adicionar um vídeo: colar o link, conferir que é um vídeo, escolher a página (e a parte dela)
 * e, se quiser, dar um nome. O link entra no texto da página e o vídeo aparece no feed.
 */
export function AdicionarVideo({
  aberta,
  aoMudar,
  destinos,
  hobbyPadrao,
  paginaHobbies,
  arvore,
  inicial,
  existentes,
  aoAdicionar,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  /** As páginas onde dá para pôr o vídeo, na ordem (com o nível para recuar as subpáginas). */
  destinos: Destino[]
  /** Hobby em que dá para criar uma página nova mesmo sem páginas ainda. */
  hobbyPadrao?: Hobby | null
  /** A página "Hobbies" (onde as páginas novas ficam) e a árvore de páginas. */
  paginaHobbies: PaginaResumo | null
  arvore: PaginaResumo[]
  /** Página (e parte) já escolhida ao abrir: a do vídeo da vez no feed, por exemplo. */
  inicial?: { paginaId?: string; parte?: string | null }
  /** Vídeos que já estão nas páginas (para avisar se o mesmo vídeo já foi guardado). */
  existentes: ItemFeed[]
  aoAdicionar?: (r: { chave: string; paginaId: string }) => void
}) {
  const gravar = useGravarVideos()
  const [texto, setTexto] = React.useState("")
  const [paginaId, setPaginaId] = React.useState("")
  const [parte, setParte] = React.useState("")
  const [nome, setNome] = React.useState("")
  const [nomePagina, setNomePagina] = React.useState("")
  const [tentou, setTentou] = React.useState(false)
  const [salvando, setSalvando] = React.useState(false)
  const [curto, setCurto] = React.useState<{ de: string; para: string | null; erro: string | null } | null>(null)

  // Hobbies em que dá para criar página nova (os das páginas da lista, ou o do feed)
  const hobbiesNovos = React.useMemo(() => {
    const mapa = new Map<string, Hobby>()
    if (hobbyPadrao) mapa.set(hobbyPadrao.id, hobbyPadrao)
    for (const d of destinos) if (d.hobby) mapa.set(d.hobby.id, d.hobby)
    return [...mapa.values()]
  }, [destinos, hobbyPadrao])
  const agrupar = new Set(destinos.map((d) => d.hobby?.id ?? "")).size > 1

  React.useEffect(() => {
    if (!aberta) return
    setTexto("")
    setNome("")
    setNomePagina("")
    setTentou(false)
    setSalvando(false)
    setCurto(null)
    const lembrada = ultimaPagina()
    const escolhida =
      (inicial?.paginaId && destinos.some((d) => d.id === inicial.paginaId) && inicial.paginaId) ||
      (lembrada && destinos.some((d) => d.id === lembrada) && lembrada) ||
      destinos[0]?.id ||
      (hobbiesNovos[0] ? `${NOVA}${hobbiesNovos[0].id}` : "")
    setPaginaId(escolhida)
    setParte(escolhida === inicial?.paginaId ? (inicial?.parte ?? "") : "")
    // Só ao abrir: o vídeo da vez muda enquanto a janela está aberta, mas a escolha fica
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])

  const endereco = enderecoColado(texto)
  const video = lerVideoDeSite(curto?.de === endereco && curto.para ? curto.para : endereco)
  const siteCurto = video ? null : siteDoLinkCurto(endereco)
  const precisaAbrir = siteCurto !== null

  // Link de compartilhar do TikTok ou do Facebook: o servidor do app abre e devolve o endereço do vídeo
  React.useEffect(() => {
    if (!precisaAbrir) return
    let cancelado = false
    setCurto({ de: endereco, para: null, erro: null })
    fetch(`/api/link-curto?url=${encodeURIComponent(endereco)}`)
      .then(async (r) => {
        const dados = await r.json().catch(() => ({}))
        if (!cancelado) setCurto({ de: endereco, para: r.ok ? (dados.url ?? null) : null, erro: r.ok ? null : (dados.erro ?? "Não deu para abrir esse link.") })
      })
      .catch(() => !cancelado && setCurto({ de: endereco, para: null, erro: "Sem conexão para abrir o link agora." }))
    return () => {
      cancelado = true
    }
  }, [precisaAbrir, endereco])
  const abrindo = precisaAbrir && curto?.de === endereco && !curto.para && !curto.erro

  const novaPagina = paginaId.startsWith(NOVA)
  const hobbyDaNova = novaPagina ? hobbiesNovos.find((h) => `${NOVA}${h.id}` === paginaId) : undefined
  const { data: pagina } = useRegistro("pages", paginaId && !novaPagina ? paginaId : null)
  const partes = React.useMemo(() => partesDoTexto(pagina?.content), [pagina?.content])
  const repetido = video ? existentes.find((e) => e.chave === chaveDoVideo(video)) : undefined
  const destino = destinos.find((d) => d.id === paginaId)

  const colar = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) setTexto(t.trim())
      else toast("Não há nada copiado.")
    } catch {
      toast("Não deu para colar daqui.", { description: "Toque e segure no campo e escolha Colar." })
    }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setTentou(true)
    if (!video || salvando || (novaPagina && !nomePagina.trim())) return
    setSalvando(true)
    const linha = linhaDoVideo(linkDoVideo(video), nome)
    const chave = chaveDoVideo(video)
    try {
      if (novaPagina && hobbyDaNova) {
        const id = await gravar.novaPagina(hobbyDaNova, paginaHobbies, arvore, nomePagina.trim(), linha)
        lembrarPagina(id)
        toast.success(`Vídeo guardado na página nova “${nomePagina.trim()}”`)
        aoAdicionar?.({ chave, paginaId: id })
      } else if (destino) {
        const antes = await gravar.adicionar(destino.id, linha, parte || null)
        lembrarPagina(destino.id)
        toast.success(`Vídeo adicionado em “${destino.titulo}”`, {
          action: { label: "Desfazer", onClick: () => gravar.voltarTexto(destino.id, antes) },
        })
        aoAdicionar?.({ chave, paginaId: destino.id })
      } else return
      aoMudar(false)
    } catch (erro) {
      // Falha ao gravar já aparece num aviso; aqui só a de ler a página antes
      if (erro instanceof ErroAoLerPagina) toast.error("Não foi possível adicionar o vídeo.", { description: erro.message })
    } finally {
      setSalvando(false)
    }
  }

  const naoReconhecido = Boolean(endereco) && !video && !precisaAbrir && (tentou || /^https?:\/\/\S+\.\S+/i.test(endereco))
  const mostrarErroLink = tentou && !video && !abrindo

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo="Adicionar vídeo"
      descricao="Vale link do YouTube, do Instagram, do TikTok ou do Facebook."
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-adicionar-video" disabled={salvando || abrindo}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Adicionar
          </Botao>
        </>
      }
    >
      <form id="form-adicionar-video" onSubmit={salvar} noValidate className="grid gap-4">
        <Campo rotulo="Link do vídeo" htmlFor="video-link">
          <div className="flex gap-2">
            <Entrada
              id="video-link"
              autoFocus
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="https://www.instagram.com/reel/…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-invalid={mostrarErroLink || naoReconhecido || undefined}
              aria-describedby="video-link-estado"
            />
            {typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function" ? (
              <Botao variante="contorno" onClick={colar} className="shrink-0">
                <ClipboardPaste /> Colar
              </Botao>
            ) : null}
          </div>
          <div id="video-link-estado" aria-live="polite" className="min-h-5 text-sm">
            {video ? (
              <div className="flex items-center gap-3">
                {video.fonte === "youtube" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={miniaturaYoutube(video.youtube.id)} alt="" className={cn("shrink-0 rounded-md bg-surface-2 object-cover", video.youtube.vertical ? "h-16 w-9" : "h-12 w-20")} />
                ) : null}
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <CircleCheck className="size-4 shrink-0 text-rotina" aria-hidden /> {descrever(video)}
                  </p>
                  {repetido ? (
                    <p className="flex items-center gap-1.5 text-warning">
                      <TriangleAlert className="size-4 shrink-0" aria-hidden /> Esse vídeo já está em “{repetido.paginaTitulo}”.
                    </p>
                  ) : video.fonte === "facebook" ? (
                    <p className="text-ink-3">Toca aqui no app quando o vídeo é público no Facebook.</p>
                  ) : null}
                </div>
              </div>
            ) : abrindo && siteCurto ? (
              <p className="flex items-center gap-1.5 text-ink-2">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Abrindo o link do {NOME_DA_FONTE[siteCurto]}…
              </p>
            ) : precisaAbrir && curto?.erro ? (
              <p className="text-danger">{curto.erro}</p>
            ) : naoReconhecido || mostrarErroLink ? (
              <p className="text-danger">{endereco ? "Esse link não é de um vídeo do YouTube, do Instagram, do TikTok ou do Facebook." : "Cole o link do vídeo."}</p>
            ) : (
              <p className="text-ink-3">No app do Instagram, do YouTube, do TikTok ou do Facebook: Compartilhar › Copiar link.</p>
            )}
          </div>
        </Campo>

        <Campo rotulo="Guardar na página" htmlFor="video-pagina">
          <Seletor
            id="video-pagina"
            value={paginaId}
            onChange={(e) => {
              setPaginaId(e.target.value)
              setParte("")
            }}
          >
            {agrupar
              ? hobbiesNovos.map((h) => (
                  <optgroup key={h.id} label={h.nome}>
                    {destinos
                      .filter((d) => d.hobby?.id === h.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {"  ".repeat(d.nivel)}
                          {d.titulo}
                        </option>
                      ))}
                    <option value={`${NOVA}${h.id}`}>+ Nova página em {h.nome}</option>
                  </optgroup>
                ))
              : (
                  <>
                    {destinos.map((d) => (
                      <option key={d.id} value={d.id}>
                        {"  ".repeat(d.nivel)}
                        {d.titulo}
                      </option>
                    ))}
                    {hobbiesNovos.map((h) => (
                      <option key={h.id} value={`${NOVA}${h.id}`}>
                        + Nova página em {h.nome}
                      </option>
                    ))}
                  </>
                )}
          </Seletor>
        </Campo>

        {novaPagina ? (
          <Campo rotulo="Nome da página nova" htmlFor="video-pagina-nova">
            <Entrada
              id="video-pagina-nova"
              value={nomePagina}
              onChange={(e) => setNomePagina(e.target.value)}
              placeholder="Ex.: Defesa"
              autoComplete="off"
              aria-invalid={(tentou && !nomePagina.trim()) || undefined}
              aria-describedby={tentou && !nomePagina.trim() ? "video-pagina-nova-erro" : undefined}
            />
            {tentou && !nomePagina.trim() ? (
              <p id="video-pagina-nova-erro" role="alert" className="text-sm text-danger">
                Dê um nome à página.
              </p>
            ) : null}
          </Campo>
        ) : partes.length ? (
          <Campo rotulo="Em qual parte da página" htmlFor="video-parte">
            <Seletor id="video-parte" value={parte} onChange={(e) => setParte(e.target.value)}>
              <option value="">No fim da página</option>
              {partes.map((p) => (
                <option key={p.titulo} value={p.titulo}>
                  {p.titulo}
                </option>
              ))}
            </Seletor>
          </Campo>
        ) : null}

        <Campo rotulo="Nome do vídeo (opcional)" htmlFor="video-nome" dica="Aparece embaixo do vídeo. Ex.: Jab cruzado.">
          <Entrada id="video-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" enterKeyHint="done" maxLength={120} />
        </Campo>
      </form>
    </Janela>
  )
}
