"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { AlertTriangle, BookOpen, CloudUpload, FileUp, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { useAtualizar } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { pedirArmazenamentoPersistente, salvarLivroLocal, salvarOriginal } from "./armazenamento"
import type { Progresso } from "./conversor"
import { converterPdfNoNavegador, type ResultadoConversao } from "./converter-no-navegador"
import { useAtualizarDisponibilidade } from "./dados"
import { enviarLivroNuvem } from "./nuvem"

type Livro = Tables<"books">

const ACEITOS = ".pdf,.epub,.mobi,.azw,.azw3,.fb2,.fbz,.cbz,application/pdf,application/epub+zip"
const LIMITE_NUVEM = 50 * 1024 * 1024

type Estado =
  | { fase: "escolher" }
  | { fase: "convertendo"; arquivo: File; progresso: Progresso | null }
  | { fase: "pronto"; arquivo: File; epub: Blob; nome: string; conversao: ResultadoConversao | null }
  | { fase: "salvando" }
  | { fase: "erro"; mensagem: string; digitalizado?: boolean }

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}

function nomeDoArquivo(titulo: string, extensao: string) {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase()
  return `${base || "livro"}.${extensao}`
}

const ETAPAS: Record<Progresso["etapa"], string> = {
  lendo: "Lendo as páginas",
  montando: "Montando parágrafos e capítulos",
  imagens: "Guardando figuras",
  empacotando: "Gerando o livro",
}

export function DialogoArquivo({
  aberta,
  aoMudar,
  livro,
  arquivoInicial,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  livro: Livro
  /** Já começa convertendo este arquivo (usado para converter de novo o PDF guardado). */
  arquivoInicial?: File | null
}) {
  const router = useRouter()
  const [estado, setEstado] = React.useState<Estado>({ fase: "escolher" })
  const [nuvem, setNuvem] = React.useState(true)
  const cancelar = React.useRef<AbortController | null>(null)
  const entrada = React.useRef<HTMLInputElement>(null)
  const atualizarLivro = useAtualizar("books", { silencioso: true })
  const atualizarDisponibilidade = useAtualizarDisponibilidade()

  const escolher = async (arquivo: File) => {
    const ehPdf = arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)
    if (!ehPdf) {
      const extensao = /\.([a-z0-9]+)$/i.exec(arquivo.name)?.[1]?.toLowerCase() ?? "epub"
      setNuvem(arquivo.size <= LIMITE_NUVEM)
      setEstado({ fase: "pronto", arquivo, epub: arquivo, nome: nomeDoArquivo(livro.title, extensao), conversao: null })
      return
    }
    const controle = new AbortController()
    cancelar.current = controle
    setEstado({ fase: "convertendo", arquivo, progresso: null })
    try {
      let ultimo = 0
      const r = await converterPdfNoNavegador(arquivo, {
        titulo: livro.title,
        autor: livro.author ?? undefined,
        identificador: `urn:uuid:${livro.id}`,
        sinal: controle.signal,
        aoProgresso: (p) => {
          // Atualiza a tela no máximo a cada 100 ms
          const agora = performance.now()
          if (agora - ultimo < 100 && p.atual !== p.total) return
          ultimo = agora
          setEstado((e) => (e.fase === "convertendo" ? { ...e, progresso: p } : e))
        },
      })
      const epub = new Blob([r.epub as BlobPart], { type: "application/epub+zip" })
      setNuvem(epub.size <= LIMITE_NUVEM)
      setEstado({ fase: "pronto", arquivo, epub, nome: nomeDoArquivo(livro.title, "epub"), conversao: r })
    } catch (erro) {
      if (controle.signal.aborted) return
      const digitalizado = erro instanceof Error && erro.name === "PdfSemTexto"
      setEstado({
        fase: "erro",
        digitalizado,
        mensagem: erro instanceof Error ? erro.message : "Não foi possível converter este PDF.",
      })
    }
  }

  React.useEffect(() => {
    if (!aberta) {
      cancelar.current?.abort()
      return
    }
    setEstado({ fase: "escolher" })
    if (arquivoInicial) void escolher(arquivoInicial)
    // `escolher` muda a cada renderização; a conversão só deve começar ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, arquivoInicial])

  const salvar = async (lerDepois: boolean) => {
    if (estado.fase !== "pronto") return
    const { arquivo, epub, nome, conversao } = estado
    setEstado({ fase: "salvando" })
    try {
      await salvarLivroLocal({
        id: livro.id,
        arquivo: epub,
        nome,
        tamanho: epub.size,
        origem: conversao ? "pdf" : /\.epub$/i.test(nome) ? "epub" : "outro",
        versaoConversor: conversao?.versao,
        paginasPdf: conversao?.resumo.paginas,
        salvoEm: new Date().toISOString(),
      })
      if (conversao) await salvarOriginal(livro.id, arquivo, arquivo.name).catch(() => {})
      void pedirArmazenamentoPersistente()
    } catch (erro) {
      setEstado({ fase: "erro", mensagem: erro instanceof Error ? erro.message : "Não foi possível guardar o livro neste aparelho." })
      return
    }
    // Com o PDF, o total de páginas passa a ser o dele (a leitura atualiza a página lida sozinha)
    if (conversao && !livro.pages_total) atualizarLivro.mutate({ id: livro.id, pages_total: conversao.resumo.paginas })
    if (nuvem) {
      enviarLivroNuvem(livro.id, epub, nome)
        .then(() => atualizarDisponibilidade())
        .catch((erro) =>
          toast.error("O livro ficou só neste aparelho.", {
            description: erro instanceof Error ? erro.message : "Não foi possível enviar a cópia para a nuvem.",
          }),
        )
    }
    atualizarDisponibilidade()
    aoMudar(false)
    if (lerDepois) router.push(`/ler/${livro.id}`)
    else toast.success("Livro guardado.")
  }

  const p = estado.fase === "convertendo" ? estado.progresso : null
  const fracao = p
    ? p.etapa === "lendo"
      ? (p.atual / Math.max(1, p.total)) * 0.85
      : p.etapa === "imagens"
        ? 0.85 + (p.atual / Math.max(1, p.total)) * 0.12
        : p.etapa === "empacotando"
          ? 0.98
          : 0.86
    : 0

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => {
        if (!v) cancelar.current?.abort()
        aoMudar(v)
      }}
      titulo="Arquivo do livro"
      descricao={estado.fase === "escolher" ? "PDF ou EPUB. O PDF é convertido aqui no aparelho, sem enviar para nenhum servidor." : undefined}
      rodape={
        estado.fase === "pronto" ? (
          <>
            <Botao variante="fantasma" onClick={() => setEstado({ fase: "escolher" })}>
              Descartar
            </Botao>
            <Botao variante="contorno" onClick={() => salvar(false)}>
              Só guardar
            </Botao>
            <Botao variante="primario" onClick={() => salvar(true)}>
              <BookOpen /> Guardar e ler
            </Botao>
          </>
        ) : estado.fase === "convertendo" ? (
          <Botao
            variante="fantasma"
            onClick={() => {
              cancelar.current?.abort()
              setEstado({ fase: "escolher" })
            }}
          >
            Cancelar
          </Botao>
        ) : estado.fase === "erro" ? (
          <Botao variante="contorno" onClick={() => setEstado({ fase: "escolher" })}>
            Escolher outro arquivo
          </Botao>
        ) : null
      }
    >
      {estado.fase === "escolher" ? (
        <div className="grid gap-4">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void escolher(f)
            }}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center hover:border-pen hover:bg-pen-soft/40"
          >
            <FileUp className="size-6 text-pen" />
            <span className="font-medium">Escolher arquivo</span>
            <span className="text-sm text-ink-3">PDF, EPUB, MOBI, AZW3 ou FB2</span>
          </button>
          <input
            ref={entrada}
            type="file"
            accept={ACEITOS}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void escolher(f)
            }}
          />
          <ul className="grid gap-1.5 text-sm text-ink-2">
            <li>O texto se reorganiza na tela: dá para mudar o tamanho da letra, a fonte e as margens.</li>
            <li>PDF digitalizado (foto das páginas) não tem texto para reorganizar; nesse caso, procure a versão em EPUB.</li>
          </ul>
        </div>
      ) : estado.fase === "convertendo" ? (
        <div className="grid gap-3 py-2" aria-live="polite">
          <p className="truncate text-sm font-medium">{estado.arquivo.name}</p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fracao * 100)}
            aria-label="Conversão"
          >
            <div className="h-full rounded-full bg-pen transition-[width] duration-200" style={{ width: `${Math.max(3, fracao * 100)}%` }} />
          </div>
          <p className="tabular text-sm text-ink-2">
            {p ? `${ETAPAS[p.etapa]}${p.etapa === "lendo" || p.etapa === "imagens" ? ` · ${p.atual} de ${p.total}` : ""}` : "Abrindo o PDF"}
          </p>
          <p className="text-xs text-ink-3">Livros grandes levam até um minuto no celular. Mantenha esta tela aberta.</p>
        </div>
      ) : estado.fase === "pronto" ? (
        <Resumo estado={estado} nuvem={nuvem} aoMudarNuvem={setNuvem} />
      ) : estado.fase === "salvando" ? (
        <p className="flex items-center gap-2 py-4 text-sm text-ink-2">
          <LoaderCircle className="size-4 animate-spin" /> Guardando no aparelho…
        </p>
      ) : (
        <div className="grid gap-2 py-1">
          <p className="flex items-start gap-2 font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {estado.mensagem}
          </p>
          {estado.digitalizado ? (
            <p className="text-sm text-ink-2">
              Para ler com o texto se reorganizando, use a versão em EPUB do livro ou passe o PDF por um programa de reconhecimento de texto (OCR) e tente de
              novo.
            </p>
          ) : null}
        </div>
      )}
    </Janela>
  )
}

function Resumo({ estado, nuvem, aoMudarNuvem }: { estado: Extract<Estado, { fase: "pronto" }>; nuvem: boolean; aoMudarNuvem: (v: boolean) => void }) {
  const r = estado.conversao
  const capitulos = (r?.sumario ?? []).filter((s) => s.nivel <= 2)
  // Com partes no topo, os capítulos ficam um nível abaixo delas
  const nivelCapitulo = r?.sumario.some((s) => s.parte) ? 2 : 1
  const totalCapitulos = capitulos.filter((s) => s.nivel === nivelCapitulo).length
  const podeNuvem = estado.epub.size <= LIMITE_NUVEM
  return (
    <div className="grid gap-4">
      {r ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["páginas", r.resumo.paginas],
              ["capítulos", totalCapitulos || r.resumo.capitulos],
              ["palavras", r.resumo.palavras.toLocaleString("pt-BR")],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg bg-surface-2 px-2 py-2.5">
                <dt className="text-xs text-ink-3">{rotulo}</dt>
                <dd className="tabular font-display text-lg font-semibold">{valor}</dd>
              </div>
            ))}
          </dl>
          {r.resumo.imagens || r.resumo.tabelas ? (
            <p className="text-sm text-ink-2">
              {[
                r.resumo.imagens ? `${r.resumo.imagens} ${r.resumo.imagens === 1 ? "figura" : "figuras"}` : "",
                r.resumo.tabelas ? `${r.resumo.tabelas} ${r.resumo.tabelas === 1 ? "tabela" : "tabelas"}` : "",
              ]
                .filter(Boolean)
                .join(" e ")}{" "}
              {r.resumo.imagens + r.resumo.tabelas === 1 ? "mantida" : "mantidas"} no texto.
            </p>
          ) : null}
          {r.resumo.digitalizado ? (
            <p className="flex items-start gap-2 rounded-md bg-estudos-soft px-3 py-2 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-estudos" /> {r.resumo.paginasSemTexto} páginas são imagem, sem texto, e ficaram de fora.
            </p>
          ) : null}
          {capitulos.length ? (
            <div>
              <p className="mb-1.5 text-sm font-medium">Capítulos encontrados</p>
              <ol className="grid max-h-48 gap-1 overflow-y-auto rounded-md border border-line px-3 py-2 text-sm text-ink-2 scrollbar-thin">
                {capitulos.map((c, i) => (
                  <li key={i} className={cn("truncate", c.parte ? "pt-1 font-medium text-ink" : c.nivel > nivelCapitulo && "pl-4 text-ink-3")}>
                    {c.titulo}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-ink-2">Nenhum capítulo foi identificado; o livro fica em partes de tamanho parecido.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">{estado.arquivo.name}</span> pronto para guardar.
        </p>
      )}
      <label className={cn("flex items-start gap-3 rounded-lg border border-line px-3 py-2.5", !podeNuvem && "opacity-60")}>
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--pen)]"
          checked={nuvem && podeNuvem}
          disabled={!podeNuvem}
          onChange={(e) => aoMudarNuvem(e.target.checked)}
        />
        <span className="grid gap-0.5 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <CloudUpload className="size-4 text-ink-3" /> Guardar cópia na nuvem ({tamanhoLegivel(estado.epub.size)})
          </span>
          <span className="text-ink-3">
            {podeNuvem
              ? "Para abrir em outros aparelhos. Sem a cópia, o livro fica só neste aparelho."
              : "Grande demais para o plano gratuito; fica só neste aparelho."}
          </span>
        </span>
      </label>
    </div>
  )
}
