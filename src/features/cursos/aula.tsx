"use client"

import * as React from "react"
import { Trash } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { AreaTexto, Campo, Entrada, Seletor } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { useDesfazerNotas, useMudarNotas } from "./dados"
import { adicionarAula, adicionarPraticas, editarAula, mapaDe, ondeParei, proximoTitulo, removerAula, type Aula, type Curso } from "./logica"

const NOVO_MODULO = "__novo__"
const SEM_MODULO = "__sem__"

/**
 * Anotar uma aula (ou mexer numa já anotada): o título, o módulo, o que aprendeu e o que vai praticar.
 * A aula entra nas anotações do curso, no lugar certo da trilha.
 */
export function JanelaAula({ curso, aula, aberta, aoMudar }: { curso: Curso | null; aula?: Aula | null; aberta: boolean; aoMudar: (v: boolean) => void }) {
  const mudar = useMudarNotas()
  const desfazer = useDesfazerNotas()
  const [titulo, setTitulo] = React.useState("")
  const [modulo, setModulo] = React.useState(SEM_MODULO)
  const [novoModulo, setNovoModulo] = React.useState("")
  const [corpo, setCorpo] = React.useState("")
  const [acoes, setAcoes] = React.useState("")
  const campoTitulo = React.useRef<HTMLInputElement>(null)

  const mapa = React.useMemo(() => mapaDe(curso?.notes), [curso?.notes])
  const podeTerModulo = (mapa.nivelAula ?? 2) > 1 && (mapa.nivelAula ?? 2) < 7

  React.useEffect(() => {
    if (!aberta) return
    if (aula) {
      setTitulo(aula.titulo)
      setCorpo(aula.corpo)
    } else {
      setTitulo(proximoTitulo(mapa))
      setCorpo("")
      setAcoes("")
      setNovoModulo("")
      setModulo(ondeParei(mapa)?.modulo ?? SEM_MODULO)
    }
    // O título sugerido termina em " - ": o cursor vai para o fim, pronto para o nome da aula
    const t = setTimeout(() => {
      const el = campoTitulo.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
    }, 60)
    return () => clearTimeout(t)
    // Só ao abrir: o texto do curso pode mudar enquanto a janela está aberta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta])

  if (!curso) return null

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = titulo.replace(/\s+/g, " ").trim()
    if (!t || /[-–—:]$/.test(t)) {
      toast.error("Dê um nome para a aula.")
      return
    }
    if (aula) {
      const m = mudar(curso, (texto) => editarAula(texto, aula, { titulo: t, corpo }))
      if (m) toast.success("Aula atualizada.", { action: { label: "Desfazer", onClick: () => desfazer(curso, m) } })
      aoMudar(false)
      return
    }
    const itens = acoes.split("\n").map((x) => x.replace(/^[-*•\s]+/, "").trim()).filter(Boolean)
    const m = mudar(curso, (texto) =>
      adicionarPraticas(
        adicionarAula(texto, {
          titulo: t,
          corpo,
          modulo: modulo !== SEM_MODULO && modulo !== NOVO_MODULO ? modulo : null,
          novoModulo: modulo === NOVO_MODULO ? novoModulo : null,
        }),
        itens,
      ),
    )
    if (m) toast.success(itens.length ? `Aula anotada, com ${itens.length === 1 ? "1 ação" : `${itens.length} ações`} para praticar.` : "Aula anotada.", { action: { label: "Desfazer", onClick: () => desfazer(curso, m) } })
    aoMudar(false)
  }

  const tirar = () => {
    if (!aula) return
    const m = mudar(curso, (texto) => removerAula(texto, aula))
    if (m) toast("Aula tirada da trilha.", { action: { label: "Desfazer", onClick: () => desfazer(curso, m) } })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={aula ? "Aula" : "Anotar aula"}
      descricao={curso.name}
      largura="lg"
      className="tema-cursos"
      rodape={
        <>
          {aula ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={tirar}>
              <Trash /> Tirar
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-aula">
            {aula ? "Salvar" : "Anotar"}
          </Botao>
        </>
      }
    >
      <form id="form-aula" onSubmit={salvar} className="grid gap-4">
        <div className={podeTerModulo && !aula && (mapa.modulos.length || mapa.aulas.length) ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]" : "grid gap-4"}>
          <Campo rotulo="Aula" htmlFor="aula-titulo">
            <Entrada ref={campoTitulo} id="aula-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 05 - Como construir um círculo social forte" autoComplete="off" />
          </Campo>
          {podeTerModulo && !aula && (mapa.modulos.length || mapa.aulas.length) ? (
            <Campo rotulo="Módulo" htmlFor="aula-modulo">
              <Seletor id="aula-modulo" value={modulo} onChange={(e) => setModulo(e.target.value)}>
                {!mapa.modulos.length ? <option value={SEM_MODULO}>Sem módulo</option> : null}
                {mapa.modulos.map((m) => (
                  <option key={m.linha} value={m.titulo}>
                    {m.titulo}
                  </option>
                ))}
                <option value={NOVO_MODULO}>Novo módulo…</option>
              </Seletor>
            </Campo>
          ) : null}
        </div>
        {modulo === NOVO_MODULO && !aula ? (
          <Campo rotulo="Nome do módulo novo" htmlFor="aula-novo-modulo">
            <Entrada id="aula-novo-modulo" value={novoModulo} onChange={(e) => setNovoModulo(e.target.value)} placeholder="Ex.: Módulo 2 - Prática" />
          </Campo>
        ) : null}
        <Campo rotulo="O que você aprendeu" htmlFor="aula-corpo" dica="Use - para tópicos e **negrito** para o que é importante.">
          <AreaTexto id="aula-corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={aula ? 12 : 8} placeholder={"- A ideia principal da aula\n- Um exemplo que ficou na cabeça"} className="font-mono text-[13px]" />
        </Campo>
        {!aula ? (
          <Campo rotulo="Para praticar (opcional)" htmlFor="aula-acoes" dica="Uma ação por linha. Elas aparecem em “Para praticar”, com caixa para marcar.">
            <AreaTexto id="aula-acoes" value={acoes} onChange={(e) => setAcoes(e.target.value)} rows={3} placeholder="Ex.: Toda semana, listar 3 pontos fortes" />
          </Campo>
        ) : null}
      </form>
    </Janela>
  )
}
