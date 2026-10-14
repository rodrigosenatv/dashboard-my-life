"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { CalendarDays, Ellipsis, FileText, Layers, Luggage, Plane, Plus, Wallet, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, ErroCarregar, Secao, Segmentos, Vazio } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { formatar, isoDia, plural } from "@/lib/utils"
import { NavVida, usePaginaDoHub } from "@/features/vida/pagina-hub"
import { hubPorSlug } from "@/features/vida/hubs"
import {
  reais,
  resumirGastos,
  separarViagens,
  textoContagem,
  textoDias,
  textoPeriodo,
  useDadosViagens,
  useGravarViagens,
  useSincronizarStatus,
  type Gasto,
  type Parada,
  type Viagem,
} from "./dados"
import { FormViagem } from "./form-viagem"
import { EditorModelo } from "./mala"
import { CapaViagem, IconeGasto, IconeParada } from "./ui"

type Aba = "proximas" | "quero" | "realizadas"

/**
 * Viagens, do jeito que se planeja: em destaque a que está acontecendo ou a próxima (com o
 * roteiro, os gastos e a mala à mão); embaixo, as próximas, a lista de desejos e as já feitas.
 */
export function PaginaViagens() {
  const router = useRouter()
  const { colecoes, viagens, paradas, gastos, carregando, erro } = useDadosViagens()
  const gravar = useGravarViagens()
  useSincronizarStatus(viagens, gravar.mudarProps)
  const { pagina } = usePaginaDoHub(hubPorSlug("viagens"))
  const [nova, setNova] = React.useState(false)
  const [modelo, setModelo] = React.useState(false)
  const [aba, setAba] = React.useState<Aba | null>(null)

  const { proximas, quero, realizadas, destaque } = React.useMemo(() => separarViagens(viagens), [viagens])
  const ids = new Set(viagens.map((v) => v.id))
  const paradasSoltas = paradas.filter((p) => !p.viagem || !ids.has(p.viagem))
  const gastosSoltos = gastos.filter((g) => !g.viagem || !ids.has(g.viagem))
  const abaAtual: Aba = aba ?? (proximas.length ? "proximas" : quero.length ? "quero" : realizadas.length ? "realizadas" : "proximas")

  const ligar = (item: Parada | Gasto, v: Viagem) => {
    void gravar.mudarProps(item.item, (p) => void (p._viagem = v.id))
    toast.success(`“${item.titulo}” agora está em ${v.nome}`)
  }

  return (
    <div>
      <Cabecalho
        area="geral"
        titulo="Viagens"
        descricao="Próximas viagens, lista de desejos e as que você já fez."
        acoes={
          <>
            <Botao variante="primario" onClick={() => setNova(true)}>
              <Plus /> Nova viagem
            </Botao>
            <Menu>
              <MenuGatilho asChild>
                <Botao variante="contorno" tamanho="icone" aria-label="Mais opções das viagens">
                  <Ellipsis />
                </Botao>
              </MenuGatilho>
              <MenuConteudo className="w-60">
                <MenuItem onSelect={() => setModelo(true)}>
                  <Luggage /> Modelo da mala
                </MenuItem>
                <MenuSeparador />
                {colecoes.viagens ? (
                  <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.viagens!.id}`)}>
                    <Layers /> Viagens em tabela
                  </MenuItem>
                ) : null}
                {colecoes.roteiro ? (
                  <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.roteiro!.id}`)}>
                    <CalendarDays /> Roteiros em tabela
                  </MenuItem>
                ) : null}
                {colecoes.gastos ? (
                  <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.gastos!.id}`)}>
                    <Wallet /> Gastos em tabela
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
          </>
        }
      />
      <NavVida atual="viagens" />

      {carregando ? (
        <Carregando linhas={5} />
      ) : erro ? (
        <ErroCarregar erro={erro} />
      ) : (
        <div className="grid gap-12">
          {!viagens.length ? (
            <Vazio
              icone={<Plane />}
              titulo="Nenhuma viagem por aqui ainda."
              descricao="Planeje a próxima com roteiro, gastos e mala, ou guarde um destino que você quer conhecer."
              acao={
                <Botao variante="primario" onClick={() => setNova(true)}>
                  <Plus /> Nova viagem
                </Botao>
              }
            />
          ) : (
            <>
              {destaque ? (
                <Destaque viagem={destaque} paradas={paradas.filter((p) => p.viagem === destaque.id)} gastos={gastos.filter((g) => g.viagem === destaque.id)} />
              ) : null}
              <section aria-labelledby="titulo-suas-viagens">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 id="titulo-suas-viagens" className="font-display text-lg font-semibold">
                    Suas viagens
                  </h2>
                  <Segmentos
                    rotulo="Quais viagens mostrar"
                    valor={abaAtual}
                    aoMudar={setAba}
                    opcoes={[
                      { valor: "proximas", rotulo: "Próximas", contagem: proximas.length },
                      { valor: "quero", rotulo: "Quero ir", contagem: quero.length },
                      { valor: "realizadas", rotulo: "Realizadas", contagem: realizadas.length },
                    ]}
                  />
                </div>
                {abaAtual === "proximas" ? (
                  proximas.length ? (
                    <Grade viagens={proximas} gastos={gastos} />
                  ) : (
                    <Vazio titulo="Nenhuma viagem marcada." descricao="Com datas, a viagem aparece aqui e em destaque no topo." acao={<Botao onClick={() => setNova(true)}><Plus /> Nova viagem</Botao>} />
                  )
                ) : abaAtual === "quero" ? (
                  quero.length ? (
                    <Grade viagens={quero} gastos={gastos} />
                  ) : (
                    <Vazio titulo="A lista de desejos está vazia." descricao="Crie uma viagem sem data para guardar um destino que você quer conhecer." acao={<Botao onClick={() => setNova(true)}><Plus /> Nova viagem</Botao>} />
                  )
                ) : realizadas.length ? (
                  <Realizadas viagens={realizadas} gastos={gastos} />
                ) : (
                  <Vazio titulo="Nenhuma viagem realizada ainda." descricao="Depois da volta, a viagem passa para cá sozinha." />
                )}
              </section>
            </>
          )}
          {paradasSoltas.length || gastosSoltos.length ? <ItensSoltos paradas={paradasSoltas} gastos={gastosSoltos} viagens={[...proximas, ...quero, ...realizadas]} aoLigar={ligar} /> : null}
        </div>
      )}

      <FormViagem aberta={nova} aoMudar={setNova} aoSalva={(id) => router.push(`/vida/viagens/${id}`)} />
      <EditorModelo aberta={modelo} aoMudar={setModelo} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Destaque                                                            */
/* ------------------------------------------------------------------ */

function Destaque({ viagem, paradas, gastos }: { viagem: Viagem; paradas: Parada[]; gastos: Gasto[] }) {
  const resumo = resumirGastos(gastos)
  const naMala = viagem.mala?.filter((i) => i.feito).length ?? 0
  const hoje = isoDia()
  const doDia = viagem.situacao === "andamento" ? paradas.filter((p) => p.data === hoje).sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99")) : []
  const link = (aba: string) => `/vida/viagens/${viagem.id}?aba=${aba}`

  return (
    <section aria-labelledby="titulo-destaque" className="overflow-hidden rounded-xl border border-line bg-surface">
      <Link href={`/vida/viagens/${viagem.id}`} className="group relative block aspect-[16/9] max-h-80 w-full overflow-hidden sm:aspect-[21/8]">
        <CapaViagem viagem={viagem} className="transition-transform duration-500 group-hover:scale-[1.02]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
          <p className="mb-1.5 inline-flex rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
            {viagem.situacao === "andamento" ? "Em viagem" : "Próxima viagem"}
          </p>
          <h2 id="titulo-destaque" className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
            {viagem.nome}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            {textoPeriodo(viagem.ida, viagem.volta)} · {textoDias(viagem.dias)} · <span className="font-semibold text-white">{textoContagem(viagem)}</span>
          </p>
        </div>
      </Link>

      {doDia.length ? (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <p className="mb-1.5 text-xs font-medium text-ink-3">Hoje no roteiro</p>
          <ul className="grid gap-1">
            {doDia.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-sm">
                <span className="w-11 shrink-0 tabular text-ink-3">{p.hora ?? "–"}</span>
                <IconeParada parada={p} className="size-4 shrink-0 text-ink-3" />
                <span className={p.feito ? "truncate text-ink-3 line-through" : "truncate"}>{p.titulo}</span>
              </li>
            ))}
          </ul>
          {doDia.length > 4 ? (
            <Link href={link("roteiro")} className="mt-1.5 inline-block text-xs font-medium text-ink-2 hover:text-ink">
              Mais {doDia.length - 4} no roteiro
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
        <Atalho href={link("roteiro")} icone={CalendarDays} rotulo="Roteiro" valor={paradas.length ? plural(paradas.length, "item", "itens") : "Montar"} vazio={!paradas.length} />
        <Atalho
          href={link("gastos")}
          icone={Wallet}
          rotulo="Gastos"
          valor={resumo.previsao || resumo.gasto ? reais(resumo.gasto) : viagem.orcamento ? reais(0) : "Planejar"}
          detalhe={viagem.orcamento ? `de ${reais(viagem.orcamento)}` : resumo.previsao > resumo.gasto ? `previsão ${reais(resumo.previsao)}` : undefined}
          vazio={!resumo.previsao && !viagem.orcamento}
        />
        <Atalho href={link("mala")} icone={Luggage} rotulo="Mala" valor={viagem.mala ? `${naMala} de ${viagem.mala.length}` : "Montar"} detalhe={viagem.mala ? "itens prontos" : undefined} vazio={!viagem.mala} />
      </div>
    </section>
  )
}

function Atalho({ href, icone: Icone, rotulo, valor, detalhe, vazio }: { href: string; icone: LucideIcon; rotulo: string; valor: string; detalhe?: string; vazio?: boolean }) {
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-0.5 px-3 py-3 transition-colors hover:bg-surface-2 sm:px-5">
      <span className="flex items-center gap-1.5 text-xs text-ink-3">
        <Icone className="size-3.5" aria-hidden /> {rotulo}
      </span>
      <span className={vazio ? "text-sm font-medium text-pen" : "truncate text-sm font-semibold tabular"}>{valor}</span>
      {detalhe ? <span className="truncate text-xs text-ink-3">{detalhe}</span> : null}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Cartões                                                             */
/* ------------------------------------------------------------------ */

function Grade({ viagens, gastos }: { viagens: Viagem[]; gastos: Gasto[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {viagens.map((v) => (
        <li key={v.id}>
          <CartaoViagem viagem={v} gastos={gastos.filter((g) => g.viagem === v.id)} />
        </li>
      ))}
    </ul>
  )
}

function CartaoViagem({ viagem: v, gastos }: { viagem: Viagem; gastos: Gasto[] }) {
  const resumo = resumirGastos(gastos)
  const extra =
    v.situacao === "proxima" || v.situacao === "andamento"
      ? textoContagem(v)
      : v.situacao === "realizada"
        ? resumo.gasto
          ? `${reais(resumo.gasto)} gastos`
          : null
        : v.orcamento
          ? `Orçamento ${reais(v.orcamento)}`
          : null
  return (
    // No celular, em linha (foto pequena ao lado), para ver várias de uma vez; do tablet para cima, cartão
    <Link
      href={`/vida/viagens/${v.id}`}
      className="group flex h-full overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong sm:flex-col"
    >
      <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden sm:aspect-[16/9] sm:w-full">
        <CapaViagem viagem={v} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        {v.situacao === "andamento" ? (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-pen px-2 py-0.5 text-[11px] font-medium text-pen-ink sm:left-2.5 sm:top-2.5">Em viagem</span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 sm:p-3.5">
        <p className="font-medium leading-snug">{v.nome}</p>
        <p className="text-sm text-ink-2">{v.ida ? `${textoPeriodo(v.ida, v.volta)} · ${textoDias(v.dias)}` : "Sem data"}</p>
        {extra ? <p className="mt-auto pt-1 text-xs font-medium text-ink-3">{extra}</p> : null}
      </div>
    </Link>
  )
}

/** As já feitas, por ano, com quantas viagens e dias em cada um. */
function Realizadas({ viagens, gastos }: { viagens: Viagem[]; gastos: Gasto[] }) {
  const anos = new Map<string, Viagem[]>()
  for (const v of viagens) {
    const ano = v.ida?.slice(0, 4) ?? "Sem data"
    anos.set(ano, [...(anos.get(ano) ?? []), v])
  }
  return (
    <div className="grid gap-8">
      {[...anos].map(([ano, lista]) => {
        const dias = lista.reduce((n, v) => n + (v.dias ?? 0), 0)
        return (
          <section key={ano} aria-label={ano}>
            <h3 className="mb-3 flex items-baseline gap-2">
              <span className="font-display text-base font-semibold">{ano}</span>
              <span className="text-sm text-ink-3">
                {plural(lista.length, "viagem", "viagens")}
                {dias ? ` · ${textoDias(dias)}` : ""}
              </span>
            </h3>
            <Grade viagens={lista} gastos={gastos} />
          </section>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Itens sem viagem                                                    */
/* ------------------------------------------------------------------ */

function ItensSoltos({ paradas, gastos, viagens, aoLigar }: { paradas: Parada[]; gastos: Gasto[]; viagens: Viagem[]; aoLigar: (item: Parada | Gasto, v: Viagem) => void }) {
  return (
    <Secao titulo="Sem viagem" descricao="Do roteiro e dos gastos, ainda sem viagem ligada.">
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {paradas.map((p) => (
          <LinhaSolta
            key={p.id}
            icone={<IconeParada parada={p} className="size-4 shrink-0 text-ink-3" />}
            titulo={p.titulo}
            detalhe={["Roteiro", p.data ? formatar(p.data, "d 'de' MMM yyyy") : null, p.endereco || null].filter(Boolean).join(" · ")}
            viagens={viagens}
            aoEscolher={(v) => aoLigar(p, v)}
          />
        ))}
        {gastos.map((g) => (
          <LinhaSolta
            key={g.id}
            icone={<IconeGasto tipo={g.tipo} className="size-4 shrink-0 text-ink-3" />}
            titulo={g.titulo}
            detalhe={["Gasto", g.realizado !== null ? `pago ${reais(g.realizado)}` : g.previsto !== null ? `previsto ${reais(g.previsto)}` : null, g.categoria || null].filter(Boolean).join(" · ")}
            viagens={viagens}
            aoEscolher={(v) => aoLigar(g, v)}
          />
        ))}
      </ul>
    </Secao>
  )
}

function LinhaSolta({ icone, titulo, detalhe, viagens, aoEscolher }: { icone: React.ReactNode; titulo: string; detalhe: string; viagens: Viagem[]; aoEscolher: (v: Viagem) => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {icone}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        <p className="truncate text-xs text-ink-3">{detalhe}</p>
      </div>
      {viagens.length ? (
        <Menu>
          <MenuGatilho asChild>
            <Botao variante="contorno" tamanho="sm" aria-label={`Ligar “${titulo}” a uma viagem`}>
              Ligar
            </Botao>
          </MenuGatilho>
          <MenuConteudo className="max-h-72 overflow-y-auto">
            {viagens.map((v) => (
              <MenuItem key={v.id} onSelect={() => aoEscolher(v)}>
                <span className="min-w-0 flex-1 truncate">{v.nome}</span>
                <span className="shrink-0 text-xs text-ink-3">{v.ida ? formatar(v.ida, "MMM yyyy") : "sem data"}</span>
              </MenuItem>
            ))}
          </MenuConteudo>
        </Menu>
      ) : (
        <span className="shrink-0 text-xs text-ink-3">Crie uma viagem para ligar</span>
      )}
    </li>
  )
}
