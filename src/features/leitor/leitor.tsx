"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { LoaderCircle } from "lucide-react"
import { novoId, useCriar, useRegistro } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types"
import { isoDia } from "@/lib/utils"
import { aparenciaGuardada, guardarAparencia, TEMAS, type Aparencia } from "./aparencia"
import { comoArquivo, lerLivroLocal, lerPosicaoLocal, salvarLivroLocal, salvarPosicaoLocal, type LivroLocal } from "./armazenamento"
import { useAtualizarDisponibilidade } from "./dados"
import { LeitorLivro, type InfoLugar } from "./leitor-livro"
import { arquivoNuvemDoLivro, baixarLivroNuvem, lerPrefsLeitor, salvarPosicaoNuvem } from "./nuvem"

type Livro = Tables<"books">
type Estado =
  | { fase: "carregando" }
  | { fase: "baixando" }
  | { fase: "sem-arquivo" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; arquivo: File; posicao: string | null }

/** De quanto em quanto tempo a posição vai para a nuvem enquanto a pessoa lê. */
const INTERVALO_NUVEM = 20_000

function paginasLidas(livro: Livro, info: InfoLugar): { lidas: number; total: number } | null {
  const total = livro.pages_total ?? info.paginasTotais
  if (!total) return null
  const rotulo = Number(info.localizacao.pageItem?.label)
  // Com o total igual ao do PDF, vale a página do PDF em que a pessoa está
  if (rotulo && info.paginasTotais === total) return { lidas: Math.min(total, rotulo), total }
  return { lidas: Math.min(total, Math.round(info.localizacao.fraction * total)), total }
}

/** Tela do leitor: acha o arquivo (aparelho ou nuvem), abre na página em que parou e guarda o progresso. */
export function Leitor() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data: livro } = useRegistro("books", id)
  const [estado, setEstado] = React.useState<Estado>({ fase: "carregando" })
  const [aparencia, setAparencia] = React.useState<Aparencia>(() => aparenciaGuardada())
  const atualizarDisponibilidade = useAtualizarDisponibilidade()
  const criarInsight = useCriar("insights", { aviso: "Trecho guardado nos insights do livro." })

  const livroRef = React.useRef<Livro | null | undefined>(livro)
  React.useEffect(() => {
    livroRef.current = livro
  }, [livro])

  /* Arquivo e posição ----------------------------------------------- */
  React.useEffect(() => {
    let cancelado = false
    const carregar = async () => {
      try {
        const [local, posLocal, prefs] = await Promise.all([
          lerLivroLocal(id).catch(() => undefined),
          lerPosicaoLocal(id).catch(() => undefined),
          lerPrefsLeitor().catch(() => ({}) as Awaited<ReturnType<typeof lerPrefsLeitor>>),
        ])
        // A posição mais recente entre este aparelho e a nuvem
        const posNuvem = prefs.posicoes?.[id]
        const candidatas = [posLocal, posNuvem].filter((p): p is NonNullable<typeof p> => Boolean(p?.cfi))
        const maisRecente = candidatas.sort((a, b) => b.em.localeCompare(a.em))[0]
        let livroLocal: LivroLocal | undefined = local
        if (!livroLocal) {
          const registro = await arquivoNuvemDoLivro(id)
          if (cancelado) return
          if (!registro) {
            setEstado({ fase: "sem-arquivo" })
            return
          }
          setEstado({ fase: "baixando" })
          const blob = await baixarLivroNuvem(registro)
          livroLocal = {
            id,
            arquivo: blob,
            nome: registro.name,
            tamanho: blob.size,
            origem: /\.epub$/i.test(registro.name) ? "epub" : "outro",
            salvoEm: new Date().toISOString(),
          }
          // Fica guardado neste aparelho para as próximas vezes (e para ler sem internet)
          await salvarLivroLocal(livroLocal).catch(() => {})
          atualizarDisponibilidade()
        }
        if (!cancelado) setEstado({ fase: "pronto", arquivo: comoArquivo(livroLocal), posicao: maisRecente?.cfi ?? null })
      } catch (erro) {
        if (!cancelado) setEstado({ fase: "erro", mensagem: erro instanceof Error ? erro.message : "Não foi possível abrir o livro." })
      }
    }
    void carregar()
    return () => {
      cancelado = true
    }
  }, [id, atualizarDisponibilidade])

  /* Progresso ------------------------------------------------------- */
  const ultimo = React.useRef<InfoLugar | null>(null)
  const pendente = React.useRef(false)
  const temporizadorLocal = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const enviar = React.useCallback(async () => {
    const info = ultimo.current
    const l = livroRef.current
    if (!pendente.current || !info) return
    pendente.current = false
    const em = new Date().toISOString()
    await salvarPosicaoNuvem(id, { cfi: info.localizacao.cfi, fracao: info.localizacao.fraction, em }).catch(() => {
      pendente.current = true
    })
    if (!l) return
    const patch: TablesUpdate<"books"> = {}
    const paginas = paginasLidas(l, info)
    if (paginas && paginas.lidas !== l.pages_read) patch.pages_read = paginas.lidas
    if (!l.pages_total && info.paginasTotais) patch.pages_total = info.paginasTotais
    if ((l.status === "desejo" || l.status === "pausado") && info.localizacao.fraction > 0.01) {
      patch.status = "lendo"
      if (!l.started_at) patch.started_at = isoDia()
    }
    if (!Object.keys(patch).length) return
    const { data } = await supabase().from("books").update(patch).eq("id", id).select().maybeSingle()
    if (data) {
      livroRef.current = data
      qc.setQueryData(["books", "um", id], data)
    }
  }, [id, qc])

  const aoMudarLugar = React.useCallback(
    (info: InfoLugar) => {
      ultimo.current = info
      pendente.current = true
      if (temporizadorLocal.current) clearTimeout(temporizadorLocal.current)
      temporizadorLocal.current = setTimeout(() => {
        void salvarPosicaoLocal({
          id,
          cfi: info.localizacao.cfi,
          fracao: info.localizacao.fraction,
          pagina: info.localizacao.pageItem?.label,
          em: new Date().toISOString(),
        }).catch(() => {})
      }, 500)
    },
    [id],
  )

  React.useEffect(() => {
    const intervalo = setInterval(() => void enviar(), INTERVALO_NUVEM)
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") void enviar()
    }
    document.addEventListener("visibilitychange", aoEsconder)
    window.addEventListener("pagehide", aoEsconder)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener("visibilitychange", aoEsconder)
      window.removeEventListener("pagehide", aoEsconder)
      void enviar().finally(() => {
        void qc.invalidateQueries({ queryKey: ["books"] })
        void qc.invalidateQueries({ queryKey: ["leitor"] })
      })
    }
  }, [enviar, qc])

  const mudarAparencia = React.useCallback((a: Aparencia) => {
    setAparencia(a)
    guardarAparencia(a)
  }, [])

  const voltarPara = `/estudos/leitura/${id}`
  const tema = TEMAS[aparencia.tema]

  if (estado.fase === "pronto") {
    return (
      <LeitorLivro
        arquivo={estado.arquivo}
        titulo={livro?.title ?? ""}
        voltarPara={voltarPara}
        posicaoInicial={estado.posicao}
        aparencia={aparencia}
        aoMudarAparencia={mudarAparencia}
        aoMudarLugar={aoMudarLugar}
        aoGuardarTrecho={(texto) => criarInsight.mutate({ id: novoId(), text: texto, book_id: id, source: "livro" })}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center px-6 text-center" style={{ background: tema.fundo, color: tema.texto }}>
      {estado.fase === "sem-arquivo" ? (
        <div className="grid max-w-sm gap-3">
          <p className="font-medium">Este livro ainda não tem arquivo para ler.</p>
          <p className="text-sm" style={{ color: tema.suave }}>
            Adicione o PDF ou EPUB na tela do livro.
          </p>
          <Link href={voltarPara} className="text-sm font-medium underline underline-offset-4">
            Ir para o livro
          </Link>
        </div>
      ) : estado.fase === "erro" ? (
        <div className="grid max-w-sm gap-3">
          <p className="font-medium">{estado.mensagem}</p>
          <Link href={voltarPara} className="text-sm font-medium underline underline-offset-4">
            Voltar
          </Link>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm" style={{ color: tema.suave }}>
          <LoaderCircle className="size-4 animate-spin" /> {estado.fase === "baixando" ? "Baixando o livro da nuvem…" : "Abrindo…"}
        </p>
      )}
    </div>
  )
}
