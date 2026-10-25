"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { Check, Minus, Plus } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Janela } from "@/components/ui/janela"
import { cn } from "@/lib/utils"
import { CapaEmPe } from "./capa"
import { useAtualizarProgresso, type Livro } from "./dados"
import { paginaValida, plural } from "./logica"

const SALTOS = [5, 10, 20, 50]

/**
 * "Onde você parou?": a página em números grandes, com − e +, saltos de 5 a 50 e a régua. Salva
 * a página, anota no diário e oferece desfazer. "Terminei" leva o livro para os lidos.
 */
export function JanelaProgresso({ livro, aberta, aoMudar }: { livro: Livro | null; aberta: boolean; aoMudar: (v: boolean) => void }) {
  const router = useRouter()
  const atualizar = useAtualizarProgresso()
  const [pagina, setPagina] = React.useState(0)
  const [texto, setTexto] = React.useState("0")
  const [total, setTotal] = React.useState("")

  React.useEffect(() => {
    if (!aberta || !livro) return
    setPagina(livro.pages_read ?? 0)
    setTexto(String(livro.pages_read ?? 0))
    setTotal(livro.pages_total ? String(livro.pages_total) : "")
  }, [aberta, livro])

  if (!livro) return null

  const totalNum = Number(total) > 0 ? Math.min(100_000, Math.round(Number(total))) : null
  const definir = (n: number) => {
    const v = paginaValida(n, totalNum)
    setPagina(v)
    setTexto(String(v))
  }
  const diferenca = pagina - (livro.pages_read ?? 0)
  const mudouTotal = (totalNum ?? null) !== (livro.pages_total ?? null)

  const salvar = (terminou?: boolean) => {
    const r = atualizar(livro, { pagina, terminou, ...(mudouTotal ? { total: totalNum } : {}) })
    aoMudar(false)
    if (r.terminou) {
      toast.success(`“${livro.title}” foi para os lidos.`, {
        description: "Que tal dar uma nota?",
        action: { label: "Dar nota", onClick: () => router.push(`/estudos/leitura/${livro.id}`) },
        cancel: { label: "Desfazer", onClick: r.desfazer },
        duration: 9000,
      })
    } else if (r.paginas !== 0) {
      toast(r.paginas > 0 ? `+${plural(r.paginas, "página")} em “${livro.title}”` : `Voltou para a página ${pagina}`, {
        action: { label: "Desfazer", onClick: r.desfazer },
      })
    }
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Onde você parou?"
      largura="sm"
      className="tema-biblioteca"
      rodape={
        <>
          <Botao variante="fantasma" className="mr-auto" onClick={() => salvar(true)}>
            <Check /> Terminei
          </Botao>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={() => salvar()} disabled={!mudouTotal && diferenca === 0}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="flex items-center gap-3">
          <CapaEmPe livro={livro} className="w-11 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium leading-snug">{livro.title}</p>
            {livro.author ? <p className="truncate text-sm text-ink-2">{livro.author}</p> : null}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <BotaoPasso rotulo="Uma página a menos" onClick={() => definir(pagina - 1)} disabled={pagina <= 0}>
            <Minus />
          </BotaoPasso>
          <label className="grid w-36 justify-items-center">
            <span className="sr-only">Página em que você está</span>
            <input
              inputMode="numeric"
              enterKeyHint="done"
              value={texto}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const digitos = e.target.value.replace(/\D/g, "").slice(0, 6)
                setTexto(digitos)
                if (digitos) setPagina(paginaValida(Number(digitos), totalNum))
              }}
              onBlur={() => setTexto(String(pagina))}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              className="tabular w-full rounded-xl bg-transparent text-center font-display text-5xl font-semibold leading-none text-ink outline-none focus-visible:bg-white/[0.06]"
            />
            <span className="rotulo-hud mt-2">{totalNum ? `de ${totalNum} páginas` : "página"}</span>
          </label>
          <BotaoPasso rotulo="Uma página a mais" onClick={() => definir(pagina + 1)} disabled={totalNum !== null && pagina >= totalNum}>
            <Plus />
          </BotaoPasso>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {SALTOS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => definir(pagina + s)}
              disabled={totalNum !== null && pagina >= totalNum}
              className="tabular min-h-10 rounded-full border border-line-strong px-4 text-sm font-medium text-ink-2 transition-colors hover:border-pen hover:text-ink disabled:opacity-40 toque:min-h-11"
            >
              +{s}
            </button>
          ))}
        </div>

        {totalNum ? (
          <input
            type="range"
            min={0}
            max={totalNum}
            value={pagina}
            aria-label="Página"
            onChange={(e) => definir(Number(e.target.value))}
            className="h-6 w-full cursor-pointer accent-[var(--b-luz)]"
          />
        ) : null}

        <p aria-live="polite" className={cn("min-h-5 text-center text-sm", diferenca > 0 ? "text-pen" : "text-ink-3")}>
          {diferenca > 0 ? `+${plural(diferenca, "página")} hoje` : diferenca < 0 ? `Volta ${plural(-diferenca, "página")}` : " "}
        </p>

        <label className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm text-ink-2">
          Total de páginas do livro
          <input
            inputMode="numeric"
            value={total}
            placeholder="—"
            onChange={(e) => setTotal(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="tabular h-10 w-24 rounded-md border border-line-strong bg-surface px-2 text-center text-ink focus-visible:border-pen focus-visible:outline-none toque:h-11 toque:text-[16px]"
          />
        </label>
      </div>
    </Janela>
  )
}

function BotaoPasso({ rotulo, onClick, disabled, children }: { rotulo: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      disabled={disabled}
      className="grid size-14 shrink-0 place-items-center rounded-full border border-line-strong text-ink transition-[transform,border-color] active:scale-95 hover:border-pen disabled:opacity-35 [&_svg]:size-5"
    >
      {children}
    </button>
  )
}
