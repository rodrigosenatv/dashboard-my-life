"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Clapperboard, Ellipsis, FileText, ImageIcon, Layers, Plus, Popcorn, X } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, ErroCarregar, Segmentos, Vazio } from "@/components/ui/basicos"
import { Entrada } from "@/components/ui/campos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { hubPorSlug } from "@/features/vida/hubs"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { plural } from "@/lib/utils"
import { JanelaAdicionar } from "./adicionar"
import { JanelaCartazes, semCartazPendente, useBuscarCartazes } from "./cartazes"
import { useChaveTmdb, useDadosFilmes } from "./dados"
import { JanelaDetalhes } from "./detalhes"
import { Destaque } from "./destaque"
import { CartaoTitulo, Fileira } from "./fileira"
import { destaque, buscarNaLista, fileiras, type Filtro, type Titulo } from "./logica"
import { AtribuicaoTmdb } from "./ui"

/** A chave de "fechei o aviso dos cartazes": fica no navegador deste aparelho. */
const CHAVE_AVISO = "filmes:aviso-cartazes"

function avisoFechado(): boolean {
  try {
    return localStorage.getItem(CHAVE_AVISO) === "fechado"
  } catch {
    return false
  }
}

function fecharAviso() {
  try {
    localStorage.setItem(CHAVE_AVISO, "fechado")
  } catch {
    // Sem armazenamento: o aviso volta na próxima vez
  }
}

/** Filmes & Séries: o destaque, as fileiras que deslizam, a busca na lista e as janelas de cada título. */
export function PaginaFilmes() {
  const router = useRouter()
  const { colecao, titulos, carregando, erro } = useDadosFilmes()
  const { chave } = useChaveTmdb()
  const { pagina } = usePaginaDoHub(hubPorSlug("filmes-series"))
  const cartazes = useBuscarCartazes()

  const [filtro, setFiltro] = React.useState<Filtro>("tudo")
  const [busca, setBusca] = React.useState("")
  const [abertoId, setAbertoId] = React.useState<string | null>(null)
  const [adicionarAberta, setAdicionarAberta] = React.useState(false)
  const [cartazesAberta, setCartazesAberta] = React.useState(false)
  const [avisoAberto, setAvisoAberto] = React.useState(() => !avisoFechado())

  const tituloAberto = abertoId ? (titulos.find((t) => t.id === abertoId) ?? null) : null
  const semCartaz = semCartazPendente(titulos).length
  const filmes = titulos.filter((t) => t.tipo === "filme").length
  const series = titulos.length - filmes
  const visiveis = titulos.filter((t) => filtro === "tudo" || (filtro === "filmes" ? t.tipo === "filme" : t.tipo === "serie"))
  const termo = busca.trim()
  const achados = termo ? buscarNaLista(visiveis, termo) : []
  const destaqueAtual = destaque(titulos, filtro)
  const fileirasAtuais = fileiras(titulos, filtro)

  const abrir = (t: Titulo) => setAbertoId(t.id)
  const ativarCartazes = () => setCartazesAberta(true)
  const fecharAvisoAgora = () => {
    fecharAviso()
    setAvisoAberto(false)
  }

  const acoes = (
    <div className="flex items-center gap-2">
      <Botao variante="primario" aria-label="Adicionar filme ou série" onClick={() => setAdicionarAberta(true)}>
        <Plus /> Adicionar
      </Botao>
      <Menu>
        <MenuGatilho asChild>
          <Botao variante="contorno" tamanho="icone" aria-label="Mais opções de Filmes & Séries">
            <Ellipsis />
          </Botao>
        </MenuGatilho>
        <MenuConteudo className="w-64">
          <MenuItem onSelect={ativarCartazes}>
            <Clapperboard /> Cartazes (TMDB)
          </MenuItem>
          {chave && semCartaz > 0 ? (
            <MenuItem disabled={cartazes.rodando} onSelect={() => void cartazes.buscar()}>
              <ImageIcon /> Buscar cartazes
            </MenuItem>
          ) : null}
          {colecao || pagina ? <MenuSeparador /> : null}
          {colecao ? (
            <MenuItem onSelect={() => router.push(`/colecoes/${colecao.id}`)}>
              <Layers /> Ver em tabela
            </MenuItem>
          ) : null}
          {pagina ? (
            <MenuItem onSelect={() => router.push(`/paginas/${pagina.id}`)}>
              <FileText /> Página antiga do Notion
            </MenuItem>
          ) : null}
        </MenuConteudo>
      </Menu>
    </div>
  )

  // Sem chave: o convite para ativar os cartazes. Com chave: os títulos que a busca ainda não tentou
  const avisos = (
    <>
      {!chave && avisoAberto ? <AvisoCartazes aoAtivar={ativarCartazes} aoFechar={fecharAvisoAgora} /> : null}
      {chave && (semCartaz > 0 || cartazes.rodando) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <p aria-live="polite" className="text-sm text-ink-2">
            {cartazes.rodando ? `Buscando cartazes… ${cartazes.feitos} de ${cartazes.total}` : `${plural(semCartaz, "título")} sem cartaz`}
          </p>
          <Botao variante="contorno" tamanho="sm" disabled={cartazes.rodando} onClick={() => void cartazes.buscar()}>
            <ImageIcon /> Buscar cartazes
          </Botao>
        </div>
      ) : null}
    </>
  )

  return (
    <div>
      <Cabecalho area="geral" titulo="Filmes & Séries" descricao="O que assistir, o que já viu e a nota que deu." acoes={acoes} />
      <NavVida atual="filmes-series" />

      {carregando ? (
        <Carregando linhas={6} />
      ) : erro ? (
        <ErroCarregar erro={erro} />
      ) : (
        <div className="grid gap-6">
          {titulos.length === 0 ? (
            <>
              {avisos}
              <Vazio
                icone={<Popcorn />}
                titulo="Sua lista está vazia."
                descricao="Adicione filmes e séries para ver aqui, com cartaz, sinopse e onde assistir."
                acao={
                  <Botao variante="primario" tamanho="sm" onClick={() => setAdicionarAberta(true)}>
                    <Plus /> Adicionar
                  </Botao>
                }
              />
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Segmentos
                  rotulo="Mostrar"
                  valor={filtro}
                  aoMudar={setFiltro}
                  opcoes={[
                    { valor: "tudo", rotulo: "Tudo", contagem: titulos.length },
                    { valor: "filmes", rotulo: "Filmes", contagem: filmes },
                    { valor: "series", rotulo: "Séries", contagem: series },
                  ]}
                />
                <Entrada
                  type="search"
                  aria-label="Buscar na sua lista"
                  placeholder="Buscar na sua lista"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="sm:w-64"
                />
              </div>

              {termo ? (
                achados.length ? (
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {achados.map((t) => (
                      <CartaoTitulo key={t.id} titulo={t} aoAbrir={abrir} largura="grade" />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-2">Nada encontrado para “{termo}”.</p>
                )
              ) : (
                <>
                  {destaqueAtual ? <Destaque titulo={destaqueAtual.titulo} motivo={destaqueAtual.motivo} aoAbrir={() => abrir(destaqueAtual.titulo)} /> : null}
                  {/* Depois do destaque: no celular, o destaque aparece inteiro na primeira tela */}
                  {avisos}
                  {fileirasAtuais.length ? (
                    <div className="grid gap-9">
                      {fileirasAtuais.map((f) => (
                        <Fileira key={f.id} id={f.id} titulo={f.titulo} itens={f.itens} aoAbrir={abrir} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-2">Nenhum título nesta lista ainda.</p>
                  )}
                </>
              )}
            </>
          )}

          {chave ? <AtribuicaoTmdb /> : null}
        </div>
      )}

      <JanelaDetalhes titulo={tituloAberto} aberta={tituloAberto !== null} aoMudar={(v) => !v && setAbertoId(null)} />
      <JanelaAdicionar aberta={adicionarAberta} aoMudar={setAdicionarAberta} aoVer={abrir} />
      <JanelaCartazes aberta={cartazesAberta} aoMudar={setCartazesAberta} />
    </div>
  )
}

/** Sem chave do TMDB: um aviso de uma linha, que some com o "x" e fica fechado neste aparelho. */
function AvisoCartazes({ aoAtivar, aoFechar }: { aoAtivar: () => void; aoFechar: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border border-line bg-surface px-4 py-3.5">
      <Clapperboard aria-hidden className="size-4 shrink-0 text-pen" />
      {/* No celular o texto ocupa a linha toda e os botões descem para a de baixo; no computador fica tudo numa linha */}
      <p className="min-w-56 basis-0 grow text-sm text-ink-2">Deixe com cara de Netflix: ative os cartazes, a sinopse, o trailer e onde assistir.</p>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Botao variante="primario" tamanho="sm" onClick={aoAtivar}>
          Ativar cartazes
        </Botao>
        <Botao variante="fantasma" tamanho="icone-sm" aria-label="Fechar aviso" onClick={aoFechar}>
          <X />
        </Botao>
      </div>
    </div>
  )
}
