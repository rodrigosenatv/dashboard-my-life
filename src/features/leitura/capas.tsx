"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, ImageOff, LoaderCircle, Search } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { supabase } from "@/lib/supabase/client"
import type { TablesUpdate } from "@/lib/supabase/database.types"
import { useAtualizar } from "@/lib/data"
import { BuscaOcupada, buscarLivros, capaParaGuardar, esperar } from "./catalogo"
import { CapaDoResultado, useBuscaDeLivros } from "./adicionar"
import { apagarCapasEnviadas, avisarFalhaCapa, enviarCapaDoLivro, type Livro } from "./dados"
import { escolherResultado, plural, type ResultadoLivro } from "./logica"

/* ------------------------------------------------------------------ */
/* Buscar as capas dos livros que ainda não têm                        */
/* ------------------------------------------------------------------ */

/** Livros que a busca automática já tentou e não achou (neste aparelho): não tenta de novo sozinha. */
const CHAVE_TENTADAS = "leitura:capas-tentadas"

function lerTentadas(): Set<string> {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_TENTADAS) ?? "[]")
    return new Set(Array.isArray(bruto) ? bruto.filter((x) => typeof x === "string") : [])
  } catch {
    return new Set()
  }
}

function guardarTentadas(ids: Set<string>) {
  try {
    localStorage.setItem(CHAVE_TENTADAS, JSON.stringify([...ids].slice(-2000)))
  } catch {
    // sem armazenamento: tenta de novo na próxima vez
  }
}

/** Os livros sem capa que a busca ainda não tentou. */
export function semCapaPendente(livros: Livro[]): Livro[] {
  const tentadas = typeof window === "undefined" ? new Set<string>() : lerTentadas()
  return livros.filter((l) => !l.cover_path && !tentadas.has(l.id))
}

/**
 * Busca, um por um, a capa dos livros sem capa. Quando acha o livro certo, guarda a capa e, se faltar,
 * o autor e o número de páginas. Os que não acha ficam marcados para escolher à mão.
 */
export function useBuscarCapas() {
  const qc = useQueryClient()
  const [estado, setEstado] = React.useState({ rodando: false, feitos: 0, total: 0, achadas: 0 })
  const parar = React.useRef(false)

  const buscar = React.useCallback(
    async (lista: Livro[]) => {
      if (!lista.length) return
      parar.current = false
      setEstado({ rodando: true, feitos: 0, total: lista.length, achadas: 0 })
      const tentadas = lerTentadas()
      let achadas = 0
      let interrompeu = false
      for (const [i, l] of lista.entries()) {
        if (parar.current) break
        try {
          let resultados: ResultadoLivro[] = []
          try {
            resultados = await buscarLivros(`${l.title} ${l.author ?? ""}`.trim(), { max: 8 })
          } catch (e) {
            if (!(e instanceof BuscaOcupada)) throw e
            // O Google pediu uma pausa: espera e tenta mais uma vez
            await esperar(4000)
            resultados = await buscarLivros(`${l.title} ${l.author ?? ""}`.trim(), { max: 8 })
          }
          const r = escolherResultado(l, resultados)
          const capa = r ? await capaParaGuardar(r) : null
          if (r && capa) {
            const patch: TablesUpdate<"books"> = { cover_path: capa }
            if (!l.author?.trim() && r.autores.length) patch.author = r.autores.join(", ")
            if (!l.pages_total && r.paginas) patch.pages_total = r.paginas
            const { error } = await supabase().from("books").update(patch).eq("id", l.id)
            if (error) throw new Error(error.message)
            // A capa aparece na hora, sem esperar o fim da busca
            qc.setQueriesData<Livro[]>({ queryKey: ["books"] }, (atual) => (Array.isArray(atual) ? atual.map((x) => (x.id === l.id ? { ...x, ...patch } : x)) : atual))
            achadas++
          } else {
            tentadas.add(l.id)
          }
        } catch (e) {
          if (e instanceof BuscaOcupada) {
            interrompeu = true
            break
          }
          tentadas.add(l.id)
        }
        setEstado({ rodando: true, feitos: i + 1, total: lista.length, achadas })
        await esperar(300)
      }
      guardarTentadas(tentadas)
      setEstado((s) => ({ ...s, rodando: false }))
      void qc.invalidateQueries({ queryKey: ["books"] })
      if (interrompeu) toast("A busca de capas fez uma pausa.", { description: "O Google pediu um tempo. Tente de novo daqui a pouco: ela continua de onde parou." })
      else toast.success(achadas ? `${plural(achadas, "capa encontrada", "capas encontradas")}.` : "Nenhuma capa nova encontrada.", {
        description: achadas < lista.length ? "As que faltaram dá para escolher na página de cada livro." : undefined,
      })
    },
    [qc],
  )

  return { ...estado, buscar, parar: () => (parar.current = true) }
}

/* ------------------------------------------------------------------ */
/* Escolher a capa de um livro                                         */
/* ------------------------------------------------------------------ */

/** Trocar a capa: escolher entre as da busca, enviar uma foto do livro ou ficar com a capa gerada. */
export function JanelaEscolherCapa({ livro, aberta, aoMudar }: { livro: Livro; aberta: boolean; aoMudar: (v: boolean) => void }) {
  const atualizar = useAtualizar("books")
  const [termo, setTermo] = React.useState("")
  const [salvando, setSalvando] = React.useState<string | null>(null)
  const arquivo = React.useRef<HTMLInputElement>(null)
  const busca = useBuscaDeLivros(aberta ? termo : "")

  React.useEffect(() => {
    if (aberta) setTermo(`${livro.title} ${livro.author ?? ""}`.trim())
  }, [aberta, livro.title, livro.author])

  const comCapa = (busca.data ?? []).filter((r) => r.capa)

  const escolher = async (r: ResultadoLivro) => {
    setSalvando(r.chave)
    try {
      const capa = await capaParaGuardar(r)
      if (!capa) throw new Error("Esta capa não está disponível.")
      const patch: TablesUpdate<"books"> = { cover_path: capa }
      if (!livro.author?.trim() && r.autores.length) patch.author = r.autores.join(", ")
      if (!livro.pages_total && r.paginas) patch.pages_total = r.paginas
      atualizar.mutate({ id: livro.id, ...patch })
      void apagarCapasEnviadas(livro.id).catch(() => {})
      aoMudar(false)
    } catch (e) {
      avisarFalhaCapa(e)
    } finally {
      setSalvando(null)
    }
  }

  const enviar = async (f: File) => {
    setSalvando("foto")
    try {
      const caminho = await enviarCapaDoLivro(f, livro.id)
      atualizar.mutate({ id: livro.id, cover_path: caminho })
      void apagarCapasEnviadas(livro.id, caminho).catch(() => {})
      aoMudar(false)
    } catch (e) {
      avisarFalhaCapa(e)
    } finally {
      setSalvando(null)
    }
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Capa do livro"
      descricao="Escolha uma das capas encontradas ou envie uma foto do seu livro."
      largura="lg"
      className="tema-biblioteca"
      rodape={
        <>
          {livro.cover_path ? (
            <Botao
              variante="fantasma"
              className="mr-auto"
              disabled={Boolean(salvando)}
              onClick={() => {
                atualizar.mutate({ id: livro.id, cover_path: null })
                void apagarCapasEnviadas(livro.id).catch(() => {})
                aoMudar(false)
              }}
            >
              <ImageOff /> Sem foto
            </Botao>
          ) : null}
          <input
            ref={arquivo}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void enviar(f)
            }}
          />
          <Botao variante="primario" disabled={Boolean(salvando)} onClick={() => arquivo.current?.click()}>
            {salvando === "foto" ? <LoaderCircle className="animate-spin" /> : <Camera />} Enviar foto
          </Botao>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            aria-label="Buscar capa"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-3 text-[16px] text-ink focus-visible:border-[var(--b-luz)] focus-visible:outline-none"
          />
        </div>
        {busca.esperando ? (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Buscando capas…
          </p>
        ) : busca.error ? (
          <p className="text-sm text-ink-3">{busca.error instanceof BuscaOcupada ? busca.error.message : "Não deu para buscar agora. Envie uma foto ou tente mais tarde."}</p>
        ) : !comCapa.length ? (
          <p className="text-sm text-ink-3">Nenhuma capa encontrada com esse nome. Tente mudar a busca ou envie uma foto.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {comCapa.map((r) => (
              <li key={r.chave}>
                <button
                  type="button"
                  onClick={() => void escolher(r)}
                  disabled={Boolean(salvando)}
                  aria-label={`Usar a capa de ${r.titulo}${r.ano ? `, ${r.ano}` : ""}`}
                  className="group relative block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]"
                >
                  <CapaDoResultado resultado={r} className="w-full transition-transform group-hover:-translate-y-1" />
                  {salvando === r.chave ? (
                    <span className="absolute inset-0 grid place-items-center rounded-md bg-black/50">
                      <LoaderCircle className="size-6 animate-spin text-white" aria-hidden />
                    </span>
                  ) : null}
                  <span className="mt-1.5 block truncate text-xs text-ink-3">{[r.ano, r.editora].filter(Boolean).join(" · ") || r.titulo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Janela>
  )
}
