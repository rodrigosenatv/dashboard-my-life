"use client"

import dynamic from "next/dynamic"
import * as React from "react"
import { Ellipsis, ImageUp, LoaderCircle, Maximize2, Target, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Esqueleto } from "@/components/ui/basicos"
import { Botao } from "@/components/ui/button"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { useSessao } from "@/components/provedores"
import { useConfiguracoes, useSalvarConfiguracoes } from "@/features/configuracoes/dados"
import { useUrlArquivo } from "@/lib/arquivos"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import { cn } from "@/lib/utils"
import { caminhoNovoDoQuadro, extensaoDaImagem, lerQuadro, PREF_QUADRO } from "./quadro-logica"

const TAMANHO_MAXIMO = 20 * 1024 * 1024
/** Lembra, no aparelho, se há quadro: ao abrir o Flow, o lugar dele já aparece antes das preferências chegarem. */
const CHAVE_TEM_QUADRO = "flow:tem-quadro"

// A tela de foco só é baixada quando vai abrir (o ponteiro sobre o quadro já antecipa)
const carregarTelaDeFoco = () => import("./tela-foco").then((m) => m.TelaDeFoco)
const TelaDeFoco = dynamic(carregarTelaDeFoco, { ssr: false })
const anteciparTelaDeFoco = () => void carregarTelaDeFoco().catch(() => {})

/** Põe a página em tela cheia de verdade (sem as barras do navegador), quando o aparelho deixa. */
function pedirTelaCheia() {
  try {
    const raiz = document.documentElement
    if (!document.fullscreenElement && typeof raiz.requestFullscreen === "function") void raiz.requestFullscreen({ navigationUI: "hide" }).catch(() => {})
  } catch {
    // Sem suporte (iPhone): a tela de foco cobre a página do mesmo jeito
  }
}

export type QuadroDosAlvos = ReturnType<typeof useQuadroDosAlvos>

/**
 * O quadro dos alvos do Flow: o caminho da imagem nas preferências (`settings.prefs.quadroAlvos`), o link para
 * mostrar e as ações para pôr (enviando ou usando a imagem da capa do Hoje), trocar e tirar.
 */
export function useQuadroDosAlvos() {
  const { usuario } = useSessao()
  const { data: cfg, isPending: carregandoPrefs } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  const prefs = (cfg?.prefs ?? {}) as Record<string, unknown>
  const caminho = lerQuadro(prefs)
  const capa = typeof prefs.capa === "string" && prefs.capa ? prefs.capa : null
  const link = useUrlArquivo(caminho)
  const [enviando, setEnviando] = React.useState(false)

  // Sem isto, a sessão de foco abria sem o quadro e pulava para o lado quando as preferências chegavam
  const [lembrado] = React.useState(() => {
    try {
      return localStorage.getItem(CHAVE_TEM_QUADRO) === "1"
    } catch {
      return false
    }
  })
  React.useEffect(() => {
    if (carregandoPrefs) return
    try {
      if (caminho) localStorage.setItem(CHAVE_TEM_QUADRO, "1")
      else localStorage.removeItem(CHAVE_TEM_QUADRO)
    } catch {
      // Sem armazenamento: só não antecipa o lugar do quadro
    }
  }, [carregandoPrefs, caminho])
  const arquivos = () => supabase().storage.from(BUCKET_ARQUIVOS)

  // Grava o caminho novo. A imagem antiga só sai depois de gravar; se gravar falhar, quem sai é a nova
  // (o aviso de erro ao gravar já sai do hook de salvar).
  const gravar = (novo: string | null, aviso: string) => {
    const antigo = caminho
    salvar.mutate(
      { prefs: { [PREF_QUADRO]: novo } },
      {
        onSuccess: () => {
          toast.success(aviso)
          if (antigo && antigo !== novo) void arquivos().remove([antigo])
        },
        onError: () => {
          if (novo) void arquivos().remove([novo])
        },
      },
    )
  }

  const enviar = async (arquivo: File) => {
    if (!usuario || enviando) return
    if (!arquivo.type.startsWith("image/")) return void toast.error("Escolha uma imagem (JPG, PNG, WebP ou AVIF).")
    if (arquivo.size > TAMANHO_MAXIMO) return void toast.error("A imagem é grande demais. Use uma de até 20 MB.")
    setEnviando(true)
    try {
      const { otimizarImagem } = await import("@/lib/otimizar-imagem")
      const pronta = await otimizarImagem(arquivo, { dimensaoMaxima: 1920 })
      const novo = caminhoNovoDoQuadro(usuario.id, extensaoDaImagem(pronta.type, pronta.name), Date.now())
      const { error } = await arquivos().upload(novo, pronta, { contentType: pronta.type })
      if (error) throw new Error(error.message)
      gravar(novo, caminho ? "Quadro dos alvos trocado" : "Quadro dos alvos salvo")
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível enviar a imagem.")
    } finally {
      setEnviando(false)
    }
  }

  /** Usa a imagem da capa do Hoje: faz uma cópia, para trocar ou tirar a capa não levar o quadro junto. */
  const usarCapa = async () => {
    if (!usuario || !capa || enviando) return
    setEnviando(true)
    try {
      const novo = caminhoNovoDoQuadro(usuario.id, extensaoDaImagem("", capa), Date.now())
      const { error } = await arquivos().copy(capa, novo)
      if (error) throw new Error(error.message)
      gravar(novo, "Quadro dos alvos salvo")
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível usar a imagem da capa.")
    } finally {
      setEnviando(false)
    }
  }

  const remover = () => gravar(null, "Quadro dos alvos removido")

  return {
    caminho,
    /** Há quadro (ou, enquanto as preferências chegam, havia da última vez neste aparelho). */
    temQuadro: Boolean(caminho) || (carregandoPrefs && lembrado),
    url: link.data ?? null,
    erroLink: link.isError,
    tentarDeNovo: () => void link.refetch(),
    carregando: carregandoPrefs,
    capa,
    enviando,
    enviar,
    usarCapa,
    remover,
  }
}

/** O seletor de arquivo escondido, aberto pelos botões "Adicionar imagem" e "Trocar imagem". */
function useEscolherImagem(aoEscolher: (arquivo: File) => void) {
  const entrada = React.useRef<HTMLInputElement>(null)
  const campo = (
    <input
      ref={entrada}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const arquivo = e.target.files?.[0]
        if (arquivo) aoEscolher(arquivo)
        e.target.value = ""
      }}
    />
  )
  return { campo, escolher: () => entrada.current?.click() }
}

/** A imagem arrastada para cima de uma área (do computador), ou null quando o que vem não é imagem. */
function imagemArrastada(e: React.DragEvent): File | null {
  const arquivo = e.dataTransfer.files?.[0]
  return arquivo && arquivo.type.startsWith("image/") ? arquivo : null
}

/**
 * Sem quadro: o convite no fim da sessão de foco. Dá para enviar uma imagem (ou soltar uma aqui) e, se a capa
 * do Hoje tem imagem, usar a mesma.
 */
export function ConviteDoQuadro({ quadro }: { quadro: QuadroDosAlvos }) {
  const { campo, escolher } = useEscolherImagem(quadro.enviar)
  const [arrastando, setArrastando] = React.useState(false)
  if (quadro.carregando) return null

  return (
    <div
      className={cn(
        "mt-7 flex flex-col gap-4 rounded-xl border border-dashed p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-5",
        arrastando ? "border-estudos bg-estudos-soft" : "border-line-strong",
      )}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return
        e.preventDefault()
        setArrastando(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setArrastando(false)
        const arquivo = imagemArrastada(e)
        if (arquivo) void quadro.enviar(arquivo)
        else toast.error("Solte uma imagem (JPG, PNG, WebP ou AVIF).")
      }}
    >
      {campo}
      <div className="flex min-w-0 gap-3.5">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-estudos-soft text-estudos">
          <Target className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">Quadro dos alvos</p>
          <p className="mt-0.5 text-sm text-ink-2">
            {arrastando ? "Solte a imagem para usar como o seu quadro." : "Coloque aqui o seu quadro e veja os seus alvos ao lado do timer enquanto foca."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {quadro.capa ? (
          <Botao variante="fantasma" onClick={() => void quadro.usarCapa()} disabled={quadro.enviando}>
            Usar a imagem da capa do Hoje
          </Botao>
        ) : null}
        <Botao variante="contorno" onClick={escolher} disabled={quadro.enviando}>
          {quadro.enviando ? <LoaderCircle className="animate-spin" /> : <ImageUp />} {quadro.enviando ? "Enviando…" : "Adicionar imagem"}
        </Botao>
      </div>
    </div>
  )
}

/**
 * Com quadro: a imagem inteira (sem corte nem véu) ao lado do timer, com o rótulo e as ações em cima dela.
 * Um toque na imagem, ou "Tela de foco", abre o quadro em tela cheia com o timer embaixo.
 */
export function QuadroNaSessao({ quadro }: { quadro: QuadroDosAlvos }) {
  const { campo, escolher } = useEscolherImagem(quadro.enviar)
  const [confirmar, setConfirmar] = React.useState(false)
  const [telaAberta, setTelaAberta] = React.useState(false)
  const [erroImagem, setErroImagem] = React.useState(false)
  React.useEffect(() => setErroImagem(false), [quadro.url])

  const abrirTela = () => {
    if (!quadro.url) return
    pedirTelaCheia()
    setTelaAberta(true)
  }

  return (
    <figure className="min-w-0">
      {campo}
      <figcaption className="mb-2.5 flex min-h-8 items-center justify-between gap-3">
        <span className="rotulo-hud flex items-center gap-2">
          <Target aria-hidden className="size-3.5 text-estudos" />
          Quadro dos alvos
        </span>
        <span className="flex items-center gap-0.5">
          <Botao variante="fantasma" tamanho="sm" onClick={abrirTela} onPointerEnter={anteciparTelaDeFoco} onFocus={anteciparTelaDeFoco} disabled={!quadro.url}>
            <Maximize2 /> <span className="max-sm:sr-only">Tela de foco</span>
          </Botao>
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="fantasma" tamanho="icone-sm" aria-label="Mais opções do quadro dos alvos" disabled={quadro.enviando || !quadro.caminho}>
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="w-52">
              <MenuItem onSelect={escolher}>
                <ImageUp /> Trocar imagem
              </MenuItem>
              <MenuSeparador />
              <MenuItem perigo onSelect={() => setConfirmar(true)}>
                <Trash2 /> Remover quadro
              </MenuItem>
            </MenuConteudo>
          </Menu>
        </span>
      </figcaption>

      <div className="relative">
        {quadro.url && !erroImagem ? (
          <button
            type="button"
            onClick={abrirTela}
            onPointerEnter={anteciparTelaDeFoco}
            aria-label="Abrir o quadro dos alvos na tela de foco"
            className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-line bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- link temporário do storage, já otimizado no envio */}
            <img src={quadro.url} alt="" onError={() => setErroImagem(true)} className="mx-auto block max-h-[min(60vh,30rem)] w-full object-contain" />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 toque:opacity-100 [&_svg]:size-4"
            >
              <Maximize2 />
            </span>
          </button>
        ) : erroImagem || quadro.erroLink ? (
          <div className="grid aspect-video w-full place-items-center rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-2">
            <div className="grid justify-items-center gap-3">
              Não foi possível carregar o quadro.
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  setErroImagem(false)
                  quadro.tentarDeNovo()
                }}
              >
                Tentar de novo
              </Botao>
            </div>
          </div>
        ) : (
          <Esqueleto className="aspect-video w-full rounded-xl" />
        )}
        {quadro.enviando ? (
          <div className="absolute inset-0 grid place-items-center rounded-xl bg-surface/75 text-sm font-medium" role="status">
            <span className="flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Enviando…
            </span>
          </div>
        ) : null}
      </div>

      <Confirmar
        aberta={confirmar}
        aoMudar={setConfirmar}
        titulo="Remover o quadro dos alvos?"
        descricao="A imagem sai do Flow. Você pode colocar outra quando quiser."
        acao="Remover"
        aoConfirmar={quadro.remover}
      />
      {telaAberta && quadro.url ? <TelaDeFoco url={quadro.url} aoFechar={() => setTelaAberta(false)} /> : null}
    </figure>
  )
}
