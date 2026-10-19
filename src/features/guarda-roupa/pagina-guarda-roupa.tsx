"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Ellipsis, FileText, Layers, Plus, Shirt, ShoppingBag } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, ErroCarregar, Segmentos, Vazio } from "@/components/ui/basicos"
import { Seletor } from "@/components/ui/campos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import type { Colecao } from "@/features/colecoes/visao-colecao"
import { hubPorSlug } from "@/features/vida/hubs"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { isoDia, plural } from "@/lib/utils"
import { useDadosGuardaRoupa } from "./dados"
import {
  abaInicial,
  contarPorLugar,
  contarPorTipo,
  filtrarPorLugar,
  filtrarPorTipo,
  ordenarDesejos,
  ordenarPecas,
  resumoDesejos,
  textoResumoDesejos,
  type Aba,
  type OrdemDesejos,
  type OrdemPecas,
  type Outfit,
  type Peca,
} from "./logica"
import { JanelaFormPeca } from "./form-peca"
import { CartaoOutfit, JanelaMontarOutfit, JanelaOutfit } from "./outfits"
import { GradePecas, JanelaPeca } from "./pecas"
import { FiltroChips } from "./ui"

/** A aba que a pessoa escolheu por último neste aparelho. */
const CHAVE_ABA = "guarda-roupa:aba"

function abaLembrada(): string | null {
  try {
    return localStorage.getItem(CHAVE_ABA)
  } catch {
    return null
  }
}

function lembrarAba(aba: Aba) {
  try {
    localStorage.setItem(CHAVE_ABA, aba)
  } catch {
    // Sem armazenamento: a aba volta à inicial na próxima vez
  }
}

const ORDEM_PECAS: { valor: OrdemPecas; rotulo: string }[] = [
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "menos-usadas", rotulo: "Menos usadas" },
  { valor: "nome", rotulo: "Nome" },
]

const ORDEM_DESEJOS: { valor: OrdemDesejos; rotulo: string }[] = [
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "menor-preco", rotulo: "Menor preço" },
  { valor: "maior-preco", rotulo: "Maior preço" },
]

/** O valor do filtro se ele ainda existe na lista (senão, todas). */
const valido = (valor: string | null, nomes: string[]) => (valor !== null && nomes.includes(valor) ? valor : null)

/** Guarda Roupa: peças, outfits e a lista de desejos, em abas. */
export function PaginaGuardaRoupa() {
  const dados = useDadosGuardaRoupa()
  const { pagina } = usePaginaDoHub(hubPorSlug("guarda-roupa"))

  if (dados.carregando || dados.erro) {
    return (
      <div>
        <Cabecalho area="geral" titulo="Guarda Roupa" descricao="Peças, outfits e a lista de desejos." />
        <NavVida atual="guarda-roupa" />
        {dados.erro ? <ErroCarregar erro={dados.erro} /> : <Carregando linhas={6} />}
      </div>
    )
  }

  return <Conteudo pecas={dados.pecas} outfits={dados.outfits} colecoes={dados.colecoes} pagina={pagina} />
}

/**
 * A tela com os dados já carregados. A aba inicial é decidida uma vez, na montagem (com os dados prontos):
 * uma gravação depois não muda a aba que a pessoa está vendo.
 */
function Conteudo({
  pecas,
  outfits,
  colecoes,
  pagina,
}: {
  pecas: Peca[]
  outfits: Outfit[]
  colecoes: { pecas: Colecao | undefined; outfits: Colecao | undefined }
  pagina: { id: string } | null
}) {
  const router = useRouter()
  const hoje = isoDia()
  const possuidas = pecas.filter((p) => p.comprado)
  const desejos = pecas.filter((p) => !p.comprado)

  const [aba, setAba] = React.useState<Aba>(() => abaInicial(abaLembrada(), possuidas.length, desejos.length))
  const [ordemPecas, setOrdemPecas] = React.useState<OrdemPecas>("recentes")
  const [ordemDesejos, setOrdemDesejos] = React.useState<OrdemDesejos>("recentes")
  const [filtroPecas, setFiltroPecas] = React.useState<string | null>(null)
  const [filtroDesejos, setFiltroDesejos] = React.useState<string | null>(null)
  const [filtroOutfits, setFiltroOutfits] = React.useState<string | null>(null)
  const [abertaPecaId, setAbertaPecaId] = React.useState<string | null>(null)
  const [abertoOutfitId, setAbertoOutfitId] = React.useState<string | null>(null)
  const [formulario, setFormulario] = React.useState<{ peca?: Peca; comprado: boolean } | null>(null)
  const [montar, setMontar] = React.useState<{ outfit?: Outfit } | null>(null)

  const contagemPecas = contarPorTipo(possuidas)
  const contagemDesejos = contarPorTipo(desejos)
  const contagemLugares = contarPorLugar(outfits)
  const tipoPecas = valido(filtroPecas, contagemPecas.map((c) => c.tipo))
  const tipoDesejos = valido(filtroDesejos, contagemDesejos.map((c) => c.tipo))
  const lugarOutfits = valido(filtroOutfits, contagemLugares.map((c) => c.lugar))

  const pecasVisiveis = ordenarPecas(filtrarPorTipo(possuidas, tipoPecas), ordemPecas, outfits)
  const desejosVisiveis = ordenarDesejos(filtrarPorTipo(desejos, tipoDesejos), ordemDesejos)
  const outfitsVisiveis = filtrarPorLugar(outfits, lugarOutfits)

  const pecaAberta = pecas.find((p) => p.id === abertaPecaId) ?? null
  const outfitAberto = outfits.find((o) => o.id === abertoOutfitId) ?? null

  const escolherAba = (nova: Aba) => {
    setAba(nova)
    lembrarAba(nova)
  }

  // O botão principal muda com a aba
  const acaoPrincipal =
    aba === "pecas"
      ? { rotulo: "Adicionar peça", abrir: () => setFormulario({ comprado: true }) }
      : aba === "desejos"
        ? { rotulo: "Adicionar desejo", abrir: () => setFormulario({ comprado: false }) }
        : { rotulo: "Montar outfit", abrir: () => setMontar({}) }

  const colecaoPecas = colecoes.pecas
  const colecaoOutfits = colecoes.outfits

  const acoes = (
    <div className="flex items-center gap-2">
      <Botao variante="primario" onClick={acaoPrincipal.abrir}>
        <Plus /> {acaoPrincipal.rotulo}
      </Botao>
      <Menu>
        <MenuGatilho asChild>
          <Botao variante="contorno" tamanho="icone" aria-label="Mais opções de Guarda Roupa">
            <Ellipsis />
          </Botao>
        </MenuGatilho>
        <MenuConteudo className="w-64">
          {colecaoPecas ? (
            <MenuItem onSelect={() => router.push(`/colecoes/${colecaoPecas.id}`)}>
              <Layers /> Ver peças em tabela
            </MenuItem>
          ) : null}
          {colecaoOutfits ? (
            <MenuItem onSelect={() => router.push(`/colecoes/${colecaoOutfits.id}`)}>
              <Layers /> Ver outfits em tabela
            </MenuItem>
          ) : null}
          {(colecaoPecas || colecaoOutfits) && pagina ? <MenuSeparador /> : null}
          {pagina ? (
            <MenuItem onSelect={() => router.push(`/paginas/${pagina.id}`)}>
              <FileText /> Página antiga do Notion
            </MenuItem>
          ) : null}
        </MenuConteudo>
      </Menu>
    </div>
  )

  const resumo =
    aba === "pecas"
      ? plural(pecasVisiveis.length, "peça")
      : aba === "desejos"
        ? textoResumoDesejos(resumoDesejos(desejosVisiveis))
        : plural(outfitsVisiveis.length, "outfit")

  const mudarOrdem = (valor: string) => {
    if (aba === "pecas") setOrdemPecas(valor as OrdemPecas)
    else setOrdemDesejos(valor as OrdemDesejos)
  }

  return (
    <div>
      <Cabecalho area="geral" titulo="Guarda Roupa" descricao="Peças, outfits e a lista de desejos." acoes={acoes} />
      <NavVida atual="guarda-roupa" />

      <div className="grid gap-5">
        <Segmentos
          rotulo="Mostrar"
          valor={aba}
          aoMudar={escolherAba}
          opcoes={[
            { valor: "pecas", rotulo: "Peças", contagem: possuidas.length },
            { valor: "outfits", rotulo: "Outfits", contagem: outfits.length },
            { valor: "desejos", rotulo: "Desejos", contagem: desejos.length },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">{resumo}</p>
          {aba !== "outfits" ? (
            <Seletor aria-label="Ordenar" className="w-auto sm:w-48" value={aba === "pecas" ? ordemPecas : ordemDesejos} onChange={(e) => mudarOrdem(e.target.value)}>
              {(aba === "pecas" ? ORDEM_PECAS : ORDEM_DESEJOS).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </Seletor>
          ) : null}
        </div>

        {aba === "pecas" && possuidas.length ? (
          <FiltroChips
            rotulo="Filtrar por tipo"
            todos={{ rotulo: "Todas", n: possuidas.length }}
            opcoes={contagemPecas.map((c) => ({ valor: c.tipo, n: c.n }))}
            valor={tipoPecas}
            aoMudar={setFiltroPecas}
          />
        ) : null}
        {aba === "desejos" && desejos.length ? (
          <FiltroChips
            rotulo="Filtrar por tipo"
            todos={{ rotulo: "Todos", n: desejos.length }}
            opcoes={contagemDesejos.map((c) => ({ valor: c.tipo, n: c.n }))}
            valor={tipoDesejos}
            aoMudar={setFiltroDesejos}
          />
        ) : null}
        {aba === "outfits" && outfits.length ? (
          <FiltroChips
            rotulo="Filtrar por lugar"
            todos={{ rotulo: "Todos", n: outfits.length }}
            opcoes={contagemLugares.map((c) => ({ valor: c.lugar, n: c.n }))}
            valor={lugarOutfits}
            aoMudar={setFiltroOutfits}
          />
        ) : null}

        {aba === "pecas" ? (
          possuidas.length ? (
            <GradePecas pecas={pecasVisiveis} aoAbrir={(p) => setAbertaPecaId(p.id)} desejo={false} />
          ) : (
            <Vazio
              icone={<Shirt />}
              titulo="Nenhuma peça ainda."
              descricao="Cadastre as roupas que você tem, com foto, para montar outfits. Os desejos que você comprar também vêm para cá."
              acao={
                <Botao variante="primario" tamanho="sm" onClick={() => setFormulario({ comprado: true })}>
                  <Plus /> Adicionar peça
                </Botao>
              }
            />
          )
        ) : aba === "desejos" ? (
          desejos.length ? (
            <GradePecas pecas={desejosVisiveis} aoAbrir={(p) => setAbertaPecaId(p.id)} desejo />
          ) : (
            <Vazio
              icone={<ShoppingBag />}
              titulo="Nenhum desejo na lista."
              descricao="Guarde aqui o que quer comprar, com foto, preço e o link da loja."
              acao={
                <Botao variante="primario" tamanho="sm" onClick={() => setFormulario({ comprado: false })}>
                  <Plus /> Adicionar desejo
                </Botao>
              }
            />
          )
        ) : outfits.length ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {outfitsVisiveis.map((o) => (
              <CartaoOutfit key={o.id} outfit={o} aoAbrir={(x) => setAbertoOutfitId(x.id)} hoje={hoje} />
            ))}
          </ul>
        ) : (
          <Vazio
            icone={<Layers />}
            titulo="Nenhum outfit ainda."
            descricao="Junte peças que combinam e marque quando usar."
            acao={
              <Botao variante="primario" tamanho="sm" onClick={() => setMontar({})}>
                <Plus /> Montar outfit
              </Botao>
            }
          />
        )}
      </div>

      <JanelaPeca
        peca={pecaAberta}
        outfits={outfits}
        aberta={pecaAberta !== null}
        aoMudar={(v) => !v && setAbertaPecaId(null)}
        aoEditar={(p) => {
          setAbertaPecaId(null)
          setFormulario({ peca: p, comprado: p.comprado })
        }}
        hoje={hoje}
      />
      <JanelaOutfit
        outfit={outfitAberto}
        aberta={outfitAberto !== null}
        aoMudar={(v) => !v && setAbertoOutfitId(null)}
        aoEditar={(o) => {
          setAbertoOutfitId(null)
          setMontar({ outfit: o })
        }}
        hoje={hoje}
      />
      <JanelaFormPeca
        aberta={formulario !== null}
        aoMudar={(v) => !v && setFormulario(null)}
        peca={formulario?.peca}
        comprado={formulario?.comprado ?? false}
        pecas={pecas}
        outfits={outfits}
      />
      <JanelaMontarOutfit
        aberta={montar !== null}
        aoMudar={(v) => !v && setMontar(null)}
        outfit={montar?.outfit}
        pecas={pecas}
        outfits={outfits}
        aoAdicionarPeca={() => setFormulario({ comprado: true })}
      />
    </div>
  )
}
