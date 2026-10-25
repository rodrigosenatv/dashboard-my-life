"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Check, Plus } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import { novoId, useAtualizar, useCriar } from "@/lib/data"
import { cn } from "@/lib/utils"
import { IconePlataforma } from "./capa"
import { linkDoCurso, ORDEM_STATUS, plataformaDoLink, STATUS, statusDo, type Curso, type StatusCurso } from "./logica"

/** Novo curso ou os dados de um curso: nome, situação, áreas, acesso e progresso. */
export function JanelaCurso({
  aberta,
  aoMudar,
  curso,
  categorias,
  statusInicial = "em_andamento",
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  curso?: Curso | null
  /** As áreas que já existem (para escolher com um toque). */
  categorias: string[]
  statusInicial?: StatusCurso
}) {
  const router = useRouter()
  const qc = useQueryClient()
  const criar = useCriar("courses")
  const atualizar = useAtualizar("courses")
  const [nome, setNome] = React.useState("")
  const [status, setStatus] = React.useState<StatusCurso>(statusInicial)
  const [areas, setAreas] = React.useState<string[]>([])
  const [novaArea, setNovaArea] = React.useState("")
  const [link, setLink] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [progresso, setProgresso] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!aberta) return
    setNome(curso?.name ?? "")
    setStatus(curso ? statusDo(curso) : statusInicial)
    setAreas(curso?.categories ?? [])
    setNovaArea("")
    setLink(curso?.url ?? "")
    setEmail(curso?.access_email ?? "")
    setProgresso(typeof curso?.progress === "number" ? curso.progress : null)
  }, [aberta, curso, statusInicial])

  const todas = React.useMemo(() => [...new Set([...categorias, ...areas])], [categorias, areas])
  const plataforma = plataformaDoLink(link)
  const linkInvalido = Boolean(link.trim()) && !linkDoCurso(link)

  const alternarArea = (a: string) => setAreas((lista) => (lista.includes(a) ? lista.filter((x) => x !== a) : [...lista, a]))
  const acrescentarArea = () => {
    const a = novaArea.replace(/\s+/g, " ").trim()
    if (!a) return
    const existente = todas.find((x) => x.toLowerCase() === a.toLowerCase())
    setAreas((lista) => (lista.includes(existente ?? a) ? lista : [...lista, existente ?? a]))
    setNovaArea("")
  }

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const campos = {
      name: nome.replace(/\s+/g, " ").trim(),
      status,
      categories: areas,
      url: link.trim() || null,
      access_email: email.trim() || null,
      progress: status === "concluido" ? 100 : progresso,
    }
    if (curso) {
      atualizar.mutate({ id: curso.id, ...campos })
      aoMudar(false)
      return
    }
    const id = novoId()
    // A tela do curso abre quando ele já está no banco (com os dados prontos, sem piscar "não encontrado")
    criar.mutate(
      { id, ...campos, position: Date.now() },
      {
        onSuccess: (novo) => {
          qc.setQueryData(["courses", "um", id], novo)
          toast.success("Curso na plataforma. Anote a primeira aula quando começar.")
          router.push(`/estudos/cursos/${id}`)
        },
      },
    )
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={curso ? "Dados do curso" : "Novo curso"}
      largura="md"
      className="tema-cursos"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-curso" disabled={!nome.trim()}>
            {curso ? "Salvar" : "Adicionar curso"}
          </Botao>
        </>
      }
    >
      <form id="form-curso" onSubmit={salvar} className="grid gap-5">
        <Campo rotulo="Nome do curso" htmlFor="curso-nome">
          <Entrada id="curso-nome" autoFocus={!curso} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Formação em Oratória" />
        </Campo>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Situação</span>
          <EscolhaPilulas rotulo="Situação do curso" opcoes={ORDEM_STATUS.map((s) => ({ id: s, rotulo: STATUS[s].rotulo }))} valor={status} aoMudar={setStatus} />
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Áreas</span>
          {todas.length ? (
            <div role="group" aria-label="Áreas do curso" className="flex flex-wrap gap-1.5">
              {todas.map((a) => {
                const ativa = areas.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => alternarArea(a)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors toque:min-h-11",
                      ativa ? "border-pen bg-pen/15 text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {ativa ? <Check className="size-3.5" aria-hidden /> : null}
                    {a}
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Entrada
              value={novaArea}
              onChange={(e) => setNovaArea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  acrescentarArea()
                }
              }}
              placeholder="Nova área (ex.: Idiomas)"
              aria-label="Nova área"
            />
            <Botao type="button" variante="contorno" tamanho="icone" aria-label="Acrescentar área" onClick={acrescentarArea} disabled={!novaArea.trim()} className="bg-transparent">
              <Plus />
            </Botao>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Link de acesso"
            htmlFor="curso-link"
            dica={
              linkInvalido ? (
                <span className="text-danger">Não parece um link. Cole o endereço completo.</span>
              ) : plataforma ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconePlataforma id={plataforma.id} className="size-3.5" /> {plataforma.nome}
                </span>
              ) : (
                "Telegram, área de membros, Drive…"
              )
            }
          >
            <Entrada id="curso-link" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </Campo>
          <Campo rotulo="E-mail de acesso" htmlFor="curso-email" dica="Senha não fica aqui: use um gerenciador de senhas.">
            <Entrada id="curso-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
        </div>

        {status === "em_andamento" || status === "pausado" ? (
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="curso-progresso" className="text-sm font-medium text-ink-2">
                Progresso
              </label>
              {progresso !== null ? (
                <button type="button" onClick={() => setProgresso(null)} className="text-xs text-ink-3 hover:text-ink">
                  Não sei
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <input
                id="curso-progresso"
                type="range"
                min={0}
                max={100}
                step={5}
                value={progresso ?? 0}
                onChange={(e) => setProgresso(Number(e.target.value))}
                className="h-11 flex-1 accent-[var(--pen)]"
              />
              <span className="tabular w-12 text-right text-sm font-semibold">{progresso === null ? "—" : `${progresso}%`}</span>
            </div>
          </div>
        ) : null}
      </form>
    </Janela>
  )
}
