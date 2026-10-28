"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Braces, Check, Copy, MessageSquareText, Search, SquareTerminal, X } from "lucide-react"
import { toast } from "sonner"
import { Segmentos, Carregando } from "@/components/ui/basicos"
import { VazioCerebro } from "@/features/segundo-cerebro/ui"
import { copiarTexto } from "@/lib/copiar"
import { CHAVE_PROMPT } from "@/lib/ia/info"
import { cn, contem } from "@/lib/utils"
import { camposDoPrompt } from "@/features/conteudo/logica"
import { TextoPrompt } from "@/features/conteudo/texto-prompt"
import { ListaPaginas } from "./lista-paginas"
import { SECOES_BIBLIOTECA, usePromptsBiblioteca, type Prompt } from "./prompts"

function CartaoPrompt({ p }: { p: Prompt }) {
  const router = useRouter()
  const [copiado, setCopiado] = React.useState(false)
  const [aberto, setAberto] = React.useState(false)
  const longo = p.texto.length > 420 || p.texto.split("\n").length > 8
  const campos = camposDoPrompt(p.texto)
  const origem = p.modulo && p.modulo !== p.pagina ? `${p.modulo} › ${p.pagina}` : p.pagina

  return (
    <li className="vidro-vivo flex min-w-0 flex-col p-4">
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
        <SquareTerminal className="size-3.5 shrink-0 text-[var(--b-luz)]" aria-hidden />
        <Link href={`/paginas/${p.paginaId}`} className="min-w-0 truncate hover:text-ink hover:underline" title={origem}>
          {origem}
        </Link>
      </p>
      {p.titulo ? <p className="mt-1.5 font-display font-semibold leading-snug">{p.titulo}</p> : null}
      {/* A tela do prompt: uma barra de terminal com quantos campos há para preencher */}
      <div className="relative mt-3 overflow-hidden rounded-xl border border-[var(--b-borda)] bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--b-borda)] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--b-luz)]" />
            prompt
          </span>
          {campos.length ? (
            <span className="inline-flex items-center gap-1 normal-case tracking-normal" title={campos.join(", ")}>
              <Braces className="size-3 text-[var(--b-luz-2)]" aria-hidden />
              {campos.length === 1 ? "1 campo" : `${campos.length} campos`}
            </span>
          ) : null}
        </div>
        <pre className={cn("whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink-2", longo && !aberto && "max-h-48")}>
          <TextoPrompt texto={p.texto} />
        </pre>
        {longo && !aberto ? <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[var(--surface)] to-transparent" /> : null}
      </div>
      {longo ? (
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="mt-1.5 inline-flex min-h-8 self-start items-center rounded-full px-1 text-xs font-medium text-[var(--b-luz)] hover:underline toque:min-h-10">
          {aberto ? "Mostrar menos" : "Ver prompt inteiro"}
        </button>
      ) : null}
      <div className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] gap-2 pt-3">
        <button
          type="button"
          onClick={async () => {
            if (!(await copiarTexto(p.texto))) return void toast.error("Não foi possível copiar.")
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--b-borda)] px-3 text-xs font-medium text-ink-2 transition-colors hover:border-[var(--b-borda-2)] hover:text-ink toque:min-h-10"
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
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[var(--b-luz)]/45 bg-[var(--b-luz)]/[0.1] px-3 text-xs font-semibold text-ink transition-colors hover:border-[var(--b-luz)] hover:bg-[var(--b-luz)]/[0.18] toque:min-h-10"
        >
          <MessageSquareText className="size-3.5 text-[var(--b-luz)]" /> Usar no assistente
        </button>
      </div>
    </li>
  )
}

function Prompts({ prompts, carregando }: { prompts: Prompt[]; carregando: boolean }) {
  const [busca, setBusca] = React.useState("")
  const [modulo, setModulo] = React.useState("")
  const [limite, setLimite] = React.useState(60)

  const modulos = React.useMemo(() => [...new Set(prompts.map((p) => p.modulo))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })), [prompts])
  const visiveis = prompts.filter((p) => (!modulo || p.modulo === modulo) && (!busca || contem(`${p.modulo} ${p.pagina} ${p.titulo} ${p.texto}`, busca)))

  if (carregando) return <Carregando />
  if (!prompts.length)
    return <VazioCerebro icone={SquareTerminal} titulo="Nenhum prompt encontrado." descricao="Os blocos de código das páginas da Biblioteca e do Planner aparecem aqui, prontos para copiar." />

  return (
    <div>
      <div className="vidro mb-6 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setLimite(60)
            }}
            placeholder="Buscar nos prompts"
            aria-label="Buscar nos prompts"
            className="h-11 w-full rounded-full border border-[var(--b-borda)] bg-surface pl-10 pr-10 text-base placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm"
          />
          {busca ? (
            <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-ink-2">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {modulos.length > 1 ? (
            <select
              value={modulo}
              onChange={(e) => {
                setModulo(e.target.value)
                setLimite(60)
              }}
              aria-label="Módulo"
              className="h-11 min-w-0 flex-1 rounded-full border border-[var(--b-borda)] bg-surface px-4 text-sm sm:w-64 sm:flex-none"
            >
              <option value="">Todos os módulos</option>
              {modulos.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          ) : null}
          <span className="tabular shrink-0 text-xs font-medium text-ink-3 sm:text-sm" aria-live="polite">
            {visiveis.length} {visiveis.length === 1 ? "prompt" : "prompts"}
          </span>
        </div>
      </div>
      {visiveis.length === 0 ? (
        <VazioCerebro
          icone={Search}
          titulo="Nenhum prompt com esse texto."
          descricao="Experimente outra palavra ou outro módulo."
          acao={
            <button
              type="button"
              onClick={() => {
                setBusca("")
                setModulo("")
              }}
              className="inline-flex min-h-10 items-center rounded-full border border-[var(--b-borda-2)] px-4 text-sm font-medium hover:border-[var(--b-luz)]"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visiveis.slice(0, limite).map((p) => (
              <CartaoPrompt key={p.chave} p={p} />
            ))}
          </ul>
          {visiveis.length > limite ? (
            <div className="mt-5 flex justify-center">
              <button type="button" onClick={() => setLimite((l) => l + 60)} className="inline-flex min-h-10 items-center rounded-full border border-[var(--b-borda-2)] px-4 text-sm font-medium text-ink-2 hover:border-[var(--b-luz)] hover:text-ink">
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
  const { prompts, isLoading } = usePromptsBiblioteca(aba === "prompts")
  return (
    <ListaPaginas
      area="conteudo"
      titulo="Biblioteca"
      descricao="Cursos, módulos e prompts. Em qualquer bloco de prompt você pode copiar ou mandar direto para o assistente."
      secoes={SECOES_BIBLIOTECA}
      secaoNova="biblioteca"
      cursos
      hudExtra={prompts.length ? [{ n: prompts.length, rotulo: "prompts", cor: "var(--b-violeta)" }] : []}
      topo={
        <Segmentos
          rotulo="O que ver na biblioteca"
          className="mb-6 rounded-full border border-[var(--b-borda)] bg-surface p-1 [&>button]:rounded-full [&>button]:px-4"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "paginas", rotulo: "Páginas e cursos" },
            { valor: "prompts", rotulo: "Prompts", ...(prompts.length ? { contagem: prompts.length } : {}) },
          ]}
        />
      }
      substituir={aba === "prompts" ? <Prompts prompts={prompts} carregando={isLoading} /> : undefined}
    />
  )
}
