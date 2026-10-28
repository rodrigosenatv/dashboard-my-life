"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Check, LoaderCircle, PencilLine, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { novoId, useCriar } from "@/lib/data"
import { cn } from "@/lib/utils"
import { BuscaOcupada, buscarLivros, capaParaGuardar } from "./catalogo"
import { CapaGerada } from "./capa"
import type { Livro } from "./dados"
import { categorias as categoriasDe, diaIso, normalizarTitulo, plural, type ResultadoLivro } from "./logica"

type Situacao = "desejo" | "lendo" | "finalizado"

const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "desejo", rotulo: "Quero ler" },
  { valor: "lendo", rotulo: "Estou lendo" },
  { valor: "finalizado", rotulo: "Já li" },
]

/** A capa de um resultado da busca (ou a gerada pelo título, quando a busca não tem). */
export function CapaDoResultado({ resultado: r, className }: { resultado: Pick<ResultadoLivro, "chave" | "titulo" | "autores" | "capa">; className?: string }) {
  const [falhou, setFalhou] = React.useState(false)
  const livro = { id: r.chave, title: r.titulo, author: r.autores[0] ?? null, category: null, cover_path: null, pages_total: null }
  return (
    <span className={cn("capa-em-pe block aspect-[2/3] shrink-0", className)}>
      <span className="capa-imagem block size-full">
        {r.capa && !falhou ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.capa} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} className="size-full object-cover" />
        ) : (
          <CapaGerada livro={livro} />
        )}
      </span>
    </span>
  )
}

/** Busca com espera: só pergunta depois que a pessoa para de digitar. */
export function useBuscaDeLivros(termo: string) {
  const [consulta, setConsulta] = React.useState("")
  React.useEffect(() => {
    const t = setTimeout(() => setConsulta(termo.trim()), 380)
    return () => clearTimeout(t)
  }, [termo])
  const q = useQuery({
    queryKey: ["busca-livros", consulta],
    enabled: consulta.length >= 2,
    staleTime: 10 * 60_000,
    retry: 0,
    meta: { silencioso: true },
    queryFn: ({ signal }) => buscarLivros(consulta, { sinal: signal }),
  })
  return { ...q, consulta, esperando: termo.trim() !== consulta || q.isFetching }
}

/**
 * Adicionar livro: busca pelo nome, autor ou ISBN (com capa, autor e páginas), escolhe a situação e
 * a categoria, e pronto. Quem não acha o livro cadastra à mão.
 */
export function JanelaAdicionarLivro({
  aberta,
  aoMudar,
  livros,
  situacaoInicial = "desejo",
  aoCadastrarAMao,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  livros: Livro[]
  situacaoInicial?: Situacao
  aoCadastrarAMao: (titulo: string) => void
}) {
  const router = useRouter()
  const criar = useCriar("books")
  const [termo, setTermo] = React.useState("")
  const [escolhido, setEscolhido] = React.useState<ResultadoLivro | null>(null)
  const [situacao, setSituacao] = React.useState<Situacao>(situacaoInicial)
  const [categoria, setCategoria] = React.useState("")
  const [ano, setAno] = React.useState(String(new Date().getFullYear()))
  const [salvando, setSalvando] = React.useState(false)
  const busca = useBuscaDeLivros(termo)
  const campo = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!aberta) return
    setTermo("")
    setEscolhido(null)
    setSituacao(situacaoInicial)
    setCategoria("")
    setAno(String(new Date().getFullYear()))
    setSalvando(false)
  }, [aberta, situacaoInicial])

  const existentes = React.useMemo(() => new Map(livros.map((l) => [normalizarTitulo(l.title), l])), [livros])
  const sugestoes = React.useMemo(() => categoriasDe(livros), [livros])
  const jaTem = (r: ResultadoLivro) => existentes.get(normalizarTitulo(r.titulo)) ?? null

  const adicionar = async () => {
    if (!escolhido || salvando) return
    setSalvando(true)
    const r = escolhido
    let capa: string | null = null
    try {
      capa = await capaParaGuardar(r)
    } catch {
      capa = r.capa
    }
    const hoje = diaIso()
    const anoLido = Math.max(1900, Math.min(new Date().getFullYear(), Number(ano) || new Date().getFullYear()))
    const id = novoId()
    criar.mutate({
      id,
      title: r.titulo,
      author: r.autores.join(", ") || null,
      category: categoria.trim() || null,
      status: situacao,
      pages_total: r.paginas,
      pages_read: situacao === "finalizado" ? (r.paginas ?? 0) : 0,
      started_at: situacao === "lendo" ? hoje : null,
      finished_at: situacao === "finalizado" && anoLido === new Date().getFullYear() ? hoje : null,
      read_years: situacao === "finalizado" ? [anoLido] : [],
      cover_path: capa,
    })
    aoMudar(false)
    toast.success(`“${r.titulo}” está na biblioteca.`, { action: { label: "Abrir", onClick: () => router.push(`/estudos/leitura/${id}`) } })
  }

  const erro = busca.error instanceof BuscaOcupada ? busca.error.message : busca.error ? "Não deu para buscar agora. Confira a internet e tente de novo." : null
  const resultados = busca.data ?? []

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={escolhido ? "Adicionar à biblioteca" : "Adicionar livro"}
      descricao={escolhido ? undefined : "Busque pelo nome, autor ou ISBN: a capa, o autor e as páginas vêm junto."}
      largura="md"
      className="tema-biblioteca"
      rodape={
        escolhido ? (
          <>
            <Botao variante="fantasma" className="mr-auto" onClick={() => setEscolhido(null)}>
              <ArrowLeft /> Voltar
            </Botao>
            <Botao variante="primario" onClick={() => void adicionar()} disabled={salvando}>
              {salvando ? <LoaderCircle className="animate-spin" /> : <Check />} Adicionar
            </Botao>
          </>
        ) : (
          <Botao variante="fantasma" className="mr-auto" onClick={() => aoCadastrarAMao(termo.trim())}>
            <PencilLine /> Cadastrar sem buscar
          </Botao>
        )
      }
    >
      {escolhido ? (
        <div className="grid gap-5">
          <div className="flex gap-4">
            <CapaDoResultado resultado={escolhido} className="w-24 sm:w-28" />
            <div className="min-w-0 self-center">
              <p className="font-display text-xl font-semibold leading-tight">{escolhido.titulo}</p>
              {escolhido.subtitulo ? <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{escolhido.subtitulo}</p> : null}
              {escolhido.autores.length ? <p className="mt-1.5 text-sm text-ink-2">{escolhido.autores.join(", ")}</p> : null}
              <p className="mt-1 text-xs text-ink-3">{[escolhido.ano, escolhido.paginas ? plural(escolhido.paginas, "página") : null, escolhido.editora].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          {jaTem(escolhido) ? (
            <p className="rounded-lg border border-[var(--b-ambar)]/35 bg-[var(--b-ambar)]/10 px-3 py-2 text-sm text-ink">
              Um livro com esse nome já está na biblioteca. Adicionar mesmo assim cria outro.
            </p>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-ink-2">Situação</legend>
            <div role="radiogroup" aria-label="Situação" className="grid grid-cols-3 gap-2">
              {SITUACOES.map((s) => (
                <button
                  key={s.valor}
                  type="button"
                  role="radio"
                  aria-checked={situacao === s.valor}
                  onClick={() => setSituacao(s.valor)}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors",
                    situacao === s.valor ? "border-[var(--b-luz)] bg-[var(--b-luz)]/12 text-ink" : "border-line-strong text-ink-2 hover:text-ink",
                  )}
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
          </fieldset>
          {situacao === "finalizado" ? (
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              Ano em que leu
              <input
                inputMode="numeric"
                value={ano}
                onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="tabular h-10 w-24 rounded-md border border-line-strong bg-surface px-2 text-center text-ink focus-visible:border-pen focus-visible:outline-none toque:h-11 toque:text-[16px]"
              />
            </label>
          ) : null}
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-ink-2">Categoria</span>
            <input
              list="categorias-livros"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder={sugestoes[0] ?? "Desenvolvimento Pessoal"}
              className="h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none toque:h-11 toque:text-[16px]"
            />
            <datalist id="categorias-livros">
              {sugestoes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {sugestoes.length ? (
              <span className="flex flex-wrap gap-1.5 pt-1">
                {sugestoes.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoria(c)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", categoria === c ? "border-[var(--b-luz)] text-ink" : "border-line text-ink-3 hover:text-ink")}
                  >
                    {c}
                  </button>
                ))}
              </span>
            ) : null}
          </label>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              ref={campo}
              autoFocus
              type="search"
              enterKeyHint="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Ex.: Hábitos Atômicos, James Clear"
              aria-label="Buscar livro"
              className="h-12 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-10 text-[16px] text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none"
            />
            {termo ? (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => {
                  setTermo("")
                  campo.current?.focus()
                }}
                className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          <div aria-live="polite" className="min-h-6 text-sm text-ink-3">
            {termo.trim().length < 2
              ? "Digite pelo menos duas letras."
              : busca.esperando
                ? (
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden /> Buscando…
                  </span>
                )
                : erro
                  ? erro
                  : resultados.length
                    ? `${plural(resultados.length, "resultado")}`
                    : "Nada encontrado. Tente outro nome ou cadastre sem buscar."}
          </div>

          {!busca.esperando && resultados.length ? (
            <ul className="-mx-2 grid gap-1">
              {resultados.map((r) => {
                const repetido = jaTem(r)
                return (
                  <li key={r.chave}>
                    <button
                      type="button"
                      onClick={() => setEscolhido(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink/[0.05] focus-visible:bg-ink/[0.05] focus-visible:outline-none"
                    >
                      <CapaDoResultado resultado={r} className="w-11" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 font-medium leading-snug text-ink">{r.titulo}</span>
                        <span className="mt-0.5 block truncate text-sm text-ink-2">{r.autores.join(", ") || "Autor desconhecido"}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">
                          {[r.ano, r.paginas ? plural(r.paginas, "página") : null, repetido ? "já na biblioteca" : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      )}
    </Janela>
  )
}
