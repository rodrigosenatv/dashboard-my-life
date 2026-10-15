"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import type { Json } from "@/lib/supabase/database.types"
import { isoDia, lerData, somarDias } from "@/lib/utils"
import { diasDaSemana, diaCurto, ordenarSessoes, resumirHobby, textoMinutos, textoProgresso, useGravarHobbies, type Hobby, type Sessao } from "./dados"

const DURACOES = [15, 30, 45, 60, 90]
type Quando = "hoje" | "ontem" | "outro"
type Erro = { campo: "hobby" | "data" | "minutos"; texto: string }

/** Registrar uma prática, ou editar uma que já está registrada. */
export function FormPratica({
  aberta,
  aoMudar,
  hobbies,
  sessoes,
  hobbyInicial,
  sessao,
  aoExcluir,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  hobbies: Hobby[]
  sessoes: Sessao[]
  /** O hobby já escolhido ao abrir uma prática nova. */
  hobbyInicial?: string | null
  /** Editando esta prática (sem ela, registra uma nova). */
  sessao?: Sessao | null
  /** Mostra "Excluir" no rodapé (quem chama cuida do desfazer). */
  aoExcluir?: () => void
}) {
  const gravar = useGravarHobbies()
  const [hobbyId, setHobbyId] = React.useState("")
  const [quando, setQuando] = React.useState<Quando>("hoje")
  const [outroDia, setOutroDia] = React.useState("")
  const [minutos, setMinutos] = React.useState("")
  const [anotacoes, setAnotacoes] = React.useState("")
  const [proximo, setProximo] = React.useState("")
  const [erro, setErro] = React.useState<Erro | null>(null)
  const [salvando, setSalvando] = React.useState(false)

  const hoje = isoDia()
  const ontem = somarDias(hoje, -1)

  // Ao abrir, começa do que está gravado (ou em branco, para uma prática nova).
  // Só ao abrir (ou ao trocar de prática): uma recarga dos dados com o formulário aberto não pode apagar o que a pessoa escreveu.
  React.useEffect(() => {
    if (!aberta) return
    const agora = isoDia()
    setHobbyId(sessao?.hobby ?? hobbyInicial ?? hobbies[0]?.id ?? "")
    const data = sessao?.data ?? agora
    setQuando(data === agora ? "hoje" : data === somarDias(agora, -1) ? "ontem" : "outro")
    setOutroDia(data)
    setMinutos(sessao?.minutos ? String(sessao.minutos) : "")
    setAnotacoes(sessao?.anotacoes ?? "")
    setProximo(sessao?.proximo ?? "")
    setErro(null)
    setSalvando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, sessao?.id])

  const hobby = hobbies.find((h) => h.id === hobbyId)
  const doHobby = React.useMemo(() => sessoes.filter((s) => s.hobby === hobbyId && s.id !== sessao?.id), [sessoes, hobbyId, sessao?.id])
  // O recado que a pessoa deixou na última prática, para não esquecer o que ficou combinado
  const recado = ordenarSessoes(doHobby)[0]
  const data = quando === "hoje" ? hoje : quando === "ontem" ? ontem : outroDia

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    if (!hobby) return setErro({ campo: "hobby", texto: "Escolha o hobby." })
    if (!data || !lerData(data)) return setErro({ campo: "data", texto: "Escolha o dia." })
    if (data > hoje) return setErro({ campo: "data", texto: "Esse dia ainda não chegou." })
    const duracao = minutos.trim() ? Number(minutos.trim().replace(",", ".")) : null
    if (duracao !== null && (!Number.isFinite(duracao) || duracao < 1 || duracao > 1440)) return setErro({ campo: "minutos", texto: "Use de 1 a 1.440 minutos." })
    setErro(null)

    const minutosInteiros = duracao === null ? null : Math.round(duracao)
    const aplicar = (props: Record<string, Json>) => {
      props._hobby = hobby.id
      props.Data = data
      if (minutosInteiros) props.Minutos = minutosInteiros
      else delete props.Minutos
      if (anotacoes.trim()) props["Anotações"] = anotacoes.trim()
      else delete props["Anotações"]
      if (proximo.trim()) props["Próximo passo"] = proximo.trim()
      else delete props["Próximo passo"]
      return props
    }

    setSalvando(true)
    try {
      if (sessao) {
        await gravar.mudar(sessao.item, (atual) => ({ title: hobby.nome, props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }) }), "pratica")
        toast.success("Prática atualizada")
      } else {
        await gravar.criar("pratica", { title: hobby.nome, props: aplicar({}) })
        const semana = diasDaSemana(hoje)
        const dias = new Set(resumirHobby(doHobby, hoje).diasNaSemana)
        const naSemana = data >= semana[0] && data <= semana[6]
        if (naSemana) dias.add(data)
        toast.success(`Prática de ${hobby.nome} registrada`, {
          description: [textoMinutos(minutosInteiros), naSemana ? textoProgresso(hobby.meta, dias.size) : diaCurto(data, hoje)].filter(Boolean).join(" · "),
        })
      }
    } catch {
      // Quem grava já avisou o que deu errado
      setSalvando(false)
      return
    }
    setSalvando(false)
    aoMudar(false)
  }

  const idForm = "form-pratica"
  const duracaoEscolhida = DURACOES.map(String).includes(minutos.trim()) ? minutos.trim() : ""

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo={sessao ? "Editar prática" : "Registrar prática"}
      descricao={sessao ? undefined : "Cada dia com prática conta para a meta da semana."}
      rodape={
        <>
          {sessao && aoExcluir ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={aoExcluir} disabled={salvando}>
              <Trash2 /> Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={salvando}>
            {sessao ? "Salvar" : "Registrar"}
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        {hobbies.length > 1 || !hobby ? (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink-2">Hobby</span>
            <EscolhaPilulas rotulo="Hobby" valor={hobbyId} aoMudar={setHobbyId} opcoes={hobbies.map((h) => ({ id: h.id, rotulo: h.nome }))} />
            {erro?.campo === "hobby" ? (
              <p role="alert" className="text-sm text-danger">
                {erro.texto}
              </p>
            ) : null}
          </div>
        ) : null}

        {recado?.proximo ? (
          <div className="rounded-lg bg-pen-soft px-3.5 py-2.5 text-sm">
            <p className="text-xs font-medium text-pen">Você deixou anotado ({diaCurto(recado.data, hoje)})</p>
            <p className="mt-0.5 text-ink">{recado.proximo}</p>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Quanto tempo?</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <EscolhaPilulas rotulo="Duração" valor={duracaoEscolhida} aoMudar={setMinutos} opcoes={DURACOES.map((m) => ({ id: String(m), rotulo: textoMinutos(m) }))} />
            <div className="relative w-28">
              <Entrada
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                step={1}
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
                placeholder="Outro"
                aria-label="Minutos"
                aria-invalid={erro?.campo === "minutos" || undefined}
                aria-describedby={erro?.campo === "minutos" ? "pratica-erro" : undefined}
                className="pr-10"
              />
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">
                min
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Quando?</span>
          <EscolhaPilulas
            rotulo="Dia da prática"
            valor={quando}
            aoMudar={(q) => {
              setQuando(q)
              if (q === "outro" && (!outroDia || outroDia >= ontem)) setOutroDia(somarDias(hoje, -2))
            }}
            opcoes={[
              { id: "hoje", rotulo: "Hoje" },
              { id: "ontem", rotulo: "Ontem" },
              { id: "outro", rotulo: "Outro dia" },
            ]}
          />
          {quando === "outro" ? (
            <Entrada
              type="date"
              max={hoje}
              value={outroDia}
              onChange={(e) => setOutroDia(e.target.value)}
              aria-label="Dia da prática"
              aria-invalid={erro?.campo === "data" || undefined}
              aria-describedby={erro?.campo === "data" ? "pratica-erro" : undefined}
              className="max-w-44"
            />
          ) : null}
        </div>

        <Campo rotulo="O que você treinou?" htmlFor="pratica-anotacoes" dica="Opcional.">
          <AreaTexto id="pratica-anotacoes" rows={3} value={anotacoes} onChange={(e) => setAnotacoes(e.target.value)} placeholder="Ex.: 3 rounds de jab e direto, 10 min de sombra" className="min-h-20" />
        </Campo>

        <Campo rotulo="Para a próxima vez" htmlFor="pratica-proximo" dica="Aparece de novo quando você for registrar a próxima prática.">
          <Entrada id="pratica-proximo" value={proximo} onChange={(e) => setProximo(e.target.value)} placeholder="Ex.: manter a guarda mais alta" autoComplete="off" enterKeyHint="done" />
        </Campo>

        {erro && erro.campo !== "hobby" ? (
          <p id="pratica-erro" role="alert" className="text-sm text-danger">
            {erro.texto}
          </p>
        ) : null}
      </form>
    </Janela>
  )
}
