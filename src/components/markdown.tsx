"use client"

import * as React from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy, MessageSquareText } from "lucide-react"
import { useRouter } from "next/navigation"
import { PREFIXO_ARQUIVO, useUrlArquivo } from "@/lib/arquivos"
import { CHAVE_PROMPT } from "@/lib/ia/info"
import { cn } from "@/lib/utils"
import { AreaTexto } from "@/components/ui/campos"
import { Segmentos } from "@/components/ui/basicos"

function Imagem({ src, alt }: { src?: string; alt?: string }) {
  const caminho = src?.startsWith(PREFIXO_ARQUIVO) ? decodeURIComponent(src.slice(PREFIXO_ARQUIVO.length)) : null
  const { data } = useUrlArquivo(caminho)
  const url = caminho ? data : src
  if (!url) return <span className="block h-40 animate-pulse rounded-md bg-surface-2" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt ?? ""} loading="lazy" />
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

function BlocoCodigo({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLPreElement>(null)
  const router = useRouter()
  const [copiado, setCopiado] = React.useState(false)
  const texto = () => ref.current?.innerText ?? ""

  return (
    <div className="group relative">
      <pre ref={ref}>{children}</pre>
      <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(texto())
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

const componentes: Components = {
  img: ({ src, alt }) => <Imagem src={typeof src === "string" ? src : undefined} alt={alt} />,
  a: ({ href, children }) => {
    if (href?.startsWith(PREFIXO_ARQUIVO)) return <LinkArquivo href={href}>{children}</LinkArquivo>
    const interno = href?.startsWith("/")
    return (
      <a href={href} target={interno ? undefined : "_blank"} rel={interno ? undefined : "noreferrer"}>
        {children}
      </a>
    )
  },
  pre: ({ children }) => <BlocoCodigo>{children}</BlocoCodigo>,
}

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

export function Markdown({
  texto,
  className,
  aoMudar,
}: {
  texto: string | null | undefined
  className?: string
  /** Quando informado, as caixas de seleção ficam clicáveis e devolvem o texto atualizado. */
  aoMudar?: (texto: string) => void
}) {
  const comps = React.useMemo<Components>(() => {
    if (!aoMudar || !texto) return componentes
    return {
      ...componentes,
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
  }, [aoMudar, texto])
  if (!texto?.trim()) return null
  return (
    <div className={cn("prosa", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={comps} urlTransform={permitirUrl}>
        {texto}
      </ReactMarkdown>
    </div>
  )
}

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
        <AreaTexto
          aria-label={rotulo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvar}
          placeholder={placeholder}
          className="min-h-72 font-mono text-[13px]"
        />
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
