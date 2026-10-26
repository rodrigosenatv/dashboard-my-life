"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { useRouter } from "next/navigation"
import { FileText, Pencil } from "lucide-react"
import { Markdown } from "@/components/markdown"
import { Cabecalho, Secao } from "@/components/ui/basicos"
import { Botao } from "@/components/ui/button"
import { NavVida } from "@/features/vida/pagina-hub"
import { novoId, useCriar } from "@/lib/data"
import { textoDasAnotacoes, usePaginaFlow } from "./dados"
import { FerramentasUteis } from "./ferramentas"
import { MusicaParaFocar } from "./musica"
import { SessaoFoco } from "./sessao"
import { AgendaDeHoje, TarefasDeHoje } from "./tarefas"

/** O Flow: o modo foco numa tela só (sessão, tarefas de hoje, agenda, músicas e ferramentas). */
export function PaginaFlow() {
  const router = useRouter()
  const { pagina } = usePaginaFlow()
  const criarPagina = useCriar("pages")

  // Como em PaginaHub: abre a página Flow ou cria uma vazia e já manda para editar
  const abrirPagina = async () => {
    try {
      if (pagina) {
        router.push(`/paginas/${pagina.id}`)
        return
      }
      const id = novoId()
      await criarPagina.mutateAsync({ id, title: "Flow", section: "geral", content: "" })
      router.push(`/paginas/${id}?editar=1`)
    } catch {
      // O aviso de erro já sai do hook de criar
    }
  }

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Flow"
        descricao="Modo foco: o que fazer agora, o timer e as ferramentas à mão."
        acoes={
          <Botao variante="contorno" onClick={abrirPagina}>
            <FileText /> {pagina ? "Abrir página" : "Criar página"}
          </Botao>
        }
      />
      <NavVida atual="flow" />

      <div className="grid gap-12">
        <SessaoFoco />
        <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
          <div className="grid content-start gap-10">
            <TarefasDeHoje />
            <AgendaDeHoje />
          </div>
          <MusicaParaFocar />
        </div>
        <FerramentasUteis />
        <AnotacoesFlow />
      </div>
    </div>
  )
}

/** As anotações da página Flow: só aparecem quando a página tem texto de verdade (não só rótulos e links). */
export function AnotacoesFlow() {
  const { pagina, conteudo } = usePaginaFlow()
  const texto = textoDasAnotacoes(conteudo)
  if (!pagina || !texto) return null
  return (
    <Secao
      titulo="Anotações"
      acao={
        <Link
          href={`/paginas/${pagina.id}?editar=1`}
          className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink toque:min-h-11"
        >
          <Pencil aria-hidden className="size-3.5" /> Editar
        </Link>
      }
    >
      <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <Markdown texto={texto} />
      </div>
    </Secao>
  )
}
