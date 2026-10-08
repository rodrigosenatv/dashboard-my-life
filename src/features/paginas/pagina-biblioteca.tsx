"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Check, Copy, MessageSquareText, Search } from "lucide-react"
import { Segmentos, Carregando, Vazio } from "@/components/ui/basicos"
import { CHAVE_PROMPT } from "@/components/markdown"
import { useLista } from "@/lib/data"
import { cn, contem } from "@/lib/utils"
import { ListaPaginas } from "./lista-paginas"

const SECOES_BIBLIOTECA = ["biblioteca", "planner"]

type Prompt = { chave: string; paginaId: string; pagina: string; modulo: string; titulo: string; texto: string }

/** Tira os blocos de código (os prompts) do markdown, com o título mais próximo acima de cada um. */
export function extrairPrompts(conteudo: string): { titulo: string; texto: string }[] {
  const saida: { titulo: string; texto: string }[] = []
  let titulo = ""
  let bloco: string[] | null = null
  let cerca = ""
  for (const linha of conteudo.split("\n")) {
    const crua = linha.trim()
    if (bloco) {
      if (crua.startsWith(cerca)) {
        const texto = bloco.join("\n").trim()
        if (texto.length >= 30) saida.push({ titulo, texto })
        bloco = null
      } else bloco.push(linha)
      continue
    }
    const abre = /^(`{3,}|~{3,})/.exec(crua)
    if (abre) {
      cerca = abre[1]
      bloco = []
      continue
    }
    const cab = /^#{1,6}\s+(.+)$/.exec(crua) ?? /^<summary>(.+)<\/summary>$/.exec(crua) ?? /^\*\*(.+)\*\*:?$/.exec(crua)
    if (cab) titulo = cab[1].replace(/<[^>]+>/g, "").replace(/\*\*/g, "").trim()
  }
  return saida
}

function CartaoPrompt({ p }: { p: Prompt }) {
  const router = useRouter()
  const [copiado, setCopiado] = React.useState(false)
  const [aberto, setAberto] = React.useState(false)
  const longo = p.texto.length > 420 || p.texto.split("\n").length > 7

  return (
    <li className="flex flex-col rounded-lg border border-line bg-surface p-4">
      <p className="text-xs text-ink-3">
        <Link href={`/paginas/${p.paginaId}`} className="hover:text-ink hover:underline">
          {p.pagina}
        </Link>
      </p>
      {p.titulo ? <p className="mt-0.5 font-medium leading-snug">{p.titulo}</p> : null}
      <pre className={cn("mt-2 whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-ink-2", !aberto && longo && "line-clamp-6")}>{p.texto}</pre>
      {longo ? (
        <button type="button" onClick={() => setAberto((a) => !a)} className="mt-1 self-start text-xs font-medium text-pen hover:underline">
          {aberto ? "Mostrar menos" : "Ver prompt inteiro"}
        </button>
      ) : null}
      <div className="mt-auto flex gap-1.5 pt-3">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(p.texto)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          }}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink"
        >
          {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(CHAVE_PROMPT, p.texto)
            } catch {}
            router.push("/conteudo/assistente?usar=1")
          }}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink"
        >
          <MessageSquareText className="size-3.5" /> Usar no assistente
        </button>
      </div>
    </li>
  )
}

function Prompts() {
  const { data: paginas = [], isLoading } = useLista("pages", {
    colunas: "id,title,content,parent_id,section",
    filtro: (q) => q.in("section", SECOES_BIBLIOTECA),
    chave: ["prompts-biblioteca"],
  })
  const [busca, setBusca] = React.useState("")
  const [modulo, setModulo] = React.useState("")
  const [limite, setLimite] = React.useState(60)

  const prompts = React.useMemo(() => {
    const porId = new Map(paginas.map((p) => [p.id, p]))
    // Módulo = página de primeiro nível da biblioteca acima desta.
    const raiz = (id: string) => {
      let atual = porId.get(id)
      for (let i = 0; atual?.parent_id && porId.has(atual.parent_id) && i < 20; i++) atual = porId.get(atual.parent_id)
      return atual?.title ?? ""
    }
    const lista: Prompt[] = []
    for (const p of paginas) {
      if (!p.content?.includes("```") && !p.content?.includes("~~~")) continue
      extrairPrompts(p.content).forEach((x, i) => lista.push({ chave: `${p.id}-${i}`, paginaId: p.id, pagina: p.title || "Sem título", modulo: raiz(p.id), ...x }))
    }
    return lista
  }, [paginas])

  const modulos = React.useMemo(() => [...new Set(prompts.map((p) => p.modulo))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })), [prompts])
  const visiveis = prompts.filter((p) => (!modulo || p.modulo === modulo) && (!busca || contem(`${p.pagina} ${p.titulo} ${p.texto}`, busca)))

  if (isLoading) return <Carregando />
  if (!prompts.length)
    return <Vazio titulo="Nenhum prompt encontrado." descricao="Os blocos de código das páginas da Biblioteca e do Planner aparecem aqui, prontos para copiar." />

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setLimite(60)
            }}
            placeholder="Buscar nos prompts"
            aria-label="Buscar nos prompts"
            className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none"
          />
        </div>
        {modulos.length > 1 ? (
          <select
            value={modulo}
            onChange={(e) => {
              setModulo(e.target.value)
              setLimite(60)
            }}
            aria-label="Módulo"
            className="h-9 max-w-full rounded-md border border-line-strong bg-surface px-2 text-sm"
          >
            <option value="">Todos os módulos</option>
            {modulos.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        ) : null}
        <span className="tabular text-sm text-ink-3">
          {visiveis.length} {visiveis.length === 1 ? "prompt" : "prompts"}
        </span>
      </div>
      {visiveis.length === 0 ? (
        <p className="text-sm text-ink-2">Nenhum prompt com esse texto.</p>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visiveis.slice(0, limite).map((p) => (
              <CartaoPrompt key={p.chave} p={p} />
            ))}
          </ul>
          {visiveis.length > limite ? (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => setLimite((l) => l + 60)} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:text-ink">
                Mostrar mais {Math.min(60, visiveis.length - limite)}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export function PaginaBiblioteca() {
  const [aba, setAba] = React.useState<"paginas" | "prompts">("paginas")
  return (
    <ListaPaginas
      area="conteudo"
      titulo="Biblioteca"
      descricao="Cursos, módulos e prompts. Em qualquer bloco de prompt você pode copiar ou mandar direto para o assistente."
      secoes={SECOES_BIBLIOTECA}
      secaoNova="biblioteca"
      topo={
        <Segmentos
          rotulo="O que ver na biblioteca"
          className="mb-6"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "paginas", rotulo: "Páginas" },
            { valor: "prompts", rotulo: "Prompts" },
          ]}
        />
      }
      substituir={aba === "prompts" ? <Prompts /> : undefined}
    />
  )
}

