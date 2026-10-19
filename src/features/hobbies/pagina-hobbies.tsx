"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Check, Crown, Ellipsis, FileText, Layers, Play, Plus } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, ErroCarregar, Secao, Vazio } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { isoDia, plural } from "@/lib/utils"
import { NavVida } from "@/features/vida/pagina-hub"
import { filhosDe, type PaginaResumo } from "@/features/paginas/dados"
import { enderecoDoFeed, marcarVoltaDoFeed } from "@/features/videos/endereco"
import {
  diasDaSemana,
  resumirHobby,
  resumirSemana,
  textoDesde,
  textoMinutos,
  textoSemana,
  useDadosHobbies,
  useGravarHobbies,
  useGruposDoNotion,
  usePaginasDosHobbies,
  usePaginasEmBranco,
  type GrupoDetectado,
  type Hobby,
  type Sessao,
} from "./dados"
import { FormHobby } from "./form-hobby"
import { FormPratica } from "./form-pratica"
import { ListaDePaginas } from "./material"
import { Bolinhas, CapaHobby, FaixaSemana } from "./ui"

/** Uma lista vazia sempre igual, para não refazer a busca das páginas em branco à toa. */
const SEM_PAGINAS: PaginaResumo[] = []

/**
 * Hobbies, do jeito que se pratica: um cartão por hobby com a meta da semana e o recado da última
 * prática; "Registrar" em dois toques; as páginas de estudo de cada um ficam na tela do hobby.
 */
export function PaginaHobbies() {
  const router = useRouter()
  const { colecoes, hobbies, sessoes, carregando, erro } = useDadosHobbies()
  const { pagina, paginas, carregando: carregandoPaginas } = usePaginasDosHobbies()
  const gravar = useGravarHobbies()
  const [registrar, setRegistrar] = React.useState(false)
  const [hobbyEscolhido, setHobbyEscolhido] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [montando, setMontando] = React.useState(false)

  const semHobbies = !carregando && !hobbies.length
  const { grupos, carregando: carregandoGrupos } = useGruposDoNotion(pagina?.id, paginas, semHobbies)

  // As páginas de Hobbies que não estão em nenhum hobby (sem hobbies ainda, são todas)
  const soltas = React.useMemo(() => {
    if (!pagina) return []
    const ligadas = new Set(hobbies.flatMap((h) => h.paginas))
    return filhosDe(paginas, pagina.id).filter((p) => !ligadas.has(p.id))
  }, [pagina, paginas, hobbies])
  // Aparecem quando já há hobbies, ou quando não há como montá-los do Notion (nada some da tela)
  const mostrarSoltas = hobbies.length > 0 || (semHobbies && !carregandoGrupos && !grupos.length)
  const emBranco = usePaginasEmBranco(mostrarSoltas ? soltas : SEM_PAGINAS)

  const hoje = isoDia()

  const praticar = (hobbyId: string | null) => {
    setHobbyEscolhido(hobbyId)
    setRegistrar(true)
  }

  const montar = async () => {
    setMontando(true)
    try {
      const base = Date.now()
      for (const [i, g] of grupos.entries()) {
        await gravar.criar("hobbies", { title: g.nome, props: { _paginas: g.paginas, ...(g.foto ? { Foto: g.foto } : {}) }, position: base + i })
      }
      toast.success(`${plural(grupos.length, "hobby pronto", "hobbies prontos")}`)
    } catch {
      // Quem grava já avisou o que deu errado
    }
    setMontando(false)
  }

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Hobbies"
        descricao="O que você está aprendendo: a prática da semana e o material de estudo."
        acoes={
          hobbies.length ? (
            <>
              <Botao variante="primario" onClick={() => praticar(null)}>
                <Plus /> Registrar prática
              </Botao>
              <Menu>
                <MenuGatilho asChild>
                  <Botao variante="contorno" tamanho="icone" aria-label="Mais opções dos hobbies">
                    <Ellipsis />
                  </Botao>
                </MenuGatilho>
                <MenuConteudo className="w-60">
                  <MenuItem onSelect={() => setNovo(true)}>
                    <Plus /> Novo hobby
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      marcarVoltaDoFeed()
                      router.push(enderecoDoFeed())
                    }}
                  >
                    <Play /> Vídeos de todos os hobbies
                  </MenuItem>
                  {colecoes.pratica || colecoes.hobbies || pagina ? <MenuSeparador /> : null}
                  {colecoes.pratica ? (
                    <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.pratica!.id}`)}>
                      <Layers /> Práticas em tabela
                    </MenuItem>
                  ) : null}
                  {colecoes.hobbies ? (
                    <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.hobbies!.id}`)}>
                      <Layers /> Hobbies em tabela
                    </MenuItem>
                  ) : null}
                  {pagina ? (
                    <MenuItem onSelect={() => router.push(`/paginas/${pagina.id}`)}>
                      <FileText /> Página antiga do Notion
                    </MenuItem>
                  ) : null}
                </MenuConteudo>
              </Menu>
            </>
          ) : null
        }
      />
      <NavVida atual="hobbies" />

      {carregando || carregandoPaginas || carregandoGrupos ? (
        <Carregando linhas={5} />
      ) : erro ? (
        <ErroCarregar erro={erro} />
      ) : !hobbies.length ? (
        <div className="grid gap-10">
          <PrimeiroUso grupos={grupos} aoMontar={montar} montando={montando} aoNovo={() => setNovo(true)} paginaAntiga={pagina?.id} />
          {mostrarSoltas && soltas.length ? (
            <Secao titulo="Páginas de Hobbies" descricao="Elas continuam aqui. Crie um hobby e coloque cada página no lugar certo.">
              <ListaDePaginas paginas={soltas} todas={paginas} hobbies={hobbies} atual={null} emBranco={emBranco} />
            </Secao>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-10">
          {sessoes.length ? <SemanaGeral sessoes={sessoes} hoje={hoje} /> : null}
          <ul className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {hobbies.map((h) => (
              <li key={h.id}>
                <CartaoHobby hobby={h} sessoes={sessoes.filter((s) => s.hobby === h.id)} nPaginas={h.paginas.filter((id) => paginas.some((p) => p.id === id)).length} hoje={hoje} aoPraticar={() => praticar(h.id)} />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setNovo(true)}
                className="flex h-full min-h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink toque:min-h-16"
              >
                <Plus className="size-4" aria-hidden /> Novo hobby
              </button>
            </li>
          </ul>
          {soltas.length ? (
            <Secao titulo="Páginas sem hobby" descricao="Estão em Hobbies, mas ainda não em nenhum hobby. Coloque cada uma no seu hobby ou exclua as que estão em branco.">
              <ListaDePaginas paginas={soltas} todas={paginas} hobbies={hobbies} atual={null} emBranco={emBranco} />
            </Secao>
          ) : null}
        </div>
      )}

      <FormPratica aberta={registrar} aoMudar={setRegistrar} hobbies={hobbies} sessoes={sessoes} hobbyInicial={hobbyEscolhido} />
      <FormHobby aberta={novo} aoMudar={setNovo} aoSalvo={(id) => router.push(`/vida/hobbies/${id}`)} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Primeiro uso                                                        */
/* ------------------------------------------------------------------ */

function PrimeiroUso({
  grupos,
  aoMontar,
  montando,
  aoNovo,
  paginaAntiga,
}: {
  grupos: GrupoDetectado[]
  aoMontar: () => void
  montando: boolean
  aoNovo: () => void
  /** A página "Hobbies" do Notion, para abrir como era. */
  paginaAntiga?: string
}) {
  if (!grupos.length)
    return (
      <Vazio
        icone={<Crown />}
        titulo="Nenhum hobby por aqui ainda."
        descricao="Crie um hobby para acompanhar a prática da semana e guardar as páginas de estudo dele."
        acao={
          <div className="flex flex-wrap gap-2">
            <Botao variante="primario" onClick={aoNovo}>
              <Plus /> Novo hobby
            </Botao>
            {paginaAntiga ? (
              <Botao asChild variante="fantasma">
                <Link href={`/paginas/${paginaAntiga}`}>
                  <FileText /> Abrir a página do Notion
                </Link>
              </Botao>
            ) : null}
          </div>
        }
      />
    )
  return (
    <section aria-labelledby="titulo-montar" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="titulo-montar" className="font-display text-lg font-semibold">
        Montar seus hobbies
      </h2>
      <p className="mt-1 max-w-xl text-sm text-ink-2">Achei estes blocos na sua página Hobbies do Notion. Cada um vira um hobby, com as páginas de estudo dele. Nada é apagado nem mudado de lugar.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {grupos.map((g) => (
          <li key={g.nome} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <span className="size-10 shrink-0 overflow-hidden rounded-md">
              <CapaHobby hobby={{ nome: g.nome, capa: null, capaUrl: g.foto }} />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{g.nome}</span>
            <span className="shrink-0 text-xs text-ink-3">{plural(g.paginas.length, "página")}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <Botao variante="primario" onClick={aoMontar} disabled={montando}>
          {montando ? "Montando…" : "Montar meus hobbies"}
        </Botao>
        <Botao variante="fantasma" onClick={aoNovo} disabled={montando}>
          Começar do zero
        </Botao>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* A semana                                                            */
/* ------------------------------------------------------------------ */

function SemanaGeral({ sessoes, hoje }: { sessoes: Sessao[]; hoje: string }) {
  const resumo = resumirSemana(sessoes, hoje)
  return (
    <section aria-label="Esta semana" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-3">Esta semana</p>
        <p className="mt-0.5 text-sm font-semibold">
          {resumo.dias.size ? `${plural(resumo.dias.size, "dia")} de prática` : "Nenhuma prática ainda"}
          {resumo.minutos ? <span className="font-normal text-ink-2"> · {textoMinutos(resumo.minutos)}</span> : null}
        </p>
      </div>
      <FaixaSemana dias={diasDaSemana(hoje)} praticados={resumo.dias} hoje={hoje} />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Cartão do hobby                                                     */
/* ------------------------------------------------------------------ */

function CartaoHobby({ hobby, sessoes, nPaginas, hoje, aoPraticar }: { hobby: Hobby; sessoes: Sessao[]; nPaginas: number; hoje: string; aoPraticar: () => void }) {
  const resumo = resumirHobby(sessoes, hoje)
  const dias = resumo.diasNaSemana.length
  const ultima = resumo.ultima
  return (
    // Em linha, como no Notion: a foto ao lado e as informações da semana ao lado dela
    <article className="group relative flex h-full overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong">
      <div className="relative w-28 shrink-0 self-stretch overflow-hidden sm:w-36">
        <CapaHobby hobby={hobby} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        {resumo.feitoHoje ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-pen px-2 py-0.5 text-[11px] font-medium text-pen-ink">
            <Check className="size-3" aria-hidden strokeWidth={2.5} /> Hoje
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <h3 className="font-medium leading-snug">
          <Link href={`/vida/hobbies/${hobby.id}`} className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-pen/40">
            {hobby.nome}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          {hobby.meta ? <Bolinhas feitas={dias} meta={hobby.meta} /> : null}
          <span>{hobby.meta ? textoSemana(hobby.meta, dias) : dias ? `${plural(dias, "dia")} nesta semana` : "Sem prática esta semana"}</span>
        </div>
        <p className="text-xs text-ink-3">{ultima ? `Última prática ${textoDesde(resumo.diasSemPraticar ?? 0)}${ultima.minutos ? ` · ${textoMinutos(ultima.minutos)}` : ""}` : "Sem prática registrada"}</p>
        {ultima?.proximo ? (
          <p className="line-clamp-2 text-xs text-ink-2">
            <span className="font-medium">Próxima vez:</span> {ultima.proximo}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Botao tamanho="sm" variante="contorno" className="relative z-10" onClick={aoPraticar} aria-label={`Registrar prática de ${hobby.nome}`}>
            <Plus /> Registrar
          </Botao>
          <Link href={`/vida/hobbies/${hobby.id}?aba=material`} className="relative z-10 rounded-sm text-xs text-ink-3 hover:text-ink">
            {nPaginas ? plural(nPaginas, "página") : "Sem páginas"}
          </Link>
        </div>
      </div>
    </article>
  )
}
