"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, ChevronLeft, Clapperboard, SkipForward } from "lucide-react"
import { MarkdownSobDemanda as Markdown } from "@/components/markdown-sob-demanda"
import { Carregando } from "@/components/ui/basicos"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { useAtualizar, useLista } from "@/lib/data"
import { useTelaAcesa } from "@/lib/tela-acesa"
import { cn, dataRelativa, plural } from "@/lib/utils"

type Roteiro = { id: string; title: string; script: string | null; format: string | null; publish_date: string | null; status: string }

/**
 * Gravar em lote: os roteiros da etapa Gravando, um por vez, em letra grande e com a tela acesa.
 * "Gravado" leva o conteúdo para Editando e passa para o próximo; no fim, um aviso único com "Desfazer".
 */
function Sessao({ ids, aoFechar }: { ids: string[]; aoFechar: () => void }) {
  useTelaAcesa(true)
  const { data: lista = [], isLoading } = useLista("content_items", {
    colunas: "id,title,script,format,publish_date,status",
    filtro: (q) => q.in("id", ids),
    chave: ["sessao-gravacao", ids.join(",")],
  })
  const atualizar = useAtualizar("content_items")
  const roteiros = ids.map((id) => (lista as Roteiro[]).find((r) => r.id === id)).filter((r): r is Roteiro => Boolean(r))
  const [indice, setIndice] = React.useState(0)
  const gravados = React.useRef<string[]>([])
  const [feitos, setFeitos] = React.useState<string[]>([])
  const atual = roteiros[indice]
  const acabou = !isLoading && indice >= roteiros.length

  const fechar = () => {
    const ids = gravados.current
    if (ids.length) {
      toast(`${plural(ids.length, "gravado foi", "gravados foram")} para Editando`, {
        action: { label: "Desfazer", onClick: () => ids.forEach((id) => atualizar.mutate({ id, status: "gravando" })) },
      })
    }
    aoFechar()
  }

  const gravado = () => {
    if (!atual) return
    if (!gravados.current.includes(atual.id)) {
      gravados.current = [...gravados.current, atual.id]
      setFeitos(gravados.current)
      atualizar.mutate({ id: atual.id, status: "editando" })
    }
    setIndice((i) => i + 1)
  }

  return (
    <Janela
      aberta
      aoMudar={(v) => {
        if (!v) fechar()
      }}
      largura="xl"
      titulo="Sessão de gravação"
      descricao={acabou ? undefined : roteiros.length ? `${Math.min(indice + 1, roteiros.length)} de ${roteiros.length}` : undefined}
      rodape={
        acabou ? (
          <Botao variante="primario" onClick={fechar}>
            Fechar
          </Botao>
        ) : (
          <>
            <Botao variante="fantasma" className="mr-auto" disabled={indice === 0} onClick={() => setIndice((i) => Math.max(0, i - 1))}>
              <ChevronLeft /> Anterior
            </Botao>
            <Botao variante="contorno" disabled={!atual} onClick={() => setIndice((i) => i + 1)}>
              <SkipForward /> Pular
            </Botao>
            <Botao variante="primario" disabled={!atual} onClick={gravado}>
              <Check /> Gravado
            </Botao>
          </>
        )
      }
    >
      {isLoading ? (
        <Carregando linhas={5} />
      ) : acabou ? (
        <div className="grid justify-items-start gap-2 py-6">
          <span className="icone-aceso size-12" style={{ "--cor": "var(--b-verde)" } as React.CSSProperties} aria-hidden>
            <Clapperboard className="size-6" />
          </span>
          <p className="font-display text-2xl font-semibold">{feitos.length ? "Sessão concluída" : "Nada gravado desta vez"}</p>
          <p className="text-ink-2">
            {feitos.length
              ? `${plural(feitos.length, "conteúdo foi", "conteúdos foram")} para Editando. Ao fechar, dá para desfazer.`
              : "Os roteiros continuam em Gravando para a próxima sessão."}
          </p>
        </div>
      ) : atual ? (
        <article aria-labelledby="sessao-titulo">
          <ol className="mb-4 flex gap-1" aria-hidden>
            {roteiros.map((r, k) => (
              <li
                key={r.id}
                className={cn("h-1.5 flex-1 rounded-full", k === indice ? "bg-[var(--b-luz)]" : feitos.includes(r.id) ? "bg-[var(--b-verde)]" : "bg-surface-3")}
              />
            ))}
          </ol>
          <p className="rotulo-hud">{[atual.format, atual.publish_date ? `sai ${dataRelativa(atual.publish_date)}` : null].filter(Boolean).join(" · ") || "Gravando"}</p>
          <h3 id="sessao-titulo" className="mt-1.5 font-display text-2xl font-semibold leading-tight sm:text-3xl">
            {atual.title}
          </h3>
          {atual.script?.trim() ? (
            <div className="mt-4 text-[1.0625rem] leading-relaxed [&_.prosa]:text-[1.0625rem]">
              <Markdown texto={atual.script} className="[&>*:first-child]:mt-0" />
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--b-borda)] p-4 text-ink-2">
              Sem roteiro. Grave a partir do gancho: o título é a primeira frase, e o resto cabe em uma ideia só.
            </p>
          )}
        </article>
      ) : (
        <p className="py-6 text-ink-2">Esses conteúdos não estão mais disponíveis.</p>
      )}
    </Janela>
  )
}

/** Abre a sessão com os conteúdos de Gravando do momento (a lista não muda enquanto a sessão está aberta). */
export function SessaoGravacao({ ids, aoFechar }: { ids: string[] | null; aoFechar: () => void }) {
  if (!ids) return null
  return <Sessao ids={ids} aoFechar={aoFechar} />
}
