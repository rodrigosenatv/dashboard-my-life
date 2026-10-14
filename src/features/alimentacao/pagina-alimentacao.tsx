"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { BookOpen, Calculator, CalendarDays, Ellipsis, FileText, History, Layers, Lightbulb, ShoppingCart, Table } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { isoDia } from "@/lib/utils"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { hubPorSlug } from "@/features/vida/hubs"
import { useItensDe, valores } from "@/features/treino/dados"
import { AguaDoDia } from "./agua"
import { TabelaAlimentos } from "./alimentos"
import { DetalheCalculo, gravarPorcao, useMudarProps, type SecaoCalculo } from "./calculo"
import { ListaCompras } from "./compras"
import { diaVazio, indexarDias, lerRefeicao, useColecoesAlimentacao, useConfigAlimentacao, useMudarDia, type Refeicao } from "./dados"
import { HojeAlimentacao, nomeDoDia, valorDaRefeicao, type AlvoCalculo } from "./hoje"
import { NADA, calcularItens, lerPorcoes, type Calculo } from "./nutricao"
import { DialogoMetas, EditorPlano, MontarPlano, ResumoPlano } from "./plano"
import { ReceitasAlimentacao, useReceitas, type Receita } from "./receitas"
import { TrocarPorReceita } from "./troca"

const SEM_ITENS: Calculo = { itens: [], total: NADA, semCalculo: 0 }

/**
 * Alimentação, na ordem do que a pessoa faz: ver o que comer agora e marcar, beber água,
 * consultar o plano e as metas, e escolher uma receita. As calorias e a proteína saem da
 * tabela TACO, calculadas a partir do que está escrito em cada item.
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
  const { receitas } = useReceitas(colecoes.receitas)
  const receitasPorId = React.useMemo(() => new Map(receitas.map((r) => [r.item.id, r])), [receitas])
  const calculos = React.useMemo(() => new Map(refeicoes.map((r) => [r.item.id, calcularItens(r.itens, "prato", lerPorcoes(valores(r.item)._porcoes))])), [refeicoes])
  const mudarProps = useMudarProps()

  const [dia, setDia] = React.useState(() => isoDia())
  const [editor, setEditor] = React.useState<{ aberto: boolean; inicial: string }>({ aberto: false, inicial: "lista" })
  const [metas, setMetas] = React.useState(false)
  const [tabela, setTabela] = React.useState(false)
  const [compras, setCompras] = React.useState(false)
  const [alvo, setAlvo] = React.useState<AlvoCalculo | null>(null)
  const [trocando, setTrocando] = React.useState<string | null>(null)
  // O último alvo fica na janela enquanto ela fecha (sem piscar vazia na animação)
  const [ultimoAlvo, setUltimoAlvo] = React.useState<AlvoCalculo>({ tipo: "plano" })
  const verCalculo = (a: AlvoCalculo) => {
    setUltimoAlvo(a)
    setAlvo(a)
  }

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

  /* As seções da janela de cálculo: cada refeição com o que vale nela */
  const registro = dias.get(dia) ?? diaVazio(dia)
  const secaoDoPlano = (r: Refeicao, subtitulo?: string): SecaoCalculo => ({
    id: r.item.id,
    titulo: r.nome,
    subtitulo,
    calculo: calculos.get(r.item.id) ?? SEM_ITENS,
    aoAjustar: (chave, porcao) => mudarProps(r.item, (p) => gravarPorcao(p, chave, porcao)),
  })
  const secaoDaReceita = (r: Refeicao, rec: Receita): SecaoCalculo => ({
    id: `${r.item.id}|${rec.item.id}`,
    titulo: r.nome,
    subtitulo: `trocada por ${rec.nome}`,
    calculo: rec.calc,
    rende: { n: rec.calc.rende, conhecido: rec.calc.rendeConhecido, aoMudar: (n) => mudarProps(rec.item, (p) => void (p._rende = n)) },
    aoAjustar: (chave, porcao) => mudarProps(rec.item, (p) => gravarPorcao(p, chave, porcao)),
  })
  const secoesDoDia = (somente?: string): SecaoCalculo[] =>
    refeicoes
      .filter((r) => !somente || r.item.id === somente)
      .map((r) => {
        const v = valorDaRefeicao(r, registro, calculos, receitasPorId)
        if (v.origem === "anotacao")
          return {
            id: r.item.id,
            titulo: r.nome,
            subtitulo: "comi diferente",
            calculo: v.calculo ?? SEM_ITENS,
            aviso: "Calculado pelo que você anotou. Para corrigir, edite a anotação com a quantidade, como “2 bananas (200 g)”.",
          }
        if (v.origem === "receita") return secaoDaReceita(r, v.receita)
        return secaoDoPlano(r, somente ? undefined : registro.feitas.includes(r.item.id) ? "feita" : "ainda não")
      })
  const janelaCalculo = (() => {
    const a = alvo ?? ultimoAlvo
    if (a.tipo === "plano")
      return { titulo: "Cálculo do plano", descricao: "As refeições do plano, item por item. Toque num item para corrigir o alimento ou a quantidade.", secoes: refeicoes.map((r) => secaoDoPlano(r)) }
    if (a.tipo === "dia")
      return { titulo: `Cálculo de ${nomeDoDia(dia).toLowerCase()}`, descricao: "Todas as refeições do dia, feitas ou não. Uma correção num item vale para o plano.", secoes: secoesDoDia() }
    const r = refeicoes.find((x) => x.item.id === a.id)
    return { titulo: r ? `Cálculo: ${r.nome}` : "Cálculo", descricao: "Cada item virou um alimento da TACO. Toque num item para corrigir.", secoes: secoesDoDia(a.id) }
  })()
  const refeicaoTrocando = refeicoes.find((r) => r.item.id === trocando) ?? null

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
              {semPlano ? null : (
                <>
                  <MenuItem onSelect={() => setCompras(true)}>
                    <ShoppingCart /> Lista de compras
                  </MenuItem>
                  <MenuItem onSelect={() => verCalculo({ tipo: "plano" })}>
                    <Calculator /> Cálculo do plano
                  </MenuItem>
                  <MenuSeparador />
                </>
              )}
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
              <HojeAlimentacao
                refeicoes={refeicoes}
                dias={dias}
                dia={dia}
                aoEscolherDia={setDia}
                aoMudar={mudarDia}
                aoEditarRefeicao={(id) => setEditor({ aberto: true, inicial: id })}
                calculos={calculos}
                receitas={receitasPorId}
                metas={config.metas}
                aoVerCalculo={verCalculo}
                aoTrocar={setTrocando}
              />
            )}
            <div className="grid content-start gap-12">
              <AguaDoDia dias={dias} dia={dia} config={config} aoMudar={mudarDia} />
              {semPlano ? null : (
                <ResumoPlano
                  refeicoes={refeicoes}
                  config={config}
                  calculos={calculos}
                  aoEditar={() => setEditor({ aberto: true, inicial: "lista" })}
                  aoMetas={() => setMetas(true)}
                  aoVerCalculo={() => verCalculo({ tipo: "plano" })}
                  aoCompras={() => setCompras(true)}
                />
              )}
            </div>
          </div>
          <ReceitasAlimentacao colecao={colecoes.receitas} />
        </div>
      )}

      <EditorPlano key={editor.aberto ? editor.inicial : "fechado"} aberto={editor.aberto} inicial={editor.inicial} aoFechar={() => setEditor((e) => ({ ...e, aberto: false }))} colecao={colecoes.plano} refeicoes={refeicoes} />
      <DialogoMetas aberta={metas} aoMudar={setMetas} config={config} aoSalvar={salvarConfig} />
      <TabelaAlimentos aberta={tabela} aoMudar={setTabela} colecao={colecoes.alimentos} />
      <DetalheCalculo aberta={Boolean(alvo)} aoMudar={(v) => !v && setAlvo(null)} titulo={janelaCalculo.titulo} descricao={janelaCalculo.descricao} secoes={janelaCalculo.secoes} />
      <ListaCompras aberta={compras} aoMudar={setCompras} refeicoes={refeicoes} calculos={calculos} config={config} aoSalvarConfig={salvarConfig} />
      <TrocarPorReceita
        refeicao={refeicaoTrocando}
        receitas={receitas}
        atual={trocando ? registro.trocas[trocando] : undefined}
        aoFechar={() => setTrocando(null)}
        aoEscolher={(receitaId) => {
          if (!trocando) return
          const id = trocando
          mudarDia(dia, (d) => {
            // A receita substitui o plano e também uma anotação de "comi diferente"
            const diferente = { ...d.diferente }
            delete diferente[id]
            return { ...d, diferente, trocas: { ...d.trocas, [id]: receitaId } }
          })
        }}
        aoVoltarAoPlano={() => {
          if (!trocando) return
          const id = trocando
          mudarDia(dia, (d) => {
            const trocas = { ...d.trocas }
            delete trocas[id]
            return { ...d, trocas }
          })
        }}
        aoDefinirRende={(rec, n) => mudarProps(rec.item, (p) => void (p._rende = n))}
      />
    </div>
  )
}
