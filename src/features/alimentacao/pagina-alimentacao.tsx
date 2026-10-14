"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { BookOpen, CalendarDays, Ellipsis, FileText, History, Layers, Lightbulb, Table } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { isoDia } from "@/lib/utils"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { hubPorSlug } from "@/features/vida/hubs"
import { useItensDe } from "@/features/treino/dados"
import { AguaDoDia } from "./agua"
import { TabelaAlimentos } from "./alimentos"
import { indexarDias, lerRefeicao, useColecoesAlimentacao, useConfigAlimentacao, useMudarDia } from "./dados"
import { HojeAlimentacao } from "./hoje"
import { DialogoMetas, EditorPlano, MontarPlano, ResumoPlano } from "./plano"
import { ReceitasAlimentacao } from "./receitas"

/**
 * Alimentação, na ordem do que a pessoa faz: ver o que comer agora e marcar, beber água,
 * consultar o plano e as metas, e escolher uma receita.
 */
export function PaginaAlimentacao() {
  const router = useRouter()
  const colecoes = useColecoesAlimentacao()
  const { data: itensPlano = [], isLoading: carregandoPlano } = useItensDe(colecoes.plano)
  const { data: itensDiario = [] } = useItensDe(colecoes.diario)
  const refeicoes = React.useMemo(() => itensPlano.map(lerRefeicao), [itensPlano])
  const dias = React.useMemo(() => indexarDias(itensDiario), [itensDiario])
  const ids = React.useMemo(() => refeicoes.map((r) => r.item.id), [refeicoes])
  const { config, salvar: salvarConfig, carregando: carregandoConfig } = useConfigAlimentacao()
  const mudarDia = useMudarDia(colecoes.diario, ids)
  const { pagina } = usePaginaDoHub(hubPorSlug("alimentacao"))

  const [dia, setDia] = React.useState(() => isoDia())
  const [editor, setEditor] = React.useState<{ aberto: boolean; inicial: string }>({ aberto: false, inicial: "lista" })
  const [metas, setMetas] = React.useState(false)
  const [tabela, setTabela] = React.useState(false)

  // Virou o dia com a página aberta: "hoje" passa a ser o dia novo
  React.useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") setDia((d) => (d < isoDia() && d === isoDia(new Date(Date.now() - 86_400_000)) ? isoDia() : d))
    }
    document.addEventListener("visibilitychange", aoVoltar)
    return () => document.removeEventListener("visibilitychange", aoVoltar)
  }, [])

  const semPlano = !colecoes.plano || refeicoes.length === 0
  const carregando = colecoes.carregando || (Boolean(colecoes.plano) && carregandoPlano) || carregandoConfig

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Alimentação"
        descricao="O plano do dia, a água e as receitas."
        acoes={
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="contorno" tamanho="icone" aria-label="Mais opções da alimentação">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="w-64">
              <MenuItem onSelect={() => setTabela(true)}>
                <Table /> Tabela de alimentos
              </MenuItem>
              {colecoes.plano ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.plano!.id}`)}>
                  <Layers /> Plano em tabela
                </MenuItem>
              ) : null}
              {colecoes.diario ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.diario!.id}`)}>
                  <CalendarDays /> Diário em tabela
                </MenuItem>
              ) : null}
              {colecoes.receitas ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.receitas!.id}`)}>
                  <BookOpen /> Receitas em tabela
                </MenuItem>
              ) : null}
              <MenuSeparador />
              {config.dicas ? (
                <MenuItem onSelect={() => router.push(`/paginas/${config.dicas}`)}>
                  <Lightbulb /> Dicas do plano
                </MenuItem>
              ) : null}
              {colecoes.antigo ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.antigo!.id}`)}>
                  <History /> Plano antigo (2024)
                </MenuItem>
              ) : null}
              {pagina ? (
                <MenuItem onSelect={() => router.push(`/paginas/${pagina.id}`)}>
                  <FileText /> Página antiga do Notion
                </MenuItem>
              ) : null}
            </MenuConteudo>
          </Menu>
        }
      />
      <NavVida atual="alimentacao" />

      {carregando ? (
        <Carregando linhas={6} />
      ) : (
        <div className="grid gap-12">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
            {semPlano ? (
              <MontarPlano colecao={colecoes.plano} config={config} aoSalvarConfig={salvarConfig} aoComecarDoZero={() => setEditor({ aberto: true, inicial: "nova" })} />
            ) : (
              <HojeAlimentacao refeicoes={refeicoes} dias={dias} dia={dia} aoEscolherDia={setDia} aoMudar={mudarDia} aoEditarRefeicao={(id) => setEditor({ aberto: true, inicial: id })} />
            )}
            <div className="grid content-start gap-12">
              <AguaDoDia dias={dias} dia={dia} config={config} aoMudar={mudarDia} />
              {semPlano ? null : <ResumoPlano refeicoes={refeicoes} config={config} aoEditar={() => setEditor({ aberto: true, inicial: "lista" })} aoMetas={() => setMetas(true)} />}
            </div>
          </div>
          <ReceitasAlimentacao colecao={colecoes.receitas} />
        </div>
      )}

      <EditorPlano key={editor.aberto ? editor.inicial : "fechado"} aberto={editor.aberto} inicial={editor.inicial} aoFechar={() => setEditor((e) => ({ ...e, aberto: false }))} colecao={colecoes.plano} refeicoes={refeicoes} />
      <DialogoMetas aberta={metas} aoMudar={setMetas} config={config} aoSalvar={salvarConfig} />
      <TabelaAlimentos aberta={tabela} aoMudar={setTabela} colecao={colecoes.alimentos} />
    </div>
  )
}
