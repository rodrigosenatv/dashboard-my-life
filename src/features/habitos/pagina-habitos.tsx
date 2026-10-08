"use client"

import * as React from "react"
import { addDays, format, startOfWeek } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Check, ChevronLeft, ChevronRight, Ellipsis, Plus } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada, AreaTexto, Seletor } from "@/components/ui/campos"
import { Janela, Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { novoId, useAtualizar, useCriar, useExcluir } from "@/lib/data"
import { cn, isoDia, somarDias } from "@/lib/utils"
import {
  indexar,
  melhorSequencia,
  sequencia,
  taxa,
  useAlternarHabito,
  useHabitos,
  useRegistros,
  valeNoDia,
  agruparPorRitual,
  useRituais,
  RITUAIS,
  type Habito,
  type Ritual,
} from "./dados"

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"]
const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

function DialogoHabito({ aberta, aoMudar, habito }: { aberta: boolean; aoMudar: (v: boolean) => void; habito?: Habito | null }) {
  const criar = useCriar("habits")
  const atualizar = useAtualizar("habits")
  const [nome, setNome] = React.useState("")
  const [icone, setIcone] = React.useState("")
  const [dias, setDias] = React.useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [descricao, setDescricao] = React.useState("")
  const { ritualDe, definir } = useRituais()
  const [ritual, setRitual] = React.useState<Ritual>("livre")

  React.useEffect(() => {
    if (!aberta) return
    setNome(habito?.name ?? "")
    setIcone(habito?.icon ?? "")
    setDias(habito?.weekdays?.length ? habito.weekdays : [0, 1, 2, 3, 4, 5, 6])
    setDescricao(habito?.description ?? "")
    setRitual(habito ? ritualDe(habito) : "manha")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, habito])

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || dias.length === 0) return
    const campos = { name: nome.trim(), icon: icone.trim() || null, weekdays: [...dias].sort(), description: descricao.trim() || null }
    const id = habito?.id ?? novoId()
    if (habito) atualizar.mutate({ id, ...campos })
    else criar.mutate({ id, position: Date.now() % 1_000_000, ...campos })
    if (!habito || ritualDe(habito) !== ritual) definir(id, ritual)
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={habito ? "Editar hábito" : "Novo hábito"}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-habito" disabled={!nome.trim() || !dias.length}>
            {habito ? "Salvar" : "Criar hábito"}
          </Botao>
        </>
      }
    >
      <form id="form-habito" onSubmit={salvar} className="grid gap-4">
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Campo rotulo="Nome" htmlFor="h-nome">
            <Entrada id="h-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Devocional" />
          </Campo>
          <Campo rotulo="Símbolo" htmlFor="h-icone" dica="Letra ou emoji">
            <Entrada id="h-icone" maxLength={2} value={icone} onChange={(e) => setIcone(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Ritual" htmlFor="h-ritual">
          <Seletor id="h-ritual" value={ritual} onChange={(e) => setRitual(e.target.value as Ritual)}>
            {RITUAIS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.emoji ? `${r.emoji} ` : ""}
                {r.titulo}
              </option>
            ))}
          </Seletor>
        </Campo>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Em quais dias</legend>
          <div className="flex gap-1.5">
            {DIAS.map((d, i) => {
              const sel = dias.includes(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={sel}
                  aria-label={NOMES_DIAS[i]}
                  onClick={() => setDias((a) => (a.includes(i) ? a.filter((x) => x !== i) : [...a, i]))}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border text-sm font-medium",
                    sel ? "border-rotina bg-rotina text-white" : "border-line-strong text-ink-2",
                  )}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </fieldset>
        <Campo rotulo="Por que este hábito" htmlFor="h-desc">
          <AreaTexto id="h-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Opcional" />
        </Campo>
      </form>
    </Janela>
  )
}

/** Mapa de calor das últimas semanas: quanto dos hábitos do dia foi cumprido. */
function MapaCalor({ habitos, indice, hoje }: { habitos: Habito[]; indice: ReturnType<typeof indexar>; hoje: string }) {
  const semanas = 18
  const inicio = startOfWeek(addDays(new Date(), -7 * (semanas - 1)), { weekStartsOn: 0 })
  const colunas: { iso: string; pct: number | null; feitos: number; total: number }[][] = []
  for (let s = 0; s < semanas; s++) {
    const col = []
    for (let d = 0; d < 7; d++) {
      const iso = isoDia(addDays(inicio, s * 7 + d))
      if (iso > hoje) {
        col.push({ iso, pct: null, feitos: 0, total: 0 })
        continue
      }
      const validos = habitos.filter((h) => valeNoDia(h, iso))
      const feitos = validos.filter((h) => indice.get(h.id)?.has(iso)).length
      col.push({ iso, pct: validos.length ? feitos / validos.length : null, feitos, total: validos.length })
    }
    colunas.push(col)
  }
  const nivel = (p: number | null) =>
    p === null ? "bg-transparent" : p === 0 ? "bg-surface-3" : p < 0.34 ? "bg-rotina/30" : p < 0.67 ? "bg-rotina/55" : p < 1 ? "bg-rotina/80" : "bg-rotina"

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]" role="img" aria-label={`Cumprimento diário dos hábitos nas últimas ${semanas} semanas`}>
        <div className="mr-1 grid grid-rows-7 gap-[3px] text-[10px] text-ink-3">
          {DIAS.map((d, i) => (
            <span key={i} className="flex h-3.5 items-center">{i % 2 ? d : ""}</span>
          ))}
        </div>
        {colunas.map((col, i) => (
          <div key={i} className="grid grid-rows-7 gap-[3px]">
            {col.map((c) => (
              <span
                key={c.iso}
                title={c.pct === null ? undefined : `${format(new Date(c.iso + "T12:00"), "d 'de' MMM", { locale: ptBR })}: ${c.feitos} de ${c.total}`}
                className={cn("size-3.5 rounded-[3px]", nivel(c.pct))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        Menos
        {[0, 0.2, 0.5, 0.8, 1].map((p) => (
          <span key={p} className={cn("size-3 rounded-[3px]", nivel(p))} />
        ))}
        Mais
      </div>
    </div>
  )
}

export function PaginaHabitos() {
  const hoje = isoDia()
  const [semana, setSemana] = React.useState(0)
  const [editar, setEditar] = React.useState<Habito | null>(null)
  const [novo, setNovo] = React.useState(false)
  const [apagar, setApagar] = React.useState<Habito | null>(null)
  const { data: habitos = [], isLoading } = useHabitos()
  const { data: registros = [] } = useRegistros(somarDias(hoje, -400))
  const alternar = useAlternarHabito()
  const atualizar = useAtualizar("habits")
  const excluir = useExcluir("habits")

  const indice = React.useMemo(() => indexar(registros), [registros])
  const { ritualDe, definir } = useRituais()
  const ativos = habitos.filter((h) => h.active)
  const grupos = agruparPorRitual(ativos, ritualDe)
  const inativos = habitos.filter((h) => !h.active)

  const inicioSemana = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), semana * 7)
  const dias = Array.from({ length: 7 }, (_, i) => isoDia(addDays(inicioSemana, i)))
  const inicio30 = somarDias(hoje, -29)

  return (
    <div>
      <Cabecalho
        area="rotina"
        titulo="Hábitos"
        descricao="Marque o que fez em cada dia. A sequência conta só os dias em que o hábito vale."
        acoes={
          <Botao variante="primario" onClick={() => setNovo(true)}>
            <Plus /> Novo hábito
          </Botao>
        }
      />

      {isLoading ? (
        <Carregando />
      ) : ativos.length === 0 ? (
        <Vazio titulo="Nenhum hábito ativo." descricao="Crie o primeiro hábito para começar a marcar." acao={<Botao variante="primario" onClick={() => setNovo(true)}>Criar hábito</Botao>} />
      ) : (
        <>
          <Secao
            titulo="Semana"
            className="mb-10"
            acao={
              <div className="flex items-center gap-1">
                <Botao variante="fantasma" tamanho="icone-sm" aria-label="Semana anterior" onClick={() => setSemana((s) => s - 1)}>
                  <ChevronLeft />
                </Botao>
                <button type="button" onClick={() => setSemana(0)} className="min-w-28 text-center text-sm text-ink-2 hover:text-ink">
                  {semana === 0 ? "Esta semana" : `${format(inicioSemana, "d MMM", { locale: ptBR })} a ${format(addDays(inicioSemana, 6), "d MMM", { locale: ptBR })}`}
                </button>
                <Botao variante="fantasma" tamanho="icone-sm" aria-label="Próxima semana" disabled={semana >= 0} onClick={() => setSemana((s) => s + 1)}>
                  <ChevronRight />
                </Botao>
              </div>
            }
          >
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-3">
                    <th className="px-4 py-2.5 text-left font-medium">Hábito</th>
                    {dias.map((d) => (
                      <th key={d} className={cn("w-12 py-2.5 text-center font-medium", d === hoje && "text-ink")}>
                        <span className="block text-xs first-letter:uppercase">{format(new Date(d + "T12:00"), "EEEEEE", { locale: ptBR })}</span>
                        <span className="tabular">{d.slice(8)}</span>
                      </th>
                    ))}
                    <th className="w-24 px-3 py-2.5 text-right font-medium">Sequência</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                {grupos.map((g) => (
                  <tbody key={g.valor}>
                    {grupos.length > 1 ? (
                      <tr className="border-b border-line bg-surface-2/60">
                        <th colSpan={10} scope="colgroup" className="px-4 py-1.5 text-left text-xs font-semibold text-ink-2">
                          {g.emoji ? <span aria-hidden className="mr-1.5">{g.emoji}</span> : null}
                          {g.titulo}
                        </th>
                      </tr>
                    ) : null}
                    {g.habitos.map((h) => {
                    const mapa = indice.get(h.id)
                    const seq = sequencia(h, mapa, hoje)
                    return (
                      <tr key={h.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2">
                          <span className="font-medium">{h.name}</span>
                          <span className="block text-xs text-ink-3">{taxa(h, mapa, inicio30, hoje)}% nos últimos 30 dias</span>
                        </td>
                        {dias.map((d) => {
                          const registro = mapa?.get(d)
                          const vale = valeNoDia(h, d)
                          const futuro = d > hoje
                          return (
                            <td key={d} className="py-2 text-center">
                              <button
                                type="button"
                                disabled={futuro}
                                aria-pressed={Boolean(registro)}
                                aria-label={`${h.name} em ${d}`}
                                onClick={() => alternar.mutate({ habito: h.id, dia: d, registro })}
                                className={cn(
                                  "mx-auto grid size-8 place-items-center rounded-full border transition-colors disabled:opacity-30",
                                  registro
                                    ? "border-rotina bg-rotina text-white"
                                    : vale
                                      ? "border-line-strong hover:border-rotina"
                                      : "border-dashed border-line text-ink-3",
                                )}
                              >
                                {registro ? <Check className="size-4" strokeWidth={2.5} /> : null}
                              </button>
                            </td>
                          )
                        })}
                        <td className="tabular px-3 py-2 text-right">
                          <span className="font-medium">{seq}</span>
                          <span className="text-ink-3"> / {melhorSequencia(h, mapa)}</span>
                        </td>
                        <td className="pr-2">
                          <Menu>
                            <MenuGatilho className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2" aria-label={`Opções de ${h.name}`}>
                              <Ellipsis className="size-4" />
                            </MenuGatilho>
                            <MenuConteudo>
                              <MenuItem onSelect={() => setEditar(h)}>Editar</MenuItem>
                              {RITUAIS.filter((r) => r.valor !== ritualDe(h)).map((r) => (
                                <MenuItem key={r.valor} onSelect={() => definir(h.id, r.valor)}>
                                  Mover para {r.titulo}
                                </MenuItem>
                              ))}
                              <MenuItem onSelect={() => atualizar.mutate({ id: h.id, active: false })}>Pausar</MenuItem>
                              <MenuSeparador />
                              <MenuItem perigo onSelect={() => setApagar(h)}>Excluir</MenuItem>
                            </MenuConteudo>
                          </Menu>
                        </td>
                      </tr>
                    )
                  })}
                  </tbody>
                ))}
                <tfoot>
                  <tr className="border-t border-line-strong">
                    <td className="px-4 py-2.5 text-sm font-medium">Progresso do dia</td>
                    {dias.map((d) => {
                      const validos = ativos.filter((h) => valeNoDia(h, d))
                      const feitos = validos.filter((h) => indice.get(h.id)?.has(d)).length
                      const pct = validos.length ? Math.round((feitos / validos.length) * 100) : 0
                      return (
                        <td key={d} className={cn("tabular py-2.5 text-center text-xs", d > hoje ? "text-ink-3/50" : pct >= 100 ? "font-semibold text-rotina" : "text-ink-2")}>
                          {d > hoje ? "–" : `${pct}%`}
                        </td>
                      )
                    })}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-3">Sequência atual / melhor sequência. Círculo tracejado: dia em que o hábito não vale.</p>
          </Secao>

          <Secao titulo="Últimas semanas" className="mb-10">
            <MapaCalor habitos={ativos} indice={indice} hoje={hoje} />
          </Secao>
        </>
      )}

      {inativos.length ? (
        <Secao titulo="Pausados">
          <ul className="flex flex-wrap gap-2">
            {inativos.map((h) => (
              <li key={h.id} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-sm text-ink-2">
                {h.name}
                <button type="button" onClick={() => atualizar.mutate({ id: h.id, active: true })} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-surface-3">
                  Retomar
                </button>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <DialogoHabito aberta={novo || Boolean(editar)} aoMudar={(v) => { if (!v) { setNovo(false); setEditar(null) } }} habito={editar} />
      <Confirmar
        aberta={Boolean(apagar)}
        aoMudar={(v) => !v && setApagar(null)}
        titulo={`Excluir “${apagar?.name ?? ""}”?`}
        descricao="Todo o histórico de marcações deste hábito também será apagado. Para guardar o histórico, use Pausar."
        aoConfirmar={() => apagar && excluir.mutate(apagar.id)}
      />
    </div>
  )
}
