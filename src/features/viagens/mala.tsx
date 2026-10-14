"use client"

import * as React from "react"
import { Check, Ellipsis, ListPlus, Luggage, Plus, RotateCcw, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Progresso, Vazio } from "@/components/ui/basicos"
import { Entrada } from "@/components/ui/campos"
import { Confirmar, Janela } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import type { Json } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import {
  MODELO_MALA,
  contarItensModelo,
  gruposDaMala,
  lerMala,
  malaDoModelo,
  modeloDaMala,
  novoIdMala,
  textoDias,
  useGravarViagens,
  useModeloMala,
  type ItemMala,
  type ModeloMala,
  type Viagem,
} from "./dados"

/**
 * A mala da viagem: começa do modelo da pessoa, marca o que já está dentro e, na volta,
 * desmarca tudo para arrumar de novo. O que mudar aqui pode virar o modelo das próximas.
 */
export function MalaViagem({ viagem }: { viagem: Viagem }) {
  const gravar = useGravarViagens()
  const { modelo, salvarModelo } = useModeloMala()
  const [editando, setEditando] = React.useState(false)
  const [editorModelo, setEditorModelo] = React.useState(false)
  const [apagar, setApagar] = React.useState(false)
  const mala = viagem.mala

  /** Muda a lista a partir da gravada mais recente (toques seguidos não se perdem). */
  const mudarMala = (mudar: (itens: ItemMala[]) => ItemMala[] | null) =>
    void gravar.mudarProps(
      viagem.item,
      (p) => {
        const nova = mudar(lerMala(p._mala) ?? [])
        if (nova) p._mala = nova as unknown as Json
        else delete p._mala
      },
      "viagens",
    )

  if (!mala) {
    return (
      <>
        <Vazio
          icone={<Luggage />}
          titulo="Monte a mala desta viagem."
          descricao={`Comece pelo seu modelo, com ${contarItensModelo(modelo)} itens, e ajuste o que precisar. Na volta, é só desmarcar tudo e usar de novo.`}
          acao={
            <div className="flex flex-wrap gap-2">
              <Botao variante="primario" onClick={() => mudarMala(() => malaDoModelo(modelo))}>
                Usar meu modelo
              </Botao>
              <Botao variante="fantasma" onClick={() => mudarMala(() => [])}>
                Começar do zero
              </Botao>
              <Botao variante="fantasma" onClick={() => setEditorModelo(true)}>
                Ver o modelo
              </Botao>
            </div>
          }
        />
        <EditorModelo aberta={editorModelo} aoMudar={setEditorModelo} />
      </>
    )
  }

  const grupos = gruposDaMala(mala)
  const prontos = mala.filter((i) => i.feito).length
  const alternar = (i: ItemMala) => mudarMala((itens) => itens.map((x) => (x.id === i.id ? { ...x, feito: !x.feito } : x)))
  const tirar = (i: ItemMala) => mudarMala((itens) => itens.filter((x) => x.id !== i.id))
  const adicionar = (texto: string, grupo: string) =>
    mudarMala((itens) => {
      const novo: ItemMala = { id: novoIdMala(), texto, grupo, feito: false }
      const ultimo = itens.map((x) => x.grupo).lastIndexOf(grupo)
      return ultimo < 0 ? [...itens, novo] : [...itens.slice(0, ultimo + 1), novo, ...itens.slice(ultimo + 1)]
    })

  return (
    <div className="grid gap-5">
      <section aria-label="Andamento da mala" className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular">{prontos}</span>
            <span className="text-ink-2"> de {mala.length} na mala</span>
          </p>
          <div className="flex items-center gap-1.5">
            <Botao variante={editando ? "primario" : "contorno"} tamanho="sm" onClick={() => setEditando((e) => !e)}>
              {editando ? "Concluir" : "Editar itens"}
            </Botao>
            <Menu>
              <MenuGatilho asChild>
                <Botao variante="fantasma" tamanho="icone-sm" aria-label="Mais opções da mala">
                  <Ellipsis />
                </Botao>
              </MenuGatilho>
              <MenuConteudo className="w-64">
                <MenuItem disabled={!prontos} onSelect={() => mudarMala((itens) => itens.map((x) => ({ ...x, feito: false })))}>
                  <RotateCcw /> Desmarcar tudo (para a volta)
                </MenuItem>
                <MenuItem
                  disabled={!mala.length}
                  onSelect={() => {
                    salvarModelo(modeloDaMala(mala))
                    toast.success("Modelo da mala atualizado", { description: "As próximas viagens começam com esta lista." })
                  }}
                >
                  <Save /> Salvar como meu modelo
                </MenuItem>
                <MenuItem onSelect={() => setEditorModelo(true)}>
                  <ListPlus /> Editar o modelo
                </MenuItem>
                <MenuSeparador />
                <MenuItem perigo onSelect={() => setApagar(true)}>
                  <Trash2 /> Apagar a lista
                </MenuItem>
              </MenuConteudo>
            </Menu>
          </div>
        </div>
        <Progresso valor={mala.length ? (prontos / mala.length) * 100 : 0} rotulo="Itens prontos na mala" className="mt-3" />
        {mala.length && prontos === mala.length ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-sm font-medium">
            <Check className="size-4 text-pen" aria-hidden /> Tudo na mala. Boa viagem!
          </p>
        ) : null}
      </section>

      {grupos.map((g) => {
        const feitos = g.itens.filter((i) => i.feito).length
        return (
          <section key={g.grupo} aria-label={g.grupo}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">
                {g.grupo}
                {g.grupo === "Roupas" && viagem.dias ? <span className="ml-2 font-normal text-ink-3">para {textoDias(viagem.dias)}</span> : null}
              </h3>
              <span className="text-xs tabular text-ink-3">
                {feitos}/{g.itens.length}
              </span>
            </div>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {g.itens.map((i) => (
                <LinhaMala key={i.id} item={i} editando={editando} aoAlternar={() => alternar(i)} aoTirar={() => tirar(i)} />
              ))}
              <li>
                <NovoItem rotulo={`Adicionar em ${g.grupo}`} aoAdicionar={(t) => adicionar(t, g.grupo)} />
              </li>
            </ul>
          </section>
        )
      })}

      {!grupos.length || editando ? <NovoGrupo vazio={!grupos.length} aoCriar={(grupo, item) => adicionar(item, grupo)} /> : null}

      <EditorModelo aberta={editorModelo} aoMudar={setEditorModelo} />
      <Confirmar aberta={apagar} aoMudar={setApagar} titulo="Apagar a lista da mala?" descricao="O modelo continua guardado para começar de novo." acao="Apagar" aoConfirmar={() => mudarMala(() => null)} />
    </div>
  )
}

function LinhaMala({ item, editando, aoAlternar, aoTirar }: { item: ItemMala; editando: boolean; aoAlternar: () => void; aoTirar: () => void }) {
  return (
    <li className="flex items-center">
      <button type="button" role="checkbox" aria-checked={item.feito} onClick={aoAlternar} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left sm:px-4 toque:min-h-12">
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors", item.feito ? "border-pen bg-pen text-pen-ink" : "border-line-strong")}>
          {item.feito ? <Check className="size-3.5 animate-marcar" strokeWidth={3} aria-hidden /> : null}
        </span>
        <span className={cn("min-w-0 flex-1 text-sm leading-snug", item.feito && "text-ink-3 line-through")}>{item.texto}</span>
      </button>
      {editando ? (
        <button type="button" onClick={aoTirar} aria-label={`Tirar ${item.texto} da lista`} className="mr-1.5 grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger toque:size-11">
          <X className="size-4" />
        </button>
      ) : null}
    </li>
  )
}

/** "+ Adicionar" que vira um campo; Enter adiciona e o campo continua aberto para o próximo. */
function NovoItem({ rotulo, aoAdicionar, className }: { rotulo: string; aoAdicionar: (texto: string) => void; className?: string }) {
  const [aberto, setAberto] = React.useState(false)
  const [texto, setTexto] = React.useState("")
  if (!aberto)
    return (
      <button type="button" onClick={() => setAberto(true)} className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink-3 hover:text-ink-2 sm:px-4 toque:min-h-11", className)}>
        <Plus className="size-4" aria-hidden /> Adicionar
      </button>
    )
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t) return setAberto(false)
    aoAdicionar(t)
    setTexto("")
  }
  return (
    <form onSubmit={enviar} className={cn("flex items-center gap-2 px-3 py-2 sm:px-4", className)}>
      <Entrada
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => !texto.trim() && setAberto(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setTexto("")
            setAberto(false)
          }
        }}
        placeholder="Ex.: Carregador do relógio"
        aria-label={rotulo}
        enterKeyHint="done"
        className="flex-1"
      />
      <Botao variante="contorno" tamanho="sm" type="submit">
        Adicionar
      </Botao>
    </form>
  )
}

function NovoGrupo({ vazio, aoCriar }: { vazio: boolean; aoCriar: (grupo: string, item: string) => void }) {
  const [grupo, setGrupo] = React.useState("")
  const [item, setItem] = React.useState("")
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const g = grupo.trim() || "Itens"
    const t = item.trim()
    if (!t) return
    aoCriar(g, t)
    setItem("")
  }
  return (
    <form onSubmit={enviar} className="grid gap-2 rounded-xl border border-dashed border-line-strong p-3.5">
      <p className="text-sm font-medium">{vazio ? "Primeiro item" : "Novo grupo"}</p>
      <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
        <Entrada value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Grupo (ex.: Praia)" aria-label="Nome do grupo" />
        <Entrada value={item} onChange={(e) => setItem(e.target.value)} placeholder="Item (ex.: Canga)" aria-label="Primeiro item do grupo" />
        <Botao variante="contorno" type="submit" disabled={!item.trim()}>
          Adicionar
        </Botao>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Modelo da mala                                                      */
/* ------------------------------------------------------------------ */

/** O modelo que toda viagem nova usa: grupos e itens, para ajustar uma vez. */
export function EditorModelo({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const { modelo, proprio, salvarModelo } = useModeloMala()
  const [grupos, setGrupos] = React.useState<ModeloMala>(modelo)
  const estavaAberta = React.useRef(false)
  React.useEffect(() => {
    if (aberta && !estavaAberta.current) setGrupos(modelo)
    estavaAberta.current = aberta
  }, [aberta, modelo])

  const mudarGrupo = (i: number, mudar: (g: ModeloMala[number]) => ModeloMala[number] | null) =>
    setGrupos((gs) => gs.flatMap((g, k) => (k === i ? (mudar(g) ?? []) : [g])))
  const total = contarItensModelo(grupos)

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Modelo da mala"
      descricao="Toda mala nova começa com esta lista. Mudar o modelo não mexe nas malas já montadas."
      largura="lg"
      rodape={
        <>
          {proprio ? (
            <Botao variante="fantasma" className="mr-auto" onClick={() => setGrupos(MODELO_MALA)}>
              Voltar ao padrão
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={() => {
              salvarModelo(grupos.map((g) => ({ grupo: g.grupo.trim() || "Itens", itens: g.itens })).filter((g) => g.itens.length))
              toast.success("Modelo da mala salvo")
              aoMudar(false)
            }}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-5">
        <p className="text-sm text-ink-2">{total === 1 ? "1 item" : `${total} itens`} em {grupos.length === 1 ? "1 grupo" : `${grupos.length} grupos`}.</p>
        {grupos.map((g, i) => (
          <section key={i} className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <Entrada value={g.grupo} onChange={(e) => mudarGrupo(i, (x) => ({ ...x, grupo: e.target.value }))} aria-label="Nome do grupo" className="h-8 max-w-60 font-semibold toque:h-10" />
              <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Tirar o grupo ${g.grupo}`} className="text-ink-3 hover:text-danger" onClick={() => mudarGrupo(i, () => null)}>
                <Trash2 />
              </Botao>
            </div>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {g.itens.map((t, k) => (
                <li key={`${t}-${k}`} className="flex items-center gap-2 pl-3 sm:pl-4">
                  <span className="min-w-0 flex-1 py-2 text-sm">{t}</span>
                  <button
                    type="button"
                    onClick={() => mudarGrupo(i, (x) => ({ ...x, itens: x.itens.filter((_, j) => j !== k) }))}
                    aria-label={`Tirar ${t}`}
                    className="mr-1 grid size-9 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-danger-soft hover:text-danger toque:size-11"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
              <li>
                <NovoItem rotulo={`Adicionar em ${g.grupo}`} aoAdicionar={(t) => mudarGrupo(i, (x) => ({ ...x, itens: [...x.itens, t] }))} />
              </li>
            </ul>
          </section>
        ))}
        <Botao variante="contorno" className="justify-self-start" onClick={() => setGrupos((gs) => [...gs, { grupo: "Novo grupo", itens: [] }])}>
          <Plus /> Novo grupo
        </Botao>
      </div>
    </Janela>
  )
}
