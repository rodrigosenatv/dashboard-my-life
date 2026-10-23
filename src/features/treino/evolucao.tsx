"use client"

import Link from "next/link"
import * as React from "react"
import { Camera, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Esqueleto, Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Confirmar, Janela } from "@/components/ui/janela"
import { useSessao } from "@/components/provedores"
import { useUrlArquivo } from "@/lib/arquivos"
import { novoId, useAtualizar, useCriar, useExcluir } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Json } from "@/lib/supabase/database.types"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import { cn, formatar, haQuanto, isoDia, normalizar, plural } from "@/lib/utils"
import { esquema, type Colecao, type Propriedade } from "@/features/colecoes/visao-colecao"
import {
  PREFIXO_ARQUIVO,
  camposAvaliacao,
  kg,
  lerAvaliacao,
  lerNumeroDigitado,
  ordenarAvaliacoes,
  proximoNumero,
  useItensDe,
  valores,
  type Avaliacao,
  type CamposAvaliacao,
} from "./dados"

const TAMANHO_MAXIMO_FOTO = 15 * 1024 * 1024
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`

/** Peso, % de gordura e fotos das avaliações corporais. */
export function EvolucaoCorporal({ colecao }: { colecao: Colecao | undefined }) {
  const { data: itens = [], isLoading } = useItensDe(colecao)
  const criarColecao = useCriar("collections", { aviso: "Avaliações criadas" })
  const campos = React.useMemo(() => camposAvaliacao(colecao, itens), [colecao, itens])
  const avaliacoes = React.useMemo(() => ordenarAvaliacoes(itens.map((i) => lerAvaliacao(i, campos))), [itens, campos])
  const [aberta, setAberta] = React.useState<Avaliacao | "nova" | null>(null)

  const botaoNova = colecao ? (
    <Botao variante="contorno" tamanho="sm" onClick={() => setAberta("nova")}>
      <Plus /> Nova avaliação
    </Botao>
  ) : null

  if (!colecao)
    return (
      <Secao titulo="Evolução">
        <Vazio
          titulo="Acompanhe peso e medidas"
          descricao="Registre peso, % de gordura e uma foto de tempos em tempos para ver a evolução."
          acao={
            <Botao
              variante="primario"
              onClick={() =>
                criarColecao.mutate({
                  id: novoId(),
                  name: "Avaliação Corporal",
                  section: "outros",
                  description: "Treino",
                  schema: [
                    { name: "Data", type: "date" },
                    { name: "Peso (Kg)", type: "number" },
                    { name: "PGC (%)", type: "number" },
                    { name: "Foto Principal", type: "text" },
                  ],
                })
              }
            >
              <Plus /> Começar a registrar
            </Botao>
          }
        />
      </Secao>
    )

  const comPeso = avaliacoes.filter((a) => a.peso !== null && a.data)
  const primeiroPeso = comPeso[0]
  const ultimoPeso = comPeso.at(-1)
  const comGordura = avaliacoes.filter((a) => a.gordura !== null)
  const ultimaGordura = comGordura.at(-1)
  const ultima = [...avaliacoes].reverse().find((a) => a.data)
  const comFoto = avaliacoes.filter((a) => a.foto)
  const perdidas = avaliacoes.filter((a) => a.fotoPerdida).length
  const diferenca = primeiroPeso && ultimoPeso && primeiroPeso !== ultimoPeso ? ultimoPeso.peso! - primeiroPeso.peso! : null
  const recentes = [...avaliacoes].reverse()
  const mostradas = recentes.slice(0, 6)

  return (
    <Secao titulo="Evolução" acao={botaoNova}>
      {isLoading ? (
        <Esqueleto className="h-72 rounded-xl" />
      ) : avaliacoes.length === 0 ? (
        <Vazio titulo="Nenhuma avaliação ainda." descricao="Registre peso, % de gordura e uma foto de tempos em tempos para ver a evolução." />
      ) : (
        <div className="grid gap-5">
          <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <dl className="flex flex-wrap items-start gap-x-8 gap-y-4">
              {ultimoPeso ? (
                <div>
                  <dt className="text-xs text-ink-3">Peso</dt>
                  <dd className="text-3xl font-semibold leading-tight">{kg(ultimoPeso.peso!)}</dd>
                  <dd className="text-sm text-ink-2">
                    {diferenca !== null
                      ? `${diferenca > 0 ? "+" : diferenca < 0 ? "−" : ""}${kg(Math.abs(diferenca))} desde ${formatar(primeiroPeso!.data, "MMM yyyy")}`
                      : `em ${formatar(ultimoPeso.data, "d MMM yyyy")}`}
                  </dd>
                </div>
              ) : null}
              {ultimaGordura ? (
                <div>
                  <dt className="text-xs text-ink-3">Gordura</dt>
                  <dd className="text-3xl font-semibold leading-tight">{pct(ultimaGordura.gordura!)}</dd>
                  <dd className="text-sm text-ink-2">em {formatar(ultimaGordura.data, "d MMM yyyy")}</dd>
                </div>
              ) : null}
              {ultima ? (
                <div className="ml-auto text-right">
                  <dt className="text-xs text-ink-3">Última avaliação</dt>
                  <dd className="text-sm font-medium">{formatar(ultima.data, "d 'de' MMM yyyy")}</dd>
                  <dd className="text-xs text-ink-3">{haQuanto(ultima.data)}</dd>
                </div>
              ) : null}
            </dl>
            {comPeso.length >= 2 ? <GraficoPeso avaliacoes={comPeso} className="mt-5" /> : null}
          </div>

          {comFoto.length ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Fotos</h3>
              <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 scrollbar-thin">
                {comFoto.map((a) => (
                  <li key={a.item.id} className="w-28 shrink-0 snap-start">
                    <Link href={`/colecoes/item/${a.item.id}`} className="block rounded-lg">
                      <Foto caminho={a.foto!} alt={`Foto de ${a.data ? formatar(a.data, "d 'de' MMM yyyy") : a.item.title}`} />
                      <span className="mt-1 block text-xs text-ink-3">{a.data ? formatar(a.data, "d MMM yyyy") : a.item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {perdidas ? (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-ink-2">
              {perdidas === 1 ? "A foto de 1 avaliação ficou no Notion." : `As fotos de ${perdidas} avaliações ficaram no Notion.`} Para trazer, abra{" "}
              <Link href="/configuracoes" className="font-medium text-pen hover:underline">
                Configurações
              </Link>
              , escolha o mesmo .zip em Importar do Notion e toque em Recuperar fotos. Nada é apagado.
            </p>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-medium">Avaliações</h3>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {mostradas.map((a) => (
                <li key={a.item.id}>
                  <button type="button" onClick={() => setAberta(a)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60 toque:min-h-12">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{a.data ? formatar(a.data, "d 'de' MMM yyyy") : "Sem data"}</span>
                      <span className="block truncate text-xs text-ink-3">{a.item.title}</span>
                    </span>
                    <span className="text-sm tabular">{a.peso !== null ? kg(a.peso) : "–"}</span>
                    {comGordura.length ? <span className="w-12 text-right text-sm text-ink-2 tabular">{a.gordura !== null ? pct(a.gordura) : "–"}</span> : null}
                    <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {recentes.length > mostradas.length ? (
              <Link href={`/colecoes/${colecao.id}`} className="mt-2 inline-block text-sm font-medium text-pen hover:underline">
                Ver todas as {plural(recentes.length, "avaliação", "avaliações")}
              </Link>
            ) : null}
          </div>
        </div>
      )}

      <DialogoAvaliacao
        aberta={aberta !== null}
        aoFechar={() => setAberta(null)}
        colecao={colecao}
        campos={campos}
        avaliacao={aberta === "nova" ? null : aberta}
        numero={proximoNumero(avaliacoes)}
        proximaPosicao={Math.max(0, ...itens.map((i) => i.position)) + 1}
      />
    </Secao>
  )
}

function Foto({ caminho, alt, className }: { caminho: string; alt: string; className?: string }) {
  const { data, isError } = useUrlArquivo(caminho)
  if (isError) return <div className={cn("grid aspect-[3/4] place-items-center rounded-lg bg-surface-2 text-xs text-ink-3", className)}>Sem foto</div>
  return data ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data} alt={alt} loading="lazy" className={cn("aspect-[3/4] w-full rounded-lg object-cover", className)} />
  ) : (
    <div className={cn("aspect-[3/4] animate-pulse rounded-lg bg-surface-2", className)} />
  )
}

/* ------------------------------------------------------------------ */
/* Gráfico do peso                                                     */
/* ------------------------------------------------------------------ */

const MARGEM = { topo: 14, direita: 64, base: 26, esquerda: 34 }
const ALTURA_GRAFICO = 168

/** Marcas da escala: no máximo 4, em números redondos, sem encostar os pontos na borda. */
function escala(min: number, max: number) {
  for (const passo of [0.5, 1, 2, 5, 10, 20, 50]) {
    let lo = Math.floor(min / passo) * passo
    let hi = Math.ceil(max / passo) * passo
    if (lo === min) lo -= passo
    if (hi === max) hi += passo
    const n = Math.round((hi - lo) / passo) + 1
    if (n <= 4) return { lo, hi, marcas: Array.from({ length: n }, (_, i) => lo + i * passo) }
  }
  return { lo: min - 1, hi: max + 1, marcas: [min, max] }
}

function useLargura<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  const [largura, setLargura] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setLargura(Math.round(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, largura] as const
}

function GraficoPeso({ avaliacoes, className }: { avaliacoes: Avaliacao[]; className?: string }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = React.useState<number | null>(null)
  const pontos = avaliacoes.map((a) => ({ t: new Date(`${a.data}T12:00`).getTime(), peso: a.peso!, a }))
  const { lo, hi, marcas } = escala(Math.min(...pontos.map((p) => p.peso)), Math.max(...pontos.map((p) => p.peso)))
  const t0 = pontos[0].t
  const t1 = pontos.at(-1)!.t
  const x0 = MARGEM.esquerda
  const x1 = Math.max(x0 + 1, largura - MARGEM.direita)
  const y0 = MARGEM.topo
  const y1 = ALTURA_GRAFICO - MARGEM.base
  const x = (t: number) => (t1 === t0 ? (x0 + x1) / 2 : x0 + ((t - t0) / (t1 - t0)) * (x1 - x0))
  const y = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0)
  const xy = pontos.map((p) => ({ ...p, x: x(p.t), y: y(p.peso) }))
  const linha = xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const area = `${linha} L${xy.at(-1)!.x.toFixed(1)},${y1} L${xy[0].x.toFixed(1)},${y1} Z`
  const fim = xy.at(-1)!
  const destaque = ativo !== null ? xy[ativo] : null

  // A mira acha o ponto mais perto na horizontal: não precisa acertar a bolinha
  const aoMover = (e: React.PointerEvent<SVGRectElement>) => {
    const caixa = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!caixa) return
    const px = e.clientX - caixa.left
    let perto = 0
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i].x - px) < Math.abs(xy[perto].x - px)) perto = i
    setAtivo(perto)
  }

  return (
    <figure className={className}>
      <figcaption className="sr-only">Peso ao longo das avaliações</figcaption>
      <div ref={ref} className="relative" style={{ height: ALTURA_GRAFICO }}>
        {largura ? (
          <svg width={largura} height={ALTURA_GRAFICO} className="block overflow-visible" role="img" aria-label={`Peso de ${kg(pontos[0].peso)} a ${kg(fim.peso)}`}>
            {marcas.map((m) => (
              <g key={m}>
                <line x1={x0} x2={x1} y1={y(m)} y2={y(m)} className="stroke-line" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={x0 - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                  {m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </text>
              </g>
            ))}
            <path d={area} className="fill-pen" opacity={0.1} />
            <path d={linha} fill="none" className="stroke-pen" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {destaque ? <line x1={destaque.x} x2={destaque.x} y1={y0} y2={y1} className="stroke-line-strong" strokeWidth={1} shapeRendering="crispEdges" /> : null}
            <rect x={x0 - 12} y={0} width={x1 - x0 + 24} height={ALTURA_GRAFICO} fill="transparent" onPointerMove={aoMover} onPointerDown={aoMover} onPointerLeave={() => setAtivo(null)} />
            {xy.map((p, i) => (
              <circle
                key={p.a.item.id}
                cx={p.x}
                cy={p.y}
                r={ativo === i ? 5.5 : 4}
                className="fill-pen stroke-surface outline-none"
                strokeWidth={2}
                tabIndex={0}
                aria-label={`${formatar(p.a.data, "d 'de' MMM yyyy")}: ${kg(p.peso)}`}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                onPointerEnter={() => setAtivo(i)}
              />
            ))}
            <text x={fim.x + 10} y={fim.y} dy="0.32em" className="fill-ink text-xs font-semibold">
              {kg(fim.peso)}
            </text>
            <text x={xy[0].x} y={ALTURA_GRAFICO - 6} textAnchor="start" className="fill-ink-3 text-[11px]">
              {formatar(pontos[0].a.data, "MMM yyyy")}
            </text>
            <text x={fim.x} y={ALTURA_GRAFICO - 6} textAnchor="end" className="fill-ink-3 text-[11px]">
              {formatar(fim.a.data, "MMM yyyy")}
            </text>
          </svg>
        ) : null}
        {destaque ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-overlay"
            style={{ left: destaque.x, top: destaque.y - 10 }}
          >
            <strong className="block text-sm font-semibold text-ink">{kg(destaque.peso)}</strong>
            <span className="text-ink-3">{formatar(destaque.a.data, "d 'de' MMM yyyy")}</span>
          </div>
        ) : null}
      </div>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Janela da avaliação                                                 */
/* ------------------------------------------------------------------ */

function DialogoAvaliacao({
  aberta,
  aoFechar,
  colecao,
  campos,
  avaliacao,
  numero,
  proximaPosicao,
}: {
  aberta: boolean
  aoFechar: () => void
  colecao: Colecao
  campos: CamposAvaliacao
  avaliacao: Avaliacao | null
  numero: number
  proximaPosicao: number
}) {
  const { usuario } = useSessao()
  const criar = useCriar("collection_items", { aviso: "Avaliação registrada" })
  const atualizar = useAtualizar("collection_items")
  const excluir = useExcluir("collection_items")
  const atualizarColecao = useAtualizar("collections")
  const entradaFoto = React.useRef<HTMLInputElement>(null)
  const [data, setData] = React.useState("")
  const [peso, setPeso] = React.useState("")
  const [gordura, setGordura] = React.useState("")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [previa, setPrevia] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)

  React.useEffect(() => {
    if (!aberta) return
    setData(avaliacao?.data ?? isoDia())
    setPeso(avaliacao?.peso != null ? String(avaliacao.peso).replace(".", ",") : "")
    setGordura(avaliacao?.gordura != null ? String(avaliacao.gordura).replace(".", ",") : "")
    setArquivo(null)
  }, [aberta, avaliacao])

  React.useEffect(() => {
    if (!arquivo) return setPrevia(null)
    const url = URL.createObjectURL(arquivo)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const valorPeso = lerNumeroDigitado(peso)
  const valorGordura = lerNumeroDigitado(gordura)
  const invalido = (peso.trim() !== "" && valorPeso === null) || (gordura.trim() !== "" && valorGordura === null)
  const vazio = valorPeso === null && valorGordura === null && !arquivo && !avaliacao?.foto

  /** As colunas usadas passam a existir na coleção, para aparecerem também na tabela. */
  const garantirColunas = (usadas: [string, string][]) => {
    const atual = esquema(colecao)
    const novas: Propriedade[] = usadas.filter(([nome]) => !atual.some((p) => normalizar(p.name) === normalizar(nome))).map(([name, type]) => ({ name, type }))
    if (novas.length) atualizarColecao.mutate({ id: colecao.id, schema: [...atual, ...novas] as unknown as Json })
  }

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (invalido || vazio || enviando) return
    const id = avaliacao?.item.id ?? novoId()
    let caminho: string | null = null
    if (arquivo) {
      if (!usuario) return toast.error("Sua sessão expirou. Entre de novo para enviar a foto.")
      if (!arquivo.type.startsWith("image/")) return toast.error("Escolha uma imagem (JPG, PNG ou WebP).")
      if (arquivo.size > TAMANHO_MAXIMO_FOTO) return toast.error("A foto é grande demais. Use uma de até 15 MB.")
      setEnviando(true)
      try {
        const { otimizarImagem } = await import("@/lib/otimizar-imagem")
        const otimizado = await otimizarImagem(arquivo, { dimensaoMaxima: 1600 })
        const ext = (otimizado.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
        caminho = `${usuario.id}/colecoes/${colecao.id}/${id}-${Date.now()}.${ext}`
        const { error } = await supabase().storage.from(BUCKET_ARQUIVOS).upload(caminho, otimizado, { contentType: otimizado.type })
        if (error) throw new Error(error.message)
        // O registro do arquivo é só um índice: se falhar, a foto continua valendo
        await supabase().from("files").insert({ path: caminho, name: otimizado.name, mime: otimizado.type, size: otimizado.size, entity_type: "colecao_item", entity_id: id })
      } catch (e) {
        setEnviando(false)
        return toast.error("Não foi possível enviar a foto.", { description: e instanceof Error ? e.message : undefined })
      }
      setEnviando(false)
    }

    const props: Record<string, Json> = avaliacao ? { ...valores(avaliacao.item) } : {}
    const definir = (chave: string, valor: Json) => {
      if (valor === null || valor === "") delete props[chave]
      else props[chave] = valor
    }
    definir(campos.data, data || null)
    definir(campos.peso, valorPeso)
    definir(campos.gordura, valorGordura)
    if (caminho) props[campos.foto] = `${PREFIXO_ARQUIVO}${encodeURIComponent(caminho)}`

    if (avaliacao) atualizar.mutate({ id, props, ...(caminho ? { cover_path: caminho } : {}) })
    else criar.mutate({ id, collection_id: colecao.id, title: `Avaliação Nº ${numero}`, props, cover_path: caminho, position: proximaPosicao })
    garantirColunas([
      [campos.data, "date"],
      ...(valorPeso !== null ? ([[campos.peso, "number"]] as [string, string][]) : []),
      ...(valorGordura !== null ? ([[campos.gordura, "number"]] as [string, string][]) : []),
      ...(caminho ? ([[campos.foto, "text"]] as [string, string][]) : []),
    ])
    aoFechar()
  }

  const fotoAtual = avaliacao?.foto ?? null

  return (
    <>
      <Janela
        aberta={aberta}
        aoMudar={(v) => !v && !enviando && aoFechar()}
        titulo={avaliacao ? avaliacao.item.title || "Avaliação" : "Nova avaliação"}
        rodape={
          <>
            {avaliacao ? (
              <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => setApagar(true)}>
                Excluir
              </Botao>
            ) : null}
            <Botao variante="fantasma" onClick={aoFechar} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit" form="form-avaliacao" disabled={invalido || vazio || enviando}>
              {enviando ? "Enviando foto…" : avaliacao ? "Salvar" : "Registrar"}
            </Botao>
          </>
        }
      >
        <form id="form-avaliacao" onSubmit={salvar} className="grid gap-5">
          <Campo rotulo="Data" htmlFor="av-data">
            <Entrada id="av-data" type="date" max={isoDia()} value={data} onChange={(e) => setData(e.target.value)} className="max-w-48" />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Peso (kg)" htmlFor="av-peso">
              <Entrada id="av-peso" inputMode="decimal" autoComplete="off" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ex.: 72,5" aria-invalid={peso.trim() !== "" && valorPeso === null} />
            </Campo>
            <Campo rotulo="Gordura (%)" htmlFor="av-gordura" dica="Opcional">
              <Entrada id="av-gordura" inputMode="decimal" autoComplete="off" value={gordura} onChange={(e) => setGordura(e.target.value)} placeholder="Ex.: 15" aria-invalid={gordura.trim() !== "" && valorGordura === null} />
            </Campo>
          </div>
          <Campo rotulo="Foto" htmlFor="av-foto" dica="Opcional. Fica guardada só na sua conta.">
            <div className="flex items-center gap-3">
              {previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previa} alt="Foto escolhida" className="aspect-[3/4] w-16 rounded-md object-cover" />
              ) : fotoAtual ? (
                <Foto caminho={fotoAtual} alt="Foto atual" className="w-16 rounded-md" />
              ) : null}
              <input
                ref={entradaFoto}
                id="av-foto"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null)
                  e.target.value = ""
                }}
              />
              <Botao variante="contorno" onClick={() => entradaFoto.current?.click()}>
                <Camera /> {previa || fotoAtual ? "Trocar foto" : "Escolher foto"}
              </Botao>
            </div>
          </Campo>
          {invalido ? <p className="text-sm text-danger">Use só números, como 72,5.</p> : null}
        </form>
      </Janela>
      <Confirmar
        aberta={apagar}
        aoMudar={setApagar}
        titulo={`Excluir “${avaliacao?.item.title ?? "avaliação"}”?`}
        aoConfirmar={() => {
          if (avaliacao) {
            excluir.mutate(avaliacao.item.id)
            // Foto enviada pelo app sai junto; as que vieram do Notion ficam com a importação
            const foto = avaliacao.foto
            if (foto && foto.includes("/colecoes/")) {
              void supabase().storage.from(BUCKET_ARQUIVOS).remove([foto])
              void supabase().from("files").delete().eq("path", foto)
            }
          }
          aoFechar()
        }}
      />
    </>
  )
}
