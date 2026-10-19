"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Cake, Ellipsis, FileText, Layers, NotebookPen, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, ErroCarregar } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { normalizar } from "@/lib/utils"
import { NavVida, Subpaginas, TextoDaPagina } from "@/features/vida/pagina-hub"
import { CartaoAniversarios, FormAniversario } from "./aniversarios"
import { CartaoContatos, FormContato } from "./contatos"
import { CartaoDiario } from "./diario"
import { useDadosPessoal, useFavoritos, usePaginaPessoal } from "./dados"
import { type Aniversario, type Contato, categoriasDosContatos } from "./logica"
import { FraseDoDia, OutrasListas, SitesFavoritos } from "./ui"
import { FormPaginaWiki, SecaoWiki } from "./wiki"

/**
 * Pessoal: o diário de hoje, os aniversários, a wiki, os contatos e os sites favoritos, numa só
 * tela. Os formulários ficam aqui, para o menu ⋯ e os cartões abrirem a mesma janela.
 */
export function PaginaPessoal() {
  const router = useRouter()
  const { colecoes, diario, aniversarios, contatos, wiki, carregando: carregandoDados, erro } = useDadosPessoal()
  const { pagina, frases, carregando: carregandoPagina } = usePaginaPessoal()
  const favoritos = useFavoritos()

  const [contatoAberto, setContatoAberto] = React.useState(false)
  const [contatoEditando, setContatoEditando] = React.useState<Contato | null>(null)
  const [aniversarioAberto, setAniversarioAberto] = React.useState(false)
  const [aniversarioEditando, setAniversarioEditando] = React.useState<Aniversario | null>(null)
  const [wikiAberta, setWikiAberta] = React.useState(false)

  const novoContato = () => {
    setContatoEditando(null)
    setContatoAberto(true)
  }
  const editarContato = (c: Contato) => {
    setContatoEditando(c)
    setContatoAberto(true)
  }
  const novoAniversario = () => {
    setAniversarioEditando(null)
    setAniversarioAberto(true)
  }
  const editarAniversario = (a: Aniversario) => {
    setAniversarioEditando(a)
    setAniversarioAberto(true)
  }

  const categorias = React.useMemo(() => categoriasDosContatos(contatos).map((c) => c.nome), [contatos])
  const carregando = carregandoDados || carregandoPagina

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Pessoal"
        descricao="Seu diário, os aniversários, os contatos e a sua wiki pessoal."
        acoes={
          <Menu>
            <MenuGatilho asChild>
              <Botao variante="contorno" tamanho="icone" aria-label="Mais opções de Pessoal">
                <Ellipsis />
              </Botao>
            </MenuGatilho>
            <MenuConteudo className="w-60">
              <MenuItem onSelect={novoContato}>
                <Plus /> Novo contato
              </MenuItem>
              <MenuItem onSelect={novoAniversario}>
                <Cake /> Novo aniversário
              </MenuItem>
              <MenuItem onSelect={() => setWikiAberta(true)}>
                <NotebookPen /> Nova página na wiki
              </MenuItem>
              {colecoes.diario || colecoes.aniversarios || colecoes.contatos || colecoes.wiki ? <MenuSeparador /> : null}
              {colecoes.diario ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.diario!.id}`)}>
                  <Layers /> Diário em tabela
                </MenuItem>
              ) : null}
              {colecoes.aniversarios ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.aniversarios!.id}`)}>
                  <Layers /> Aniversários em tabela
                </MenuItem>
              ) : null}
              {colecoes.contatos ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.contatos!.id}`)}>
                  <Layers /> Contatos em tabela
                </MenuItem>
              ) : null}
              {colecoes.wiki ? (
                <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.wiki!.id}`)}>
                  <Layers /> Wiki em tabela
                </MenuItem>
              ) : null}
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
      <NavVida atual="pessoal" />

      {carregando ? (
        <Carregando linhas={6} />
      ) : erro ? (
        <ErroCarregar erro={erro} />
      ) : (
        <div className="grid gap-10">
          {frases.length ? <FraseDoDia frases={frases} /> : null}

          <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
            <CartaoDiario entradas={diario} colecao={colecoes.diario} />
            <CartaoAniversarios aniversarios={aniversarios} contatos={contatos} aoNovo={novoAniversario} aoEditar={editarAniversario} />
          </div>

          <SecaoWiki paginas={wiki} aoNova={() => setWikiAberta(true)} />

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
            <CartaoContatos contatos={contatos} aoNovo={novoContato} aoEditar={editarContato} />
            <div className="grid content-start gap-10">
              <SitesFavoritos sites={favoritos} />
              {pagina ? <Subpaginas paiId={pagina.id} titulo="Outras páginas" ocultar={(p) => normalizar(p.title).startsWith("banco de dados")} /> : null}
              {colecoes.extras.length ? <OutrasListas colecoes={colecoes.extras} /> : null}
            </div>
          </div>

          {pagina ? <TextoDaPagina id={pagina.id} /> : null}
        </div>
      )}

      <FormContato aberta={contatoAberto} aoMudar={setContatoAberto} contato={contatoEditando} categorias={categorias} />
      <FormAniversario aberta={aniversarioAberto} aoMudar={setAniversarioAberto} aniversario={aniversarioEditando} />
      <FormPaginaWiki aberta={wikiAberta} aoMudar={setWikiAberta} />
    </div>
  )
}
