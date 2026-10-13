"use client"

import { useRouter } from "next/navigation"
import { Ellipsis, FileText, Layers, Scale, Shapes, Sun } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { hubPorSlug } from "@/features/vida/hubs"
import { useColecoesTreino } from "./dados"
import { EvolucaoCorporal } from "./evolucao"
import { FichasTreino } from "./fichas"
import { SemanaTreino } from "./semana"

/**
 * Treino: o que a pessoa faz com a página, nesta ordem: ver a semana e marcar o
 * treino do dia, abrir a ficha e acompanhar a evolução do corpo.
 */
export function PaginaTreino() {
  const router = useRouter()
  const { exercicios, grupos, avaliacao, carregando } = useColecoesTreino()
  const { pagina } = usePaginaDoHub(hubPorSlug("treino"))

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Treino"
        descricao="A semana de treinos, as fichas e a evolução do corpo."
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
          <SemanaTreino />
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
            <FichasTreino colecao={exercicios} grupos={grupos} />
            <EvolucaoCorporal colecao={avaliacao} />
          </div>
        </div>
      )}
    </div>
  )
}
