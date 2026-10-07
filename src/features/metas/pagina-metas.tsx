"use client"

import * as React from "react"
import { Gift, Minus, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Progresso, Secao, Vazio } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { novoId, useAtualizar, useCriar, useExcluir, useLista } from "@/lib/data"
import type { Tables } from "@/lib/supabase/database.types"
import { numero, porcentagem } from "@/lib/utils"

type Meta = Tables<"goals">

function DialogoMeta({ aberta, aoMudar, meta }: { aberta: boolean; aoMudar: (v: boolean) => void; meta?: Meta | null }) {
  const criar = useCriar("goals")
  const atualizar = useAtualizar("goals")
  const excluir = useExcluir("goals")
  const [nome, setNome] = React.useState("")
  const [ano, setAno] = React.useState("")
  const [alvo, setAlvo] = React.useState("")
  const [feito, setFeito] = React.useState("")
  const [unidade, setUnidade] = React.useState("")
  const [recompensa, setRecompensa] = React.useState("")
  const [tags, setTags] = React.useState("")
  const [descricao, setDescricao] = React.useState("")

  React.useEffect(() => {
    if (!aberta) return
    setNome(meta?.name ?? "")
    setAno(String(meta?.year ?? new Date().getFullYear()))
    setAlvo(meta?.target?.toString() ?? "")
    setFeito(meta?.progress?.toString() ?? "0")
    setUnidade(meta?.unit ?? "")
    setRecompensa(meta?.reward ?? "")
    setTags((meta?.tags ?? []).join(", "))
    setDescricao(meta?.description ?? "")
  }, [aberta, meta])

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    const campos = {
      name: nome.trim(),
      year: ano ? Number(ano) : null,
      target: alvo ? Number(alvo.replace(",", ".")) : null,
      progress: feito ? Number(feito.replace(",", ".")) : 0,
      unit: unidade.trim() || null,
      reward: recompensa.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      description: descricao.trim() || null,
    }
    if (meta) atualizar.mutate({ id: meta.id, ...campos })
    else criar.mutate({ id: novoId(), position: Date.now() % 1_000_000, ...campos })
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={meta ? "Editar meta" : "Nova meta"}
      rodape={
        <>
          {meta ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:text-danger" onClick={() => { excluir.mutate(meta.id); aoMudar(false) }}>
              Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-meta" disabled={!nome.trim()}>{meta ? "Salvar" : "Criar meta"}</Botao>
        </>
      }
    >
      <form id="form-meta" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Meta" htmlFor="m-nome">
          <Entrada id="m-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ler 12 livros" />
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Ano" htmlFor="m-ano">
            <Entrada id="m-ano" inputMode="numeric" value={ano} onChange={(e) => setAno(e.target.value)} />
          </Campo>
          <Campo rotulo="Alvo" htmlFor="m-alvo">
            <Entrada id="m-alvo" inputMode="decimal" value={alvo} onChange={(e) => setAlvo(e.target.value)} />
          </Campo>
          <Campo rotulo="Feito" htmlFor="m-feito">
            <Entrada id="m-feito" inputMode="decimal" value={feito} onChange={(e) => setFeito(e.target.value)} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Unidade" htmlFor="m-un">
            <Entrada id="m-un" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="livros, dias, questões" />
          </Campo>
          <Campo rotulo="Tipo" htmlFor="m-tags" dica="Separe por vírgula">
            <Entrada id="m-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Leitura, Estudo" />
          </Campo>
        </div>
        <Campo rotulo="Recompensa" htmlFor="m-rec">
          <Entrada id="m-rec" value={recompensa} onChange={(e) => setRecompensa(e.target.value)} placeholder="O que você ganha ao bater a meta" />
        </Campo>
        <Campo rotulo="Notas" htmlFor="m-desc">
          <AreaTexto id="m-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
        </Campo>
      </form>
    </Janela>
  )
}

function CartaoMeta({ meta, aoAbrir }: { meta: Meta; aoAbrir: () => void }) {
  const atualizar = useAtualizar("goals")
  const alvo = Number(meta.target ?? 0)
  const feito = Number(meta.progress ?? 0)
  const p = porcentagem(feito, alvo)
  const passo = (n: number) => {
    const novo = Math.max(0, feito + n)
    atualizar.mutate({ id: meta.id, progress: novo, done: alvo > 0 && novo >= alvo })
  }
  return (
    <li className="border-b border-line py-4 last:border-0">
      <div className="flex items-start gap-4">
        <button type="button" onClick={aoAbrir} className="min-w-0 flex-1 text-left">
          <p className="font-medium">{meta.name}</p>
          <p className="mt-0.5 text-sm text-ink-2">
            <span className="tabular">{numero(feito, 1)}</span>
            {alvo ? <span className="tabular"> de {numero(alvo, 1)}</span> : null}
            {meta.unit ? ` ${meta.unit}` : ""}
            {alvo ? <span className="tabular text-ink-3"> ({p}%)</span> : null}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Botao variante="contorno" tamanho="icone-sm" aria-label={`Diminuir ${meta.name}`} onClick={() => passo(-1)}>
            <Minus />
          </Botao>
          <Botao variante="contorno" tamanho="icone-sm" aria-label={`Aumentar ${meta.name}`} onClick={() => passo(1)}>
            <Plus />
          </Botao>
        </div>
      </div>
      {alvo ? <Progresso valor={p} cor="rotina" rotulo={`Progresso de ${meta.name}`} className="mt-2.5" /> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {meta.tags.map((t) => (
          <Etiqueta key={t}>{t}</Etiqueta>
        ))}
        {meta.reward ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-3">
            <Gift className="size-3.5" /> {meta.reward}
          </span>
        ) : null}
        {meta.done ? <Etiqueta cor="rotina">Concluída</Etiqueta> : null}
      </div>
    </li>
  )
}

export function PaginaMetas() {
  const { data: metas = [], isLoading } = useLista("goals", { ordem: [{ coluna: "position" }, { coluna: "name" }] })
  const [aberta, setAberta] = React.useState<Meta | null>(null)
  const [nova, setNova] = React.useState(false)

  const anos = [...new Set(metas.map((m) => m.year ?? 0))].sort((a, b) => b - a)

  return (
    <div>
      <Cabecalho
        area="rotina"
        titulo="Metas"
        descricao="Defina alvos para o ano e atualize o progresso com os botões de mais e menos."
        acoes={<Botao variante="primario" onClick={() => setNova(true)}><Plus /> Nova meta</Botao>}
      />
      {isLoading ? (
        <Carregando />
      ) : metas.length === 0 ? (
        <Vazio titulo="Nenhuma meta ainda." descricao="Comece com uma meta simples para este ano, como ler 12 livros." acao={<Botao variante="primario" onClick={() => setNova(true)}>Criar meta</Botao>} />
      ) : (
        <div className="grid max-w-3xl gap-10">
          {anos.map((ano) => (
            <Secao key={ano} titulo={ano ? String(ano) : "Sem ano"}>
              <ul>
                {metas.filter((m) => (m.year ?? 0) === ano).map((m) => (
                  <CartaoMeta key={m.id} meta={m} aoAbrir={() => setAberta(m)} />
                ))}
              </ul>
            </Secao>
          ))}
        </div>
      )}
      <DialogoMeta aberta={nova || Boolean(aberta)} aoMudar={(v) => { if (!v) { setNova(false); setAberta(null) } }} meta={aberta} />
    </div>
  )
}
