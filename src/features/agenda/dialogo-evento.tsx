"use client"

import * as React from "react"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { CATEGORIAS_EVENTO } from "@/lib/rotulos"
import { isoDia } from "@/lib/utils"
import { format } from "date-fns"

type Evento = Tables<"events">

function partes(iso: string | null | undefined) {
  if (!iso) return { dia: isoDia(), hora: "" }
  const d = new Date(iso)
  return { dia: format(d, "yyyy-MM-dd"), hora: format(d, "HH:mm") }
}

/** Monta um timestamp local a partir de dia + hora. */
export function juntarDataHora(dia: string, hora: string | null): string {
  const [a, m, d] = dia.split("-").map(Number)
  const [h, min] = (hora || "00:00").split(":").map(Number)
  return new Date(a, m - 1, d, h, min).toISOString()
}

export function DialogoEvento({
  aberta,
  aoMudar,
  evento,
  diaInicial,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  evento?: Evento | null
  diaInicial?: string
}) {
  const criar = useCriar("events")
  const atualizar = useAtualizar("events")
  const excluir = useExcluir("events")

  const [titulo, setTitulo] = React.useState("")
  const [dia, setDia] = React.useState(isoDia())
  const [hora, setHora] = React.useState("")
  const [diaFim, setDiaFim] = React.useState("")
  const [horaFim, setHoraFim] = React.useState("")
  const [categoria, setCategoria] = React.useState("Compromisso")
  const [local, setLocal] = React.useState("")
  const [descricao, setDescricao] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    const ini = partes(evento?.starts_at)
    const fim = evento?.ends_at ? partes(evento.ends_at) : null
    setTitulo(evento?.title ?? "")
    setDia(evento ? ini.dia : (diaInicial ?? isoDia()))
    setHora(evento && !evento.all_day ? ini.hora : "")
    setDiaFim(fim && fim.dia !== ini.dia ? fim.dia : "")
    setHoraFim(fim && !evento?.all_day ? fim.hora : "")
    setCategoria(evento?.category ?? "Compromisso")
    setLocal(evento?.location ?? "")
    setDescricao(evento?.description ?? "")
  }, [aberta, evento, diaInicial])

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !dia) return
    const diaInteiro = !hora
    const fimDia = diaFim || dia
    const campos = {
      title: titulo.trim(),
      starts_at: juntarDataHora(dia, hora || null),
      ends_at: diaFim || horaFim ? juntarDataHora(fimDia, horaFim || (diaInteiro ? null : hora)) : null,
      all_day: diaInteiro,
      category: categoria || null,
      location: local.trim() || null,
      description: descricao.trim() || null,
    }
    if (evento) atualizar.mutate({ id: evento.id, ...campos })
    else criar.mutate({ id: novoId(), ...campos })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={evento ? "Editar compromisso" : "Novo compromisso"}
      rodape={
        <>
          {evento ? (
            <Botao
              variante="fantasma"
              className="mr-auto text-danger hover:text-danger"
              onClick={() => {
                excluir.mutate(evento.id)
                aoMudar(false)
              }}
            >
              Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-evento" disabled={!titulo.trim()}>
            {evento ? "Salvar" : "Agendar"}
          </Botao>
        </>
      }
    >
      <form id="form-evento" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Compromisso" htmlFor="e-titulo">
          <Entrada id="e-titulo" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reunião com cliente" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia" htmlFor="e-dia">
            <Entrada id="e-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} required />
          </Campo>
          <Campo rotulo="Horário" htmlFor="e-hora" dica="Vazio = dia inteiro">
            <Entrada id="e-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Termina em" htmlFor="e-dia-fim" dica="Opcional">
            <Entrada id="e-dia-fim" type="date" value={diaFim} onChange={(e) => setDiaFim(e.target.value)} />
          </Campo>
          <Campo rotulo="Até" htmlFor="e-hora-fim">
            <Entrada id="e-hora-fim" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Categoria" htmlFor="e-cat">
            <Seletor id="e-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_EVENTO.map((c) => (
                <option key={c}>{c}</option>
              ))}
              {categoria && !(CATEGORIAS_EVENTO as readonly string[]).includes(categoria) ? <option>{categoria}</option> : null}
            </Seletor>
          </Campo>
          <Campo rotulo="Local" htmlFor="e-local">
            <Entrada id="e-local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Opcional" />
          </Campo>
        </div>
        <Campo rotulo="Observação" htmlFor="e-desc">
          <AreaTexto id="e-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </Campo>
      </form>
    </Janela>
  )
}
