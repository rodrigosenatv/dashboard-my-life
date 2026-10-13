"use client"

import { useRouter } from "next/navigation"
import { Ellipsis, FileText, History, Layers, Scale, Shapes, Sun } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { hubPorSlug } from "@/features/vida/hubs"
import { useColecoesTreino } from "./dados"
import { EvolucaoCorporal } from "./evolucao"
import { FichasTreino } from "./fichas"
import { HistoricoTreinos } from "./historico"
import { HojeTreino } from "./hoje"

/**
 * Treino: o que a pessoa faz com a página, nesta ordem: começar (ou continuar) o treino
 * do dia, consultar as fichas e o histórico, e acompanhar a evolução do corpo.
 */
export function PaginaTreino() {
  const router = useRouter()
  const { exercicios, grupos, avaliacao, historico, carregando } = useColecoesTreino()
  const { pagina } = usePaginaDoHub(hubPorSlug("treino"))

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Treino"
        descricao="O treino de hoje, as fichas e a evolução do corpo."
        acoes={
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="contorno" tamanho="icone" aria-label="Mais opções do treino">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="w-60">
              {exercicios ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${exercicios.id}`)}>
                  <Layers /> Exercícios em tabela
                </MenuItem>
              ) : null}
              {historico ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${historico.id}`)}>
                  <History /> Histórico em tabela
                </MenuItem>
              ) : null}
              {avaliacao ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${avaliacao.id}`)}>
                  <Scale /> Avaliações em tabela
                </MenuItem>
              ) : null}
              {grupos ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${grupos.id}`)}>
                  <Shapes /> Grupos musculares
                </MenuItem>
              ) : null}
              <MenuItem onSelect={() => router.push("/rotina/habitos")}>
                <Sun /> Hábitos
              </MenuItem>
              {pagina ? (
                <>
                  <MenuSeparador />
                  <MenuItem onSelect={() => router.push(`/paginas/${pagina.id}`)}>
                    <FileText /> Página antiga do Notion
                  </MenuItem>
                </>
              ) : null}
            </MenuConteudo>
          </Menu>
        }
      />
      <NavVida atual="treino" />

      {carregando ? (
        <Carregando linhas={6} />
      ) : (
        <div className="grid gap-12">
          <HojeTreino exercicios={exercicios} historico={historico} />
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
            <div className="grid content-start gap-12">
              <FichasTreino colecao={exercicios} grupos={grupos} historico={historico} />
              <HistoricoTreinos historico={historico} />
            </div>
            <EvolucaoCorporal colecao={avaliacao} />
          </div>
        </div>
      )}
    </div>
  )
}
