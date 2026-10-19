"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { BookHeart, Briefcase, FileText, HeartPulse, IdCard, Lightbulb, NotebookPen, Plus, Users, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import { useCriar, novoId } from "@/lib/data"
import { useGarantirColecao } from "@/features/colecoes/gravacao"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { DEFINICOES, useColecoesPessoal } from "./dados"
import { agruparWiki, CATEGORIAS_WIKI, linkDoItem, SEM_CATEGORIA, type PaginaWiki } from "./logica"

const ICONES_WIKI: Record<string, LucideIcon> = {
  "Informações Pessoais": IdCard,
  Saúde: HeartPulse,
  "Minha História": BookHeart,
  Aprendizados: Lightbulb,
  Profissional: Briefcase,
  Social: Users,
}

/** A wiki: uma página por categoria, com as páginas de cada uma e um atalho para criar outra. */
export function SecaoWiki({ paginas, aoNova }: { paginas: PaginaWiki[]; aoNova: () => void }) {
  const grupos = React.useMemo(() => agruparWiki(paginas), [paginas])
  return (
    <Secao
      titulo="Wiki pessoal"
      acao={
        <Botao variante="fantasma" tamanho="sm" onClick={aoNova}>
          <Plus /> Nova página
        </Botao>
      }
    >
      {grupos.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => {
            const Icone = ICONES_WIKI[g.categoria] ?? FileText
            return (
              <article key={g.categoria} className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-medium">
                  <Icone aria-hidden className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate">{g.categoria}</span>
                  <span className="shrink-0 text-xs font-normal text-ink-3">{g.paginas.length}</span>
                </h3>
                <ul className="mt-2 grid">
                  {g.paginas.map((p) => (
                    <li key={p.id} className="min-w-0">
                      <Link href={linkDoItem(p.id)} className="flex items-center rounded-lg py-2 pl-6 pr-2 text-sm hover:bg-surface-2 toque:min-h-11">
                        <span className="min-w-0 truncate">{p.titulo}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      ) : (
        <Vazio
          icone={<NotebookPen />}
          titulo="Sua wiki está vazia."
          descricao="Escreva o que vale lembrar sobre você: dados pessoais, saúde, sua história, aprendizados."
          acao={
            <Botao variante="primario" tamanho="sm" onClick={aoNova}>
              <Plus /> Nova página
            </Botao>
          }
        />
      )}
    </Secao>
  )
}

const OPCOES_CATEGORIA = [SEM_CATEGORIA, ...CATEGORIAS_WIKI].map((c) => ({ id: c, rotulo: c }))

/** Nova página da wiki: cria o item e abre a tela dele já em modo de edição. */
export function FormPaginaWiki({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const router = useRouter()
  const { wiki } = useColecoesPessoal()
  const garantir = useGarantirColecao(DEFINICOES.wiki, wiki)
  const criarItem = useCriar("collection_items")
  const [titulo, setTitulo] = React.useState("")
  const [categoria, setCategoria] = React.useState<string>(SEM_CATEGORIA)
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)

  // Ao abrir, começa em branco (como o formulário de prática)
  React.useEffect(() => {
    if (!aberta) return
    setTitulo("")
    setCategoria(SEM_CATEGORIA)
    setErro(null)
    setSalvando(false)
  }, [aberta])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    const nome = titulo.trim()
    if (!nome) return setErro("Dê um título à página.")
    setErro(null)
    setSalvando(true)

    // A coleção precisa existir antes do item: a tela do item busca o item no banco
    let colecao: Colecao
    try {
      colecao = await garantir()
    } catch (err) {
      toast.error("Não foi possível criar a página.", { description: err instanceof Error ? err.message : undefined })
      setSalvando(false)
      return
    }

    const id = novoId()
    try {
      await criarItem.mutateAsync({
        id,
        collection_id: colecao.id,
        title: nome,
        props: categoria !== SEM_CATEGORIA ? { Tags: categoria } : {},
        content: null,
        position: Date.now(),
      })
    } catch {
      // O useCriar já avisou o que deu errado
      setSalvando(false)
      return
    }
    setSalvando(false)
    aoMudar(false)
    router.push(linkDoItem(id, true))
  }

  const idForm = "form-pagina-wiki"
  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo="Nova página na wiki"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={salvando}>
            Criar página
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <Campo rotulo="Título" htmlFor="wiki-titulo">
          <Entrada
            id="wiki-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Minhas metas de vida"
            autoComplete="off"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "wiki-erro" : undefined}
          />
        </Campo>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Categoria</span>
          <EscolhaPilulas rotulo="Categoria" valor={categoria} aoMudar={setCategoria} opcoes={OPCOES_CATEGORIA} />
        </div>
        {erro ? (
          <p id="wiki-erro" role="alert" className="text-sm text-danger">
            {erro}
          </p>
        ) : null}
      </form>
    </Janela>
  )
}
