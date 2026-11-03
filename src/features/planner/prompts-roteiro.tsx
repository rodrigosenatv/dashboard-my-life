"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ChevronDown, LoaderCircle, Plus, RotateCcw, Trash } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Carregando, Etiqueta, Secao, Segmentos } from "@/components/ui/basicos"
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { cn } from "@/lib/utils"
import {
  LIMITE_PARTES,
  MODELOS_ROTEIRO,
  ehLacunaDoTopico,
  igualAoPadrao,
  lacunasDe,
  partesPadrao,
  rotuloDaLacuna,
  type IdModeloRoteiro,
  type ParteRoteiro,
  type TipoParte,
} from "@/features/conteudo/roteiro-ia"
import { useRascunhoRoteiro, type RascunhoRoteiro } from "./roteiro-ia-dados"

/** Liga e desliga uma parte na geração. */
function Interruptor({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      title={ligado ? "Entra ao gerar" : "Fica de fora ao gerar"}
      onClick={() => aoMudar(!ligado)}
      className="grid size-11 shrink-0 place-items-center rounded-full sm:size-9"
    >
      <span aria-hidden className={cn("relative h-5 w-9 rounded-full transition-colors", ligado ? "bg-pen" : "bg-surface-3")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-[left]", ligado ? "left-[1.125rem]" : "left-0.5")} />
      </span>
    </button>
  )
}

function ParteEditavel({
  parte,
  indice,
  total,
  aberta,
  aoAlternar,
  aoMudar,
  aoMover,
  aoRemover,
}: {
  parte: ParteRoteiro
  indice: number
  total: number
  aberta: boolean
  aoAlternar: () => void
  aoMudar: (campos: Partial<ParteRoteiro>) => void
  aoMover: (direcao: -1 | 1) => void
  aoRemover: () => void
}) {
  const id = `ri-${parte.id}`
  const lacunas = lacunasDe([parte.texto])
  return (
    <li className={cn("rounded-lg border bg-surface transition-colors", aberta ? "border-line-strong" : "border-line")}>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={aoAlternar}
          aria-expanded={aberta}
          aria-controls={`${id}-corpo`}
          className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-2 pl-3 text-left", !parte.ativa && "opacity-60")}
        >
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-ink-3">{indice + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{parte.nome.trim() || "Sem nome"}</span>
          <Etiqueta cor={parte.tipo === "ia" ? "conteudo" : "neutra"} className="shrink-0">
            {parte.tipo === "ia" ? "IA" : "Fixo"}
          </Etiqueta>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-3 transition-transform", aberta && "rotate-180")} />
        </button>
        <Interruptor ligado={parte.ativa} aoMudar={(ativa) => aoMudar({ ativa })} rotulo={`Usar a parte ${parte.nome.trim() || indice + 1} ao gerar`} />
      </div>
      {aberta ? (
        <div id={`${id}-corpo`} className="grid gap-3 border-t border-line p-3">
          <Campo rotulo="Nome (o título da parte no roteiro)" htmlFor={`${id}-nome`}>
            <Entrada id={`${id}-nome`} value={parte.nome} maxLength={60} onChange={(e) => aoMudar({ nome: e.target.value })} />
          </Campo>
          <Segmentos<TipoParte>
            rotulo="Tipo da parte"
            valor={parte.tipo}
            aoMudar={(tipo) => aoMudar({ tipo })}
            opcoes={[
              { valor: "ia", rotulo: "Pedido para a IA" },
              { valor: "fixo", rotulo: "Texto fixo" },
            ]}
          />
          <Campo
            rotulo={parte.tipo === "ia" ? "Prompt" : "Texto"}
            htmlFor={`${id}-texto`}
            dica={
              <>
                {parte.tipo === "ia"
                  ? "A IA escreve esta parte seguindo o prompt. O que está entre chaves, como {número}, ela completa."
                  : "Entra no roteiro como está, sem passar pela IA (bom para um checklist que não muda)."}
                {lacunas.length ? (
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    Lacunas:
                    {lacunas.map((l) => (
                      <span key={l} className="campo-prompt font-mono">
                        {l}
                      </span>
                    ))}
                  </span>
                ) : null}
              </>
            }
          >
            <AreaTexto
              id={`${id}-texto`}
              rows={parte.tipo === "ia" ? 7 : 9}
              value={parte.texto}
              onChange={(e) => aoMudar({ texto: e.target.value })}
              placeholder={parte.tipo === "ia" ? "Ex.: Escreva 3 opções de gancho sobre [TÓPICO]…" : "Ex.: - [ ] Conferir o áudio"}
            />
          </Campo>
          <div className="flex flex-wrap items-center gap-1">
            <Botao variante="fantasma" tamanho="icone-sm" aria-label="Subir esta parte" title="Subir" disabled={indice === 0} onClick={() => aoMover(-1)}>
              <ArrowUp />
            </Botao>
            <Botao variante="fantasma" tamanho="icone-sm" aria-label="Descer esta parte" title="Descer" disabled={indice === total - 1} onClick={() => aoMover(1)}>
              <ArrowDown />
            </Botao>
            <Botao variante="fantasma" tamanho="sm" className="ml-auto text-danger hover:text-danger" disabled={total <= 1} onClick={aoRemover}>
              <Trash /> Remover parte
            </Botao>
          </div>
        </div>
      ) : null}
    </li>
  )
}

/**
 * O editor dos prompts do roteiro: as partes de cada modelo (o nome, o prompt ou o texto fixo, a ordem e se entram
 * ao gerar), as instruções gerais e as lacunas já preenchidas. Muda o rascunho; quem usa decide onde fica o "Salvar".
 */
export function EditorPromptsRoteiro({ rascunho, modeloInicial = "reels" }: { rascunho: RascunhoRoteiro; modeloInicial?: IdModeloRoteiro }) {
  const [modelo, setModelo] = React.useState<IdModeloRoteiro>(modeloInicial)
  const [aberta, setAberta] = React.useState<string | null>(null)
  const { config, mudar } = rascunho
  const partes = config.modelos[modelo]
  const info = MODELOS_ROTEIRO.find((m) => m.id === modelo)!
  const padrao = igualAoPadrao(modelo, partes)

  const mudarPartes = (f: (lista: ParteRoteiro[]) => ParteRoteiro[]) => mudar((c) => ({ ...c, modelos: { ...c.modelos, [modelo]: f(c.modelos[modelo]) } }))
  const mudarParte = (id: string, campos: Partial<ParteRoteiro>) => mudarPartes((lista) => lista.map((p) => (p.id === id ? { ...p, ...campos } : p)))
  const mover = (i: number, direcao: -1 | 1) =>
    mudarPartes((lista) => {
      const j = i + direcao
      if (j < 0 || j >= lista.length) return lista
      const nova = [...lista]
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      return nova
    })
  const adicionar = () => {
    const id = `parte-${Date.now().toString(36)}`
    mudarPartes((lista) => [...lista, { id, nome: "Nova parte", tipo: "ia", texto: "", ativa: true }])
    setAberta(id)
  }

  // As lacunas que não mudam a cada conteúdo (o tópico vem do título de cada um) e as que já têm valor guardado
  const lembradas = [
    ...new Set([
      ...lacunasDe([config.instrucoes, ...MODELOS_ROTEIRO.flatMap((m) => config.modelos[m.id].map((p) => p.texto))]).filter((l) => !ehLacunaDoTopico(l)),
      ...Object.keys(config.lacunas),
    ]),
  ]

  return (
    <div className="grid gap-6">
      <p className="text-sm text-ink-2">
        Cada parte vira um título no roteiro, na ordem da lista. As partes de IA vão juntas num pedido só: a IA escreve tudo de uma vez, coerente do título ao checklist. Use{" "}
        <span className="campo-prompt font-mono">[NOME]</span> para uma lacuna que você preenche antes de gerar, como <span className="campo-prompt font-mono">[TÓPICO]</span>.
      </p>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Segmentos<IdModeloRoteiro>
            rotulo="Modelo de roteiro"
            valor={modelo}
            aoMudar={(v) => {
              setModelo(v)
              setAberta(null)
            }}
            opcoes={MODELOS_ROTEIRO.map((m) => ({ valor: m.id, rotulo: m.rotulo }))}
          />
          <span className="text-xs text-ink-3">{padrao ? "Prompts padrão" : "Personalizado"}</span>
        </div>
        <ol className="grid gap-2" aria-label={`Partes do roteiro de ${info.rotulo}`}>
          {partes.map((p, i) => (
            <ParteEditavel
              key={p.id}
              parte={p}
              indice={i}
              total={partes.length}
              aberta={aberta === p.id}
              aoAlternar={() => setAberta((a) => (a === p.id ? null : p.id))}
              aoMudar={(campos) => mudarParte(p.id, campos)}
              aoMover={(d) => mover(i, d)}
              aoRemover={() => mudarPartes((lista) => (lista.length > 1 ? lista.filter((x) => x.id !== p.id) : lista))}
            />
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Botao variante="contorno" tamanho="sm" onClick={adicionar} disabled={partes.length >= LIMITE_PARTES}>
            <Plus /> Adicionar parte
          </Botao>
          {padrao ? null : (
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => {
                mudarPartes(() => partesPadrao(modelo))
                setAberta(null)
              }}
            >
              <RotateCcw /> Restaurar o padrão do {info.rotulo}
            </Botao>
          )}
        </div>
      </div>

      <Campo rotulo="Instruções gerais" htmlFor="ri-instrucoes" dica="Vão em todo pedido, nos dois modelos: sobre o que é o perfil, para quem você fala e o tom de voz.">
        <AreaTexto
          id="ri-instrucoes"
          rows={3}
          value={config.instrucoes}
          onChange={(e) => mudar((c) => ({ ...c, instrucoes: e.target.value }))}
          placeholder="Ex.: Meu perfil ensina concursos para quem estuda e trabalha. Tom direto, informal e sem jargão."
        />
      </Campo>

      {lembradas.length ? (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-ink-2">Lacunas já preenchidas</legend>
          <p className="-mt-1.5 text-xs text-ink-3">Chegam preenchidas em todo conteúdo e mudam quando você gera com outro valor. O tópico vem do título de cada conteúdo.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {lembradas.map((l, i) => (
              <Campo key={l} rotulo={rotuloDaLacuna(l)} htmlFor={`ri-lacuna-${i}`}>
                <Entrada
                  id={`ri-lacuna-${i}`}
                  value={config.lacunas[l] ?? ""}
                  maxLength={300}
                  placeholder="Vazio: a IA deduz pelo tópico"
                  onChange={(e) => mudar((c) => ({ ...c, lacunas: { ...c.lacunas, [l]: e.target.value } }))}
                />
              </Campo>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}

/** Os prompts abertos de dentro do conteúdo: o rascunho fica se a janela fechar sem querer; "Cancelar" descarta. */
export function JanelaPromptsRoteiro({ aberta, aoMudar, modeloInicial }: { aberta: boolean; aoMudar: (v: boolean) => void; modeloInicial: IdModeloRoteiro }) {
  const rascunho = useRascunhoRoteiro()
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Prompts do roteiro"
      descricao="O que a IA segue ao gerar. Vale para todos os conteúdos."
      largura="lg"
      rodape={
        <>
          <Botao
            variante="fantasma"
            onClick={() => {
              rascunho.descartar()
              aoMudar(false)
            }}
          >
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            disabled={rascunho.salvando || rascunho.carregando}
            onClick={async () => {
              const mudou = rascunho.mudou
              if (!(await rascunho.salvar())) return
              if (mudou) toast.success("Prompts salvos")
              aoMudar(false)
            }}
          >
            {rascunho.salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Botao>
        </>
      }
    >
      {/* A chave reabre no modelo do conteúdo */}
      {rascunho.carregando ? <Carregando linhas={4} /> : <EditorPromptsRoteiro key={modeloInicial} rascunho={rascunho} modeloInicial={modeloInicial} />}
    </Janela>
  )
}

/** A seção de Configurações. */
export function SecaoPromptsRoteiro() {
  const rascunho = useRascunhoRoteiro()
  return (
    <Secao titulo="Roteiros com IA" descricao="Os prompts do botão Gerar com IA, no conteúdo do Planner: as partes do roteiro de Reels e de Carrossel.">
      {rascunho.carregando ? (
        <Carregando linhas={4} />
      ) : (
        <>
          <EditorPromptsRoteiro rascunho={rascunho} />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Botao
              variante="primario"
              disabled={!rascunho.mudou || rascunho.salvando}
              onClick={async () => {
                if (await rascunho.salvar()) toast.success("Prompts salvos")
              }}
            >
              {rascunho.salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar prompts
            </Botao>
            {rascunho.mudou ? (
              <Botao variante="fantasma" onClick={rascunho.descartar}>
                Descartar mudanças
              </Botao>
            ) : null}
          </div>
        </>
      )}
    </Secao>
  )
}
