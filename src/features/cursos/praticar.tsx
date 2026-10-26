"use client"

import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import * as React from "react"
import { ListChecks, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Marcador } from "@/components/ui/basicos"
import { cn } from "@/lib/utils"
import { useDesfazerNotas, useMudarNotas } from "./dados"
import { adicionarPraticas, marcarPratica, plural, removerPratica, type Curso, type Pratica } from "./logica"

/** Marca uma ação como feita (ou não), com "Desfazer". */
function useMarcar() {
  const mudar = useMudarNotas()
  const desfazer = useDesfazerNotas()
  return React.useCallback(
    (curso: Curso, p: Pratica, feito: boolean) => {
      const m = mudar(curso, (t) => marcarPratica(t, p.linha, feito))
      if (!m) {
        toast.error("Essa ação mudou de lugar nas anotações. Abra o curso e tente de novo.")
        return
      }
      if (feito) toast.success("Ação feita. Isso é aprender de verdade.", { action: { label: "Desfazer", onClick: () => desfazer(curso, m) } })
    },
    [mudar, desfazer],
  )
}

/** As ações por fazer dos cursos em andamento, na tela de cursos. */
export function PainelPraticar({ itens, className }: { itens: { curso: Curso; pratica: Pratica }[]; className?: string }) {
  const marcar = useMarcar()
  const [todas, setTodas] = React.useState(false)
  const visiveis = todas ? itens : itens.slice(0, 6)
  return (
    <section aria-labelledby="titulo-praticar" className={cn("vidro p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-praticar" className="rotulo-hud flex items-center gap-2">
          <ListChecks className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Para praticar
        </h2>
        {itens.length ? <span className="tabular text-xs text-ink-3">{plural(itens.length, "ação", "ações")}</span> : null}
      </div>
      {itens.length ? (
        <>
          <ul className="mt-3 grid gap-1 md:grid-cols-2 md:gap-x-8">
            {visiveis.map(({ curso, pratica }) => (
              <li key={`${curso.id}:${pratica.linha}`} className="flex items-start gap-3 rounded-lg px-1 py-1.5">
                <span className="pt-0.5">
                  <Marcador marcado={false} aoMudar={() => marcar(curso, pratica, true)} rotulo={`Marcar como feita: ${pratica.texto}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-snug text-ink">{pratica.texto}</span>
                  <Link href={`/estudos/cursos/${curso.id}`} className="mt-0.5 block truncate text-xs text-ink-3 hover:text-[var(--b-luz)]">
                    {curso.name}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          {itens.length > 6 ? (
            <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 min-h-10 rounded-full px-2 text-sm font-medium text-[var(--b-luz)] hover:bg-white/[0.06]">
              {todas ? "Mostrar menos" : `Ver todas (${itens.length})`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-2">
          Nada pendente. Ao anotar uma aula, escreva o que vai colocar em prática: as ações aparecem aqui.
        </p>
      )}
    </section>
  )
}

/** As ações de um curso: marcar, tirar e acrescentar (na tela do curso). */
export function ListaPraticas({ curso, praticas }: { curso: Curso; praticas: Pratica[] }) {
  const marcar = useMarcar()
  const mudar = useMudarNotas()
  const desfazer = useDesfazerNotas()
  const [nova, setNova] = React.useState("")
  const feitas = praticas.filter((p) => p.feito).length

  const acrescentar = (e: React.FormEvent) => {
    e.preventDefault()
    const texto = nova.trim()
    if (!texto) return
    mudar(curso, (t) => adicionarPraticas(t, [texto]))
    setNova("")
  }

  return (
    <section aria-labelledby="titulo-acoes" className="vidro p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-acoes" className="rotulo-hud flex items-center gap-2">
          <ListChecks className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Para praticar
        </h2>
        {praticas.length ? (
          <span className="tabular text-xs text-ink-3">
            {feitas} de {praticas.length}
          </span>
        ) : null}
      </div>
      {praticas.length ? (
        <div className="barra-luz mt-3" aria-hidden>
          <span style={{ width: `${(feitas / praticas.length) * 100}%` }} />
        </div>
      ) : null}
      <ul className="mt-3 grid gap-0.5">
        {praticas.map((p) => (
          <li key={p.linha} className="group flex items-start gap-3 rounded-lg px-1 py-1.5">
            <span className="pt-0.5">
              <Marcador marcado={p.feito} aoMudar={(v) => marcar(curso, p, v)} rotulo={p.feito ? `Desmarcar: ${p.texto}` : `Marcar como feita: ${p.texto}`} />
            </span>
            <span className={cn("min-w-0 flex-1 text-sm leading-snug", p.feito ? "text-ink-3 line-through decoration-white/30" : "text-ink")}>{p.texto}</span>
            <button
              type="button"
              aria-label={`Tirar: ${p.texto}`}
              onClick={() => {
                const m = mudar(curso, (t) => removerPratica(t, p.linha))
                if (m) toast("Ação tirada.", { action: { label: "Desfazer", onClick: () => desfazer(curso, m) } })
              }}
              className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 opacity-100 hover:bg-white/[0.06] hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {!praticas.length ? <p className="mt-1 text-sm text-ink-2">O que deste curso você vai colocar em prática?</p> : null}
      <form onSubmit={acrescentar} className="mt-3 flex items-center gap-2">
        <input
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          placeholder="Uma ação para praticar"
          aria-label="Nova ação para praticar"
          className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--b-borda)] bg-white/[0.04] px-3 text-[16px] text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm toque:h-11"
        />
        <button
          type="submit"
          aria-label="Acrescentar ação"
          disabled={!nova.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--b-borda-2)] text-[var(--b-luz)] hover:bg-white/[0.06] disabled:opacity-40 toque:size-11"
        >
          <Plus className="size-4" />
        </button>
      </form>
    </section>
  )
}
