"use client"

import * as React from "react"
import { CalendarDays, MapPin, Plus } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Marcador, Vazio } from "@/components/ui/basicos"
import { BotaoExcluir } from "@/components/ui/botao-excluir"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import type { Json } from "@/lib/supabase/database.types"
import { cn, formatar, isoDia, plural } from "@/lib/utils"
import { TIPOS_PARADA, agruparRoteiro, diasDaViagem, ehLink, lerHora, linkDoMapa, tipoDaParada, useGravarViagens, type Parada, type TipoParada, type Viagem } from "./dados"
import { EscolhaPilulas, EscolherViagem, ICONE_TIPO_PARADA, IconeParada } from "./ui"

/**
 * O roteiro dia a dia: cada dia da viagem (mesmo vazio, para planejar), com o que fazer em
 * ordem de horário. Durante a viagem, abre no dia de hoje e marca o que já foi feito.
 */
export function RoteiroViagem({
  viagem,
  viagens,
  paradas,
  campoFeito,
  aoDefinirDatas,
}: {
  viagem: Viagem
  /** Todas as viagens, para mover um item de uma para outra. */
  viagens: Viagem[]
  paradas: Parada[]
  campoFeito: string
  aoDefinirDatas: () => void
}) {
  const gravar = useGravarViagens()
  const dias = React.useMemo(() => agruparRoteiro(paradas, viagem), [paradas, viagem])
  const hoje = isoDia()
  const [form, setForm] = React.useState<{ aberto: boolean; parada: Parada | null; dia: string | null }>({ aberto: false, parada: null, dia: null })
  const abrir = (parada: Parada | null, dia: string | null = null) => setForm({ aberto: true, parada, dia: parada?.data ?? dia })

  // Durante a viagem, abre no dia de hoje
  const refHoje = React.useRef<HTMLLIElement>(null)
  const rolou = React.useRef(false)
  React.useEffect(() => {
    if (rolou.current || viagem.situacao !== "andamento" || !refHoje.current) return
    rolou.current = true
    refHoje.current.scrollIntoView({ block: "start" })
  }, [viagem.situacao, dias])

  const alternar = (p: Parada) => void gravar.mudarProps(p.item, (props) => void (props[campoFeito] = props[campoFeito] !== true), "roteiro")
  const feitos = paradas.filter((p) => p.feito).length
  const diaSugerido = viagem.situacao === "andamento" ? hoje : (viagem.ida ?? null)

  return (
    <div className="grid gap-6">
      {!viagem.ida ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden /> Com as datas, o roteiro fica separado por dia.
          </p>
          <Botao variante="contorno" tamanho="sm" onClick={aoDefinirDatas}>
            Definir datas
          </Botao>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {paradas.length
            ? `${plural(paradas.length, "item", "itens")}${viagem.dias ? ` em ${plural(viagem.dias, "dia")}` : ""}${feitos ? ` · ${feitos} ${feitos === 1 ? "feito" : "feitos"}` : ""}`
            : "Nada no roteiro ainda."}
        </p>
        <Botao variante="primario" tamanho="sm" onClick={() => abrir(null, diaSugerido)}>
          <Plus /> Adicionar
        </Botao>
      </div>

      {!dias.length ? (
        <Vazio
          icone={<MapPin />}
          titulo="Anote o que fazer nesta viagem."
          descricao="Voos, hospedagem, passeios e restaurantes, com horário e endereço para abrir no mapa."
          acao={
            <Botao onClick={() => abrir(null)}>
              <Plus /> Adicionar ao roteiro
            </Botao>
          }
        />
      ) : (
        <ol className="grid gap-5">
          {dias.map((d) => {
            const ehHoje = d.data === hoje
            // Sem datas na viagem, o dia é o próprio título; com datas, uma data fora delas fica marcada
            const dataPorExtenso = d.data ? formatar(d.data, d.numero ? "EEEE, d 'de' MMM" : "EEEE, d 'de' MMM yyyy") : ""
            const nome = d.numero ? `Dia ${d.numero}` : !d.data ? "Sem dia definido" : viagem.ida ? "Fora das datas" : dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1)
            const subtitulo = d.numero || (d.data && viagem.ida) ? dataPorExtenso : ""
            return (
              <li key={d.chave} ref={ehHoje ? refHoje : undefined} className="scroll-mt-24">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="flex flex-wrap items-baseline gap-x-2 font-display text-base font-semibold">
                    {nome}
                    {subtitulo ? <span className="text-sm font-normal text-ink-3">{subtitulo}</span> : null}
                    {ehHoje ? <span className="self-center rounded-full bg-pen px-1.5 py-0.5 text-[11px] font-medium text-pen-ink">hoje</span> : null}
                  </h3>
                  <button
                    type="button"
                    onClick={() => abrir(null, d.data)}
                    aria-label={d.numero ? `Adicionar ao dia ${d.numero}` : d.data ? `Adicionar em ${dataPorExtenso}` : "Adicionar sem dia definido"}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink toque:min-h-10"
                  >
                    <Plus className="size-4" aria-hidden /> Adicionar
                  </button>
                </div>
                {d.paradas.length ? (
                  <ul className={cn("divide-y divide-line rounded-xl border bg-surface", ehHoje ? "border-pen/50" : "border-line")}>
                    {d.paradas.map((p) => (
                      <LinhaParada key={p.id} parada={p} aoAbrir={() => abrir(p)} aoAlternar={() => alternar(p)} />
                    ))}
                  </ul>
                ) : (
                  <p className="border-b border-dashed border-line pb-3 text-sm text-ink-3">Nada planejado.</p>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <FormParada
        aberto={form.aberto}
        aoMudar={(v) => setForm((f) => ({ ...f, aberto: v }))}
        viagem={viagem}
        viagens={viagens}
        parada={form.parada}
        diaInicial={form.dia}
      />
    </div>
  )
}

function LinhaParada({ parada: p, aoAbrir, aoAlternar }: { parada: Parada; aoAbrir: () => void; aoAlternar: () => void }) {
  const mapa = linkDoMapa(p.endereco)
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
      <IconeParada parada={p} className={cn("mt-1 size-4 shrink-0", p.feito ? "text-ink-3" : "text-pen")} />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={aoAbrir} className="block w-full text-left">
          <span className={cn("block leading-snug", p.feito && "text-ink-3 line-through")}>
            {p.hora ? <span className="mr-1.5 font-semibold tabular text-ink-2">{p.hora}</span> : null}
            <span className="font-medium">{p.titulo}</span>
          </span>
          {p.obs ? <span className="mt-0.5 line-clamp-2 block text-xs text-ink-3">{p.obs}</span> : null}
        </button>
        {mapa ? (
          <a href={mapa} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-ink-2 hover:text-pen hover:underline">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{ehLink(p.endereco) ? "Abrir no mapa" : p.endereco}</span>
          </a>
        ) : null}
      </div>
      <div className="pt-0.5">
        <Marcador marcado={p.feito} aoMudar={aoAlternar} rotulo={p.feito ? `Desmarcar ${p.titulo}` : `Marcar ${p.titulo} como feito`} />
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Janela do item                                                      */
/* ------------------------------------------------------------------ */

function FormParada({
  aberto,
  aoMudar,
  viagem,
  viagens,
  parada,
  diaInicial,
}: {
  aberto: boolean
  aoMudar: (v: boolean) => void
  viagem: Viagem
  viagens: Viagem[]
  parada: Parada | null
  diaInicial: string | null
}) {
  const gravar = useGravarViagens()
  const [titulo, setTitulo] = React.useState("")
  const [tipo, setTipo] = React.useState<TipoParada>("passeio")
  const [tipoEscolhido, setTipoEscolhido] = React.useState(false)
  const [dia, setDia] = React.useState("")
  const [hora, setHora] = React.useState("")
  const [endereco, setEndereco] = React.useState("")
  const [obs, setObs] = React.useState("")
  const [destino, setDestino] = React.useState(viagem.id)
  const [erro, setErro] = React.useState("")

  React.useEffect(() => {
    if (!aberto) return
    setDestino(viagem.id)
    setTitulo(parada?.titulo ?? "")
    setTipo(parada?.tipo ?? "passeio")
    setTipoEscolhido(Boolean(parada))
    setDia(parada?.data ?? diaInicial ?? "")
    setHora(parada?.hora ?? "")
    setEndereco(parada?.endereco ?? "")
    setObs(parada?.obs ?? "")
    setErro("")
  }, [aberto, parada, diaInicial, viagem.id])

  const diasViagem = diasDaViagem(viagem)
  const foraDasDatas = dia && !diasViagem.includes(dia)

  // Enquanto a pessoa não escolhe o tipo, ele acompanha o que está sendo escrito ("Voo…" vira transporte)
  const mudarTitulo = (t: string) => {
    setTitulo(t)
    if (!tipoEscolhido) {
      const sugerido = tipoDaParada(t)
      setTipo(sugerido === "outro" ? "passeio" : sugerido)
    }
  }

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = titulo.trim()
    if (!t) return setErro("Diga o que é: um voo, um passeio, um restaurante…")
    const horaLida = hora ? lerHora(hora) : null
    // A categoria antiga (ex.: "Local") fica, se o tipo não foi trocado
    const categoria = parada && !tipoEscolhido && parada.categoria ? parada.categoria : TIPOS_PARADA.find((x) => x.id === tipo)!.rotulo
    const aplicar = (props: Record<string, Json>) => {
      if (destino) props._viagem = destino
      else delete props._viagem
      props.Categoria = categoria
      if (dia) props.Data = dia
      else delete props.Data
      if (horaLida) props.Hora = horaLida
      else delete props.Hora
      if (endereco.trim()) props["Endereço"] = endereco.trim()
      else delete props["Endereço"]
      if (obs.trim()) props["Observação"] = obs.trim()
      else delete props["Observação"]
      return props
    }
    if (parada) void gravar.mudar(parada.item, (atual) => ({ title: t, props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }) }), "roteiro")
    else void gravar.criar("roteiro", { title: t, props: aplicar({}) }).catch(() => {})
    if (destino !== viagem.id) toast.success(destino ? `Movido para ${viagens.find((v) => v.id === destino)?.nome ?? "outra viagem"}` : "Tirado da viagem", { description: destino ? undefined : "Ele fica em Sem viagem, na página de Viagens." })
    aoMudar(false)
  }

  const idForm = "form-parada"
  return (
    <Janela
      aberta={aberto}
      aoMudar={aoMudar}
      titulo={parada ? "Editar item do roteiro" : "Adicionar ao roteiro"}
      rodape={
        <>
          {parada ? (
            <BotaoExcluir
              aoExcluir={() => {
                void gravar.excluir([parada.item])
                aoMudar(false)
              }}
            />
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm}>
            {parada ? "Salvar" : "Adicionar"}
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <Campo rotulo="O quê" htmlFor="parada-titulo">
          <Entrada
            id="parada-titulo"
            autoFocus={!parada}
            value={titulo}
            onChange={(e) => mudarTitulo(e.target.value)}
            placeholder="Ex.: Voo para Salvador, Pelourinho, Pousada do Sol"
            autoComplete="off"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? "parada-erro" : undefined}
          />
        </Campo>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Tipo</span>
          <EscolhaPilulas
            rotulo="Tipo do item"
            opcoes={TIPOS_PARADA}
            valor={tipo}
            icones={ICONE_TIPO_PARADA}
            aoMudar={(v) => {
              setTipo(v)
              setTipoEscolhido(true)
            }}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <Campo rotulo="Dia" htmlFor="parada-dia">
            {diasViagem.length ? (
              <Seletor id="parada-dia" value={dia} onChange={(e) => setDia(e.target.value)}>
                {diasViagem.map((d, i) => (
                  <option key={d} value={d}>
                    Dia {i + 1} · {formatar(d, "EEEEEE, d 'de' MMM")}
                  </option>
                ))}
                {foraDasDatas ? <option value={dia}>{formatar(dia, "d 'de' MMM yyyy")} (fora das datas)</option> : null}
                <option value="">Sem dia definido</option>
              </Seletor>
            ) : (
              <Entrada id="parada-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
            )}
          </Campo>
          <Campo rotulo="Hora" htmlFor="parada-hora">
            <Entrada id="parada-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Endereço ou link do mapa" htmlFor="parada-endereco" dica="Abre no Google Maps, para chegar lá.">
          <Entrada id="parada-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Ex.: Largo do Pelourinho, Salvador" autoComplete="off" />
        </Campo>
        <Campo rotulo="Observação" htmlFor="parada-obs">
          <AreaTexto id="parada-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Código da reserva, o que pedir, a que horas chegar…" className="min-h-20" />
        </Campo>
        {parada ? <EscolherViagem id="parada-viagem" valor={destino} aoMudar={setDestino} viagens={viagens} /> : null}
        {erro ? (
          <p id="parada-erro" role="alert" className="text-sm text-danger">
            {erro}
          </p>
        ) : null}
      </form>
    </Janela>
  )
}
