"use client"

import * as React from "react"
import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy, Info, MessageSquareText, Play } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PREFIXO_ARQUIVO, useUrlArquivo } from "@/lib/arquivos"
import { copiarTexto } from "@/lib/copiar"
import { CHAVE_PROMPT } from "@/lib/ia/info"
import { temLinkCurto } from "@/lib/link-curto"
import { marcarMidias } from "@/lib/markdown-midias"
import { cn } from "@/lib/utils"
import { contarVideos, lerMidia, lerVideoDeSite } from "@/lib/videos"
import { LinkDeVideo, MidiaIncorporada } from "@/components/midia"
import { AreaTexto } from "@/components/ui/campos"
import { Segmentos } from "@/components/ui/basicos"
import { partesDoPrompt } from "@/features/conteudo/logica"

function Imagem({ src, alt }: { src?: string; alt?: string }) {
  // Vídeo que o Notion exportou como imagem (![…](video.mp4)) toca como vídeo
  if (src && lerMidia(src)?.fonte === "arquivo") return <MidiaIncorporada endereco={src} />
  return <ImagemComum src={src} alt={alt} />
}

function ImagemComum({ src, alt }: { src?: string; alt?: string }) {
  const caminho = src?.startsWith(PREFIXO_ARQUIVO) ? decodeURIComponent(src.slice(PREFIXO_ARQUIVO.length)) : null
  const { data } = useUrlArquivo(caminho)
  const url = caminho ? data : src
  if (!url) return <span className="block h-40 animate-pulse rounded-md bg-surface-2" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt ?? ""} loading="lazy" decoding="async" />
}

function LinkArquivo({ href, children }: { href: string; children: React.ReactNode }) {
  const caminho = decodeURIComponent(href.slice(PREFIXO_ARQUIVO.length))
  const { data } = useUrlArquivo(caminho)
  return (
    <a href={data ?? "#"} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

/** Acende os campos a preencher de um prompt ([TÓPICO], {número}) no texto de um bloco de código. */
function realcarCampos(no: React.ReactNode): React.ReactNode {
  return React.Children.map(no, (filho) => {
    if (typeof filho === "string") {
      const partes = partesDoPrompt(filho)
      if (!partes.some((p) => p.campo)) return filho
      return partes.map((p, i) => (p.campo ? <span key={i} className="campo-prompt">{p.texto}</span> : p.texto))
    }
    if (React.isValidElement<{ children?: React.ReactNode }>(filho) && filho.props.children !== undefined) {
      return React.cloneElement(filho, undefined, realcarCampos(filho.props.children))
    }
    return filho
  })
}

function BlocoCodigo({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLPreElement>(null)
  const router = useRouter()
  const [copiado, setCopiado] = React.useState(false)
  // O texto copiado e mandado ao assistente é o do bloco, sem as marcações dos campos
  const texto = () => ref.current?.innerText ?? ""

  return (
    <div className="group relative">
      <pre ref={ref}>{realcarCampos(children)}</pre>
      <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={async () => {
            if (!(await copiarTexto(texto()))) return void toast.error("Não foi possível copiar.")
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          }}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink"
        >
          {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(CHAVE_PROMPT, texto())
            } catch {}
            router.push("/conteudo/assistente?usar=1")
          }}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink"
        >
          <MessageSquareText className="size-3.5" />
          Usar no assistente
        </button>
      </div>
    </div>
  )
}

function LinkComum({ href, children }: { href?: string; children: React.ReactNode }) {
  if (href?.startsWith(PREFIXO_ARQUIVO)) return <LinkArquivo href={href}>{children}</LinkArquivo>
  const interno = href?.startsWith("/") && !href.startsWith("//")
  if (interno) return <Link href={href!}>{children}</Link>
  return (
    <a href={href} target={interno ? undefined : "_blank"} rel={interno ? undefined : "noreferrer"}>
      {children}
    </a>
  )
}

const componentes: Components = {
  img: ({ src, alt }) => <ImagemComum src={typeof src === "string" ? src : undefined} alt={alt} />,
  a: ({ href, children }) => <LinkComum href={href}>{children}</LinkComum>,
  pre: ({ children }) => <BlocoCodigo>{children}</BlocoCodigo>,
}

/** Com os vídeos tocando no próprio texto (ver `marcarMidias`). */
const componentesComVideos: Components = {
  ...componentes,
  img: ({ src, alt }) => <Imagem src={typeof src === "string" ? src : undefined} alt={alt} />,
  a: ({ href, children }) =>
    href && lerVideoDeSite(href) ? <LinkDeVideo href={href}>{children}</LinkDeVideo> : <LinkComum href={href}>{children}</LinkComum>,
  figure: ({ node, children, ...resto }) => {
    const endereco = node?.properties?.dataMidia
    const legenda = node?.properties?.dataLegenda
    if (typeof endereco === "string") return <MidiaIncorporada endereco={endereco} legenda={typeof legenda === "string" ? legenda : null} />
    return <figure {...resto}>{children}</figure>
  },
}

const PLUGINS_VIDEOS = [marcarMidias]

function permitirUrl(url: string) {
  if (url.startsWith(PREFIXO_ARQUIVO)) return url
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return url
  return ""
}

/** Marca ou desmarca a caixa "- [ ]" do item de lista que começa em `inicio`. */
export function alternarTarefa(texto: string, inicio: number): string {
  const resto = texto.slice(inicio)
  const m = /\[( |x|X)\]/.exec(resto)
  if (!m || resto.slice(0, m.index).includes("\n")) return texto
  const pos = inicio + m.index
  return texto.slice(0, pos) + (m[1] === " " ? "[x]" : "[ ]") + texto.slice(pos + 3)
}

export const Markdown = React.memo(function Markdown({
  texto,
  className,
  aoMudar,
  videos = true,
}: {
  texto: string | null | undefined
  className?: string
  /** Quando informado, as caixas de seleção ficam clicáveis e devolvem o texto atualizado. */
  aoMudar?: (texto: string) => void
  /** Links de vídeo (YouTube, Instagram, TikTok, Facebook, arquivos) tocam no próprio texto. Desligar em prévias curtas. */
  videos?: boolean
}) {
  const comps = React.useMemo<Components>(() => {
    const base = videos ? componentesComVideos : componentes
    if (!aoMudar || !texto) return base
    return {
      ...base,
      li: ({ node, className: cls, children, ...resto }) => {
        const inicio = node?.position?.start.offset
        if (!String(cls ?? "").includes("task-list-item") || inicio === undefined) return <li className={cls} {...resto}>{children}</li>
        return (
          <li
            className={cn(cls, "cursor-pointer")}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) return
              aoMudar(alternarTarefa(texto, inicio))
            }}
            {...resto}
          >
            {children}
          </li>
        )
      },
      input: ({ node, ...props }) => (void node, props.type === "checkbox" ? <input {...props} disabled={false} readOnly className="cursor-pointer" /> : <input {...props} />),
    }
  }, [aoMudar, texto, videos])
  if (!texto?.trim()) return null
  return (
    <div className={cn("prosa", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={videos ? PLUGINS_VIDEOS : undefined} components={comps} urlTransform={permitirUrl}>
        {texto}
      </ReactMarkdown>
    </div>
  )
})

/** Editor simples: escrever em markdown e ver como fica. Salva ao sair do campo. */
export function EditorMarkdown({
  valor,
  aoSalvar,
  placeholder = "Escreva aqui. Aceita markdown: # títulos, **negrito**, - listas, [links](https://…)",
  rotulo,
  inicioEditando,
}: {
  valor: string
  aoSalvar: (v: string) => void
  placeholder?: string
  rotulo: string
  inicioEditando?: boolean
}) {
  const [modo, setModo] = React.useState<"ver" | "editar">(inicioEditando || !valor.trim() ? "editar" : "ver")
  const [texto, setTexto] = React.useState(valor)
  React.useEffect(() => setTexto(valor), [valor])

  const salvar = () => {
    if (texto !== valor) aoSalvar(texto)
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Segmentos
          rotulo={`Modo de ${rotulo}`}
          valor={modo}
          aoMudar={(m) => {
            if (m === "ver") salvar()
            setModo(m)
          }}
          opcoes={[
            { valor: "ver", rotulo: "Ler" },
            { valor: "editar", rotulo: "Editar" },
          ]}
        />
      </div>
      {modo === "editar" ? (
        <>
          <AreaTexto
            aria-label={rotulo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={salvar}
            placeholder={placeholder}
            className="min-h-72 font-mono text-[13px]"
          />
          {contarVideos(texto) ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-3">
              <Play aria-hidden className="mt-[3px] size-3 shrink-0" />
              Vídeos do YouTube, Instagram, TikTok e Facebook tocam aqui no modo Ler. O link sozinho na linha vira player.
            </p>
          ) : null}
          {temLinkCurto(texto) ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-3">
              <Info aria-hidden className="mt-[3px] size-3 shrink-0" />
              Links de compartilhar (facebook.com/share/…, fb.watch, vm.tiktok.com) não tocam aqui: abra o link no navegador e cole o endereço do vídeo.
            </p>
          ) : null}
        </>
      ) : texto.trim() ? (
        <Markdown
          texto={texto}
          aoMudar={(novo) => {
            setTexto(novo)
            aoSalvar(novo)
          }}
        />
      ) : (
        <p className="text-sm text-ink-3">Nada escrito ainda.</p>
      )}
    </div>
  )
}
