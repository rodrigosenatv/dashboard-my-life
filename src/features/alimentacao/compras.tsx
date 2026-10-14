"use client"

import * as React from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Segmentos } from "@/components/ui/basicos"
import { Janela } from "@/components/ui/janela"
import { copiarTexto } from "@/lib/copiar"
import { cn, normalizar } from "@/lib/utils"
import type { ConfigAlimentacao, ConfigCompras, Refeicao } from "./dados"
import { SECOES_COMPRA, listaDeCompras, quantidadeDeCompra, textoContagem, type Calculo, type ItemAvulso, type LinhaCompra } from "./nutricao"

const PADRAO: ConfigCompras = { dias: 4, fora: [], marcados: [] }
const DIAS = [3, 4, 5, 7]

const MOTIVO_AVULSO: Record<ItemAvulso["motivo"], string> = {
  salada: "à vontade",
  opcional: "opcional",
  tempero: "a gosto",
  "sem-calculo": "sem quantidade",
  valores: "do rótulo",
}

function quantidade(l: LinhaCompra): string {
  if (l.contagem?.medida === "unidade") return textoContagem(l.contagem)
  const peso = `${quantidadeDeCompra(l.qtd, l.un)}${l.cru ? " (cru)" : ""}`
  return l.contagem ? `${textoContagem(l.contagem)} · ${peso}` : peso
}

const chaveAvulso = (a: ItemAvulso) => `avulso:${normalizar(a.texto)}`

const semAssinatura = () => () => {}
/** No celular, a lista vai pela janela de compartilhar do sistema (WhatsApp, notas...). */
const podeCompartilhar = () => typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches

/**
 * A lista do mercado, montada do plano: escolhe para quantos dias (a marmita é de 3 ou 4) e
 * quais refeições entram. O que já está no carrinho fica marcado, em qualquer aparelho.
 */
export function ListaCompras({
  aberta,
  aoMudar,
  refeicoes,
  calculos,
  config,
  aoSalvarConfig,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  refeicoes: Refeicao[]
  calculos: Map<string, Calculo>
  config: ConfigAlimentacao
  aoSalvarConfig: (c: Partial<ConfigAlimentacao>) => void
}) {
  const [estado, setEstado] = React.useState<ConfigCompras>(config.compras ?? PADRAO)
  const pendente = React.useRef<{ timer: ReturnType<typeof setTimeout>; valor: ConfigCompras } | null>(null)
  const salvarConfig = React.useRef(aoSalvarConfig)
  React.useEffect(() => {
    salvarConfig.current = aoSalvarConfig
  })

  // Ao abrir, começa do que está salvo (pode ter sido marcado em outro aparelho)
  const estavaAberta = React.useRef(false)
  const salvo = config.compras
  React.useEffect(() => {
    if (aberta && !estavaAberta.current && !pendente.current) setEstado(salvo ?? PADRAO)
    estavaAberta.current = aberta
  }, [aberta, salvo])

  const gravarAgora = React.useCallback(() => {
    if (!pendente.current) return
    clearTimeout(pendente.current.timer)
    salvarConfig.current({ compras: pendente.current.valor })
    pendente.current = null
  }, [])
  React.useEffect(() => gravarAgora, [gravarAgora])

  const mudar = (novo: ConfigCompras) => {
    setEstado(novo)
    if (pendente.current) clearTimeout(pendente.current.timer)
    pendente.current = { valor: novo, timer: setTimeout(gravarAgora, 800) }
  }

  const incluidas = refeicoes.filter((r) => !estado.fora.includes(r.item.id))
  const { dias, fora } = estado
  const { linhas, avulsos } = React.useMemo(
    () => listaDeCompras(refeicoes.filter((r) => !fora.includes(r.item.id)).map((r) => ({ itens: calculos.get(r.item.id)?.itens ?? [], vezes: dias }))),
    [refeicoes, calculos, dias, fora],
  )
  const marcados = new Set(estado.marcados)
  const alternar = (chave: string) => mudar({ ...estado, marcados: marcados.has(chave) ? estado.marcados.filter((m) => m !== chave) : [...estado.marcados, chave] })
  const chaves = [...linhas.map((l) => l.chave), ...avulsos.map(chaveAvulso)]
  const feitos = chaves.filter((c) => marcados.has(c)).length

  const compartilha = React.useSyncExternalStore(semAssinatura, podeCompartilhar, () => false)

  /** O que ainda falta comprar (ou tudo, se já está tudo no carrinho), em texto. */
  const textoDaLista = () => {
    const faltam = (c: string) => !marcados.has(c) || feitos === chaves.length
    const partes = [`Lista de compras (${estado.dias} dias)`]
    for (const s of SECOES_COMPRA) {
      const ls = linhas.filter((l) => l.secao === s.id && faltam(l.chave))
      if (ls.length) partes.push(`${s.nome}\n${ls.map((l) => `- ${l.nome}: ${quantidade(l)}`).join("\n")}`)
    }
    const av = avulsos.filter((a) => faltam(chaveAvulso(a)))
    if (av.length) partes.push(`Também no plano\n${av.map((a) => `- ${a.texto} (${MOTIVO_AVULSO[a.motivo]})`).join("\n")}`)
    return partes.join("\n\n")
  }

  const enviar = async () => {
    const texto = textoDaLista()
    if (compartilha) {
      try {
        await navigator.share({ title: "Lista de compras", text: texto })
        return
      } catch (e) {
        // Fechou a janela de compartilhar: nada a fazer. Outro erro: copia
        if (e instanceof DOMException && e.name === "AbortError") return
      }
    }
    if (await copiarTexto(texto)) toast.success("Lista copiada", { description: "Cole numa conversa ou nas notas do celular." })
    else toast.error("Não foi possível copiar a lista.")
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => {
        if (!v) gravarAgora()
        aoMudar(v)
      }}
      titulo="Lista de compras"
      descricao="Do seu plano, somando as refeições de cada dia. Arroz, feijão e carnes, que o plano pesa prontos, aparecem em peso cru (aproximado)."
      rodape={
        <>
          {feitos ? (
            <Botao variante="fantasma" className="mr-auto" onClick={() => mudar({ ...estado, marcados: [] })}>
              Desmarcar tudo
            </Botao>
          ) : null}
          <Botao variante="contorno" onClick={enviar} disabled={!chaves.length}>
            {compartilha ? (
              <>
                <Share2 /> Enviar
              </>
            ) : (
              <>
                <Copy /> Copiar
              </>
            )}
          </Botao>
          <Botao
            variante="primario"
            onClick={() => {
              gravarAgora()
              aoMudar(false)
            }}
          >
            Pronto
          </Botao>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium text-ink-2">Para</span>
            <Segmentos rotulo="Para quantos dias" valor={String(estado.dias)} aoMudar={(v) => mudar({ ...estado, dias: Number(v) })} opcoes={DIAS.map((n) => ({ valor: String(n), rotulo: `${n} dias` }))} />
          </div>
          <div role="group" aria-label="Refeições que entram na lista" className="flex flex-wrap gap-1.5">
            {refeicoes.map((r) => {
              const dentro = !estado.fora.includes(r.item.id)
              return (
                <button
                  key={r.item.id}
                  type="button"
                  aria-pressed={dentro}
                  onClick={() => mudar({ ...estado, fora: dentro ? [...estado.fora, r.item.id] : estado.fora.filter((f) => f !== r.item.id) })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-10",
                    dentro ? "border-pen bg-pen/15 text-ink" : "border-line text-ink-3 line-through hover:text-ink-2",
                  )}
                >
                  {dentro ? <Check className="size-3.5" aria-hidden /> : null}
                  {r.nome}
                </button>
              )
            })}
          </div>
          {chaves.length ? (
            <p className="text-xs text-ink-3" aria-live="polite">
              {feitos ? `${feitos} de ${chaves.length} no carrinho` : `${chaves.length} itens`}
            </p>
          ) : null}
        </div>

        {!incluidas.length ? (
          <p className="text-sm text-ink-2">Escolha ao menos uma refeição.</p>
        ) : (
          <>
            {SECOES_COMPRA.map((s) => {
              const ls = linhas.filter((l) => l.secao === s.id)
              if (!ls.length) return null
              return (
                <section key={s.id}>
                  <h3 className="mb-1 text-xs font-medium text-ink-3">{s.nome}</h3>
                  <ul className="divide-y divide-line border-y border-line">
                    {ls.map((l) => (
                      <LinhaMarcavel key={l.chave} marcado={marcados.has(l.chave)} aoAlternar={() => alternar(l.chave)} nome={l.nome} detalhe={quantidade(l)} />
                    ))}
                  </ul>
                </section>
              )
            })}
            {avulsos.length ? (
              <section>
                <h3 className="mb-1 text-xs font-medium text-ink-3">Também no plano</h3>
                <ul className="divide-y divide-line border-y border-line">
                  {avulsos.map((a) => (
                    <LinhaMarcavel key={chaveAvulso(a)} marcado={marcados.has(chaveAvulso(a))} aoAlternar={() => alternar(chaveAvulso(a))} nome={a.texto} detalhe={MOTIVO_AVULSO[a.motivo]} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Janela>
  )
}

function LinhaMarcavel({ marcado, aoAlternar, nome, detalhe }: { marcado: boolean; aoAlternar: () => void; nome: string; detalhe: string }) {
  return (
    <li>
      <button type="button" role="checkbox" aria-checked={marcado} onClick={aoAlternar} className="flex w-full items-center gap-3 py-2.5 text-left toque:min-h-12">
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors", marcado ? "border-pen bg-pen text-pen-ink" : "border-line-strong")}>
          {marcado ? <Check className="size-3.5 animate-marcar" strokeWidth={3} aria-hidden /> : null}
        </span>
        <span className={cn("min-w-0 flex-1 text-sm leading-snug", marcado && "text-ink-3 line-through")}>{nome}</span>
        <span className={cn("shrink-0 text-right text-sm text-ink-2 tabular", marcado && "text-ink-3")}>{detalhe}</span>
      </button>
    </li>
  )
}
