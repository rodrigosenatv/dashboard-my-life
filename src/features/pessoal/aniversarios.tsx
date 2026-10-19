"use client"

import * as React from "react"
import { Cake, PartyPopper, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { cn, isoDia, primeiroNome } from "@/lib/utils"
import { Iniciais } from "./ui"
import { useGravarPessoal } from "./dados"
import {
  anoDesconhecido,
  anoParaMostrar,
  type Aniversario,
  type Contato,
  celularDoAniversario,
  gravarCampo,
  linhaDoAniversario,
  linkWhatsApp,
  mensagemParabens,
  nascimentoSemAno,
  proximosAniversarios,
} from "./logica"

const LIMITE = 5

/** Os próximos aniversários: hoje com o botão de parabéns, e a janela de cada um ao tocar no nome. */
export function CartaoAniversarios({
  aniversarios,
  contatos,
  aoNovo,
  aoEditar,
}: {
  aniversarios: Aniversario[]
  contatos: Contato[]
  aoNovo: () => void
  aoEditar: (a: Aniversario) => void
}) {
  const [todos, setTodos] = React.useState(false)
  const hoje = isoDia()
  const lista = React.useMemo(() => proximosAniversarios(aniversarios, hoje), [aniversarios, hoje])
  const visiveis = todos ? lista : lista.slice(0, LIMITE)

  return (
    <Secao
      titulo="Aniversários"
      acao={
        <Botao variante="fantasma" tamanho="sm" aria-label="Adicionar aniversário" onClick={aoNovo}>
          <Plus /> Adicionar
        </Botao>
      }
    >
      {!lista.length ? (
        <Vazio
          icone={<Cake />}
          titulo="Nenhum aniversário guardado."
          descricao="Guarde as datas das pessoas próximas para lembrar a tempo de dar parabéns."
          acao={
            <Botao variante="primario" tamanho="sm" onClick={aoNovo}>
              <Plus /> Adicionar aniversário
            </Botao>
          }
        />
      ) : (
        <div className="rounded-xl border border-line bg-surface p-2 sm:p-3">
          <ul className="grid">
            {visiveis.map((p) => {
              const a = p.aniversario
              const hojeEh = p.dias === 0
              const parabens = hojeEh ? linkWhatsApp(celularDoAniversario(a, contatos), mensagemParabens(a.nome)) : null
              return (
                <li key={a.id} className={cn("flex items-center gap-3 rounded-lg px-2 py-1.5", hojeEh ? "bg-pen-soft" : "hover:bg-surface-2")}>
                  <button type="button" onClick={() => aoEditar(a)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left toque:min-h-11">
                    {hojeEh ? (
                      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-pen text-pen-ink">
                        <Cake className="size-4" />
                      </span>
                    ) : (
                      <Iniciais nome={a.nome} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.nome}</span>
                      <span className="block text-xs text-ink-2">{linhaDoAniversario(p)}</span>
                    </span>
                  </button>
                  {parabens ? (
                    <Botao asChild variante="primario" tamanho="sm">
                      <a href={parabens} target="_blank" rel="noreferrer" aria-label={`Dar parabéns a ${a.nome} pelo WhatsApp`}>
                        <PartyPopper /> Dar parabéns
                      </a>
                    </Botao>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {lista.length > LIMITE ? (
            <div className="px-1 pt-1">
              <Botao variante="fantasma" tamanho="sm" onClick={() => setTodos((v) => !v)}>
                {todos ? "Mostrar menos" : `Ver todos (${lista.length})`}
              </Botao>
            </div>
          ) : null}
        </div>
      )}
    </Secao>
  )
}

/** Novo aniversário ou edição; excluir tem "Desfazer". */
export function FormAniversario({ aberta, aoMudar, aniversario }: { aberta: boolean; aoMudar: (v: boolean) => void; aniversario: Aniversario | null }) {
  const gravar = useGravarPessoal()
  const [nome, setNome] = React.useState("")
  const [data, setData] = React.useState("")
  const [semAno, setSemAno] = React.useState(false)
  const [celular, setCelular] = React.useState("")
  const [erro, setErro] = React.useState<{ campo: "nome" | "data"; texto: string } | null>(null)
  const [salvando, setSalvando] = React.useState(false)

  // Ao abrir, começa do que está gravado (ou em branco). Com "Sem o ano", o campo mostra o ano atual.
  React.useEffect(() => {
    if (!aberta) return
    const nasc = aniversario?.nascimento ?? ""
    const desconhecido = nascimentoSemAno(nasc)
    setNome(aniversario?.nome === "Sem nome" ? "" : (aniversario?.nome ?? ""))
    setSemAno(desconhecido)
    setData(desconhecido ? `${anoParaMostrar(nasc.slice(5), Number(isoDia().slice(0, 4)))}-${nasc.slice(5)}` : nasc)
    setCelular(aniversario?.celular ?? "")
    setErro(null)
    setSalvando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, aniversario?.id])

  const hoje = isoDia()

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    const t = nome.trim()
    if (!t) return setErro({ campo: "nome", texto: "Escreva o nome." })
    if (!data) return setErro({ campo: "data", texto: "Escolha a data de nascimento." })
    if (!semAno && data > hoje) return setErro({ campo: "data", texto: "Essa data ainda não chegou." })
    setErro(null)
    setSalvando(true)
    const dataGravada = semAno ? `${anoDesconhecido(data.slice(5))}-${data.slice(5)}` : data
    const aplicar = (props: Record<string, Json>) => {
      gravarCampo(props, ["Data de nascimento", "Nascimento", "Aniversário", "Data"], dataGravada)
      gravarCampo(props, ["Celular", "Telefone", "WhatsApp"], celular.trim())
      return props
    }
    try {
      if (aniversario) {
        await gravar.mudar(aniversario.item, (atual) => ({ title: t, props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }) }), "aniversarios")
        toast.success("Aniversário atualizado")
      } else {
        await gravar.criar("aniversarios", { title: t, props: aplicar({}) })
        toast.success(`Aniversário de ${primeiroNome(t)} guardado`)
      }
    } catch {
      // Quem grava já avisou o que deu errado
      setSalvando(false)
      return
    }
    setSalvando(false)
    aoMudar(false)
  }

  const excluir = () => {
    if (!aniversario) return
    const item = aniversario.item
    aoMudar(false)
    void gravar.excluir([item])
    toast.success("Aniversário excluído", {
      action: {
        label: "Desfazer",
        onClick: () => void gravar.criar("aniversarios", { id: item.id, title: item.title, props: (item.props ?? {}) as Record<string, Json>, content: item.content, position: item.position }).catch(() => undefined),
      },
    })
  }

  const idForm = "form-aniversario"
  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo={aniversario ? "Editar aniversário" : "Novo aniversário"}
      rodape={
        <>
          {aniversario ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={excluir} disabled={salvando}>
              <Trash2 /> Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <Campo rotulo="Nome" htmlFor="aniversario-nome">
          <Entrada id="aniversario-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" aria-invalid={erro?.campo === "nome" || undefined} />
          {erro?.campo === "nome" ? <Erro texto={erro.texto} /> : null}
        </Campo>
        <Campo rotulo="Data de nascimento" htmlFor="aniversario-data">
          <Entrada
            id="aniversario-data"
            type="date"
            max={semAno ? undefined : hoje}
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-invalid={erro?.campo === "data" || undefined}
            className="max-w-48"
          />
          <label className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={semAno} onChange={(e) => setSemAno(e.target.checked)} className="size-4 accent-pen" />
            Sem o ano
          </label>
          {erro?.campo === "data" ? <Erro texto={erro.texto} /> : null}
        </Campo>
        <Campo rotulo="Celular" htmlFor="aniversario-celular" dica="Opcional. Serve para mandar os parabéns pelo WhatsApp.">
          <Entrada id="aniversario-celular" type="tel" inputMode="tel" autoComplete="off" value={celular} onChange={(e) => setCelular(e.target.value)} />
        </Campo>
      </form>
    </Janela>
  )
}

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {texto}
    </p>
  )
}
