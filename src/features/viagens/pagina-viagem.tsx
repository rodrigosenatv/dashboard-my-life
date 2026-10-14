"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Ellipsis, Layers, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Carregando, ErroCarregar, Segmentos, Vazio } from "@/components/ui/basicos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { EditorMarkdown } from "@/components/markdown"
import { plural } from "@/lib/utils"
import { textoContagem, textoDias, textoPeriodo, useDadosViagens, useGravarViagens, type Situacao, type Viagem } from "./dados"
import { FormViagem } from "./form-viagem"
import { GastosViagem } from "./gastos"
import { MalaViagem } from "./mala"
import { RoteiroViagem } from "./roteiro"
import { CapaViagem } from "./ui"

const ABAS = ["roteiro", "gastos", "mala", "notas"] as const
type Aba = (typeof ABAS)[number]

const SITUACAO: Record<Situacao, string> = { quero: "Quero ir", proxima: "Próxima viagem", andamento: "Em viagem", realizada: "Realizada" }

/** Uma viagem: o roteiro dia a dia, os gastos contra o orçamento, a mala e as notas. */
export function PaginaViagem() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const { colecoes, viagens, paradas, gastos, campoFeito, carregando, erro } = useDadosViagens()
  const gravar = useGravarViagens()
  const [editar, setEditar] = React.useState(false)
  const [excluir, setExcluir] = React.useState(false)

  const pedida = params.get("aba")
  const aba: Aba = (ABAS as readonly string[]).includes(pedida ?? "") ? (pedida as Aba) : "roteiro"
  const mudarAba = (a: Aba) => router.replace(`/vida/viagens/${id}?aba=${a}`, { scroll: false })

  const viagem = viagens.find((v) => v.id === id)

  if (carregando) return <Carregando linhas={6} />
  if (erro) return <ErroCarregar erro={erro} />
  if (!viagem)
    return (
      <Vazio
        titulo="Viagem não encontrada."
        descricao="Ela pode ter sido excluída."
        acao={
          <Botao asChild variante="contorno">
            <Link href="/vida/viagens">Ver as viagens</Link>
          </Botao>
        }
      />
    )

  const minhasParadas = paradas.filter((p) => p.viagem === viagem.id)
  const meusGastos = gastos.filter((g) => g.viagem === viagem.id)
  const naMala = viagem.mala?.filter((i) => i.feito).length ?? 0
  const abrirEdicao = () => setEditar(true)

  const apagarTudo = () => {
    // Sai da página antes de apagar, para não piscar "Viagem não encontrada"
    router.push("/vida/viagens")
    void gravar.excluir([viagem.item, ...minhasParadas.map((p) => p.item), ...meusGastos.map((g) => g.item)])
    toast.success(`“${viagem.nome}” excluída`)
  }
  const juntos = [minhasParadas.length ? plural(minhasParadas.length, "item do roteiro", "itens do roteiro") : null, meusGastos.length ? plural(meusGastos.length, "gasto") : null].filter(Boolean)

  return (
    <div className="max-w-3xl">
      <Link href="/vida/viagens" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Viagens
      </Link>

      <header className="relative mb-6 overflow-hidden rounded-xl border border-line">
        <div className="relative aspect-[16/9] max-h-72 w-full sm:aspect-[21/7]">
          <CapaViagem viagem={viagem} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
          <div className="absolute right-3 top-3 flex gap-1.5">
            <Botao tamanho="sm" className="border-0 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60" onClick={abrirEdicao}>
              <Pencil /> Editar
            </Botao>
            <Menu>
              <MenuGatilho asChild>
                <Botao tamanho="icone-sm" className="border-0 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60" aria-label="Mais opções da viagem">
                  <Ellipsis />
                </Botao>
              </MenuGatilho>
              <MenuConteudo className="w-56">
                {colecoes.viagens ? (
                  <MenuItem onSelect={() => router.push(`/colecoes/item/${viagem.id}`)}>
                    <Layers /> Ver como item da coleção
                  </MenuItem>
                ) : null}
                <MenuSeparador />
                <MenuItem perigo onSelect={() => setExcluir(true)}>
                  <Trash2 /> Excluir viagem
                </MenuItem>
              </MenuConteudo>
            </Menu>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
            <p className="mb-1.5 inline-flex rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">{SITUACAO[viagem.situacao]}</p>
            <h1 className="font-display text-3xl font-semibold leading-tight">{viagem.nome}</h1>
            <p className="mt-1 text-sm text-white/85">
              {viagem.ida ? (
                <>
                  {textoPeriodo(viagem.ida, viagem.volta)} · {textoDias(viagem.dias)}
                  {viagem.situacao !== "realizada" ? (
                    <>
                      {" "}
                      · <span className="font-semibold text-white">{textoContagem(viagem)}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <button type="button" onClick={abrirEdicao} className="font-medium text-white underline-offset-2 hover:underline">
                  Sem data · definir
                </button>
              )}
            </p>
          </div>
        </div>
      </header>

      <Segmentos
        rotulo="Partes da viagem"
        valor={aba}
        aoMudar={mudarAba}
        className="mb-6"
        opcoes={[
          { valor: "roteiro", rotulo: "Roteiro", contagem: minhasParadas.length || undefined },
          { valor: "gastos", rotulo: "Gastos", contagem: meusGastos.length || undefined },
          { valor: "mala", rotulo: viagem.mala ? `Mala ${naMala}/${viagem.mala.length}` : "Mala" },
          { valor: "notas", rotulo: "Notas" },
        ]}
      />

      <div role="tabpanel" aria-label={aba}>
        {aba === "roteiro" ? (
          <RoteiroViagem viagem={viagem} viagens={viagens} paradas={minhasParadas} campoFeito={campoFeito} aoDefinirDatas={abrirEdicao} />
        ) : aba === "gastos" ? (
          <GastosViagem viagem={viagem} viagens={viagens} gastos={meusGastos} aoDefinirOrcamento={abrirEdicao} />
        ) : aba === "mala" ? (
          <MalaViagem viagem={viagem} />
        ) : (
          <NotasViagem viagem={viagem} />
        )}
      </div>

      <FormViagem
        aberta={editar}
        aoMudar={setEditar}
        viagem={viagem}
        aoExcluir={() => {
          setEditar(false)
          setExcluir(true)
        }}
      />
      <Confirmar
        aberta={excluir}
        aoMudar={setExcluir}
        titulo={`Excluir “${viagem.nome}”?`}
        descricao={juntos.length ? `Também saem ${juntos.join(" e ")}.` : undefined}
        aoConfirmar={apagarTudo}
      />
    </div>
  )
}

function NotasViagem({ viagem }: { viagem: Viagem }) {
  const gravar = useGravarViagens()
  return (
    <div className="grid gap-2">
      <p className="text-sm text-ink-2">Reservas, códigos de confirmação, telefones e links da viagem.</p>
      <EditorMarkdown
        key={viagem.id}
        rotulo="notas da viagem"
        valor={viagem.notas}
        placeholder={"Ex.:\n- Pousada do Sol: reserva ABC123, check-in às 14h\n- Passeio de barco: (71) 99999-0000\n- [Ingressos](https://…)"}
        aoSalvar={(v) => void gravar.mudar(viagem.item, () => ({ content: v.trim() ? v : null }))}
      />
    </div>
  )
}
