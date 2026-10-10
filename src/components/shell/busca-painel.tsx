"use client"

import { Command } from "cmdk"
import { Dialog } from "radix-ui"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  CalendarDays,
  FileText,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Inbox,
  Layers,
  Lightbulb,
  ListTodo,
  Clapperboard,
  Search,
} from "lucide-react"
import * as React from "react"
import { supabase } from "@/lib/supabase/client"
import { EXTRAS, GRUPOS, HOJE } from "@/lib/navegacao"

type Resultado = { kind: string; id: string; title: string; snippet: string; rank: number }

const TIPOS: Record<string, { rotulo: string; icone: typeof Search; href: (id: string) => string }> = {
  pagina: { rotulo: "Páginas", icone: FileText, href: (id) => `/paginas/${id}` },
  projeto: { rotulo: "Projetos", icone: FolderKanban, href: (id) => `/projetos/${id}` },
  tarefa: { rotulo: "Tarefas", icone: ListTodo, href: (id) => `/rotina/tarefas?abrir=${id}` },
  captura: { rotulo: "Capturas", icone: Inbox, href: (id) => `/projetos/capturas?abrir=${id}` },
  livro: { rotulo: "Livros", icone: BookOpen, href: (id) => `/estudos/leitura/${id}` },
  curso: { rotulo: "Cursos", icone: GraduationCap, href: (id) => `/estudos/cursos?abrir=${id}` },
  conteudo: { rotulo: "Conteúdos", icone: Clapperboard, href: (id) => `/conteudo/planner?abrir=${id}` },
  insight: { rotulo: "Insights", icone: Lightbulb, href: () => `/estudos/leitura?aba=insights` },
  experimento: { rotulo: "Experimentos", icone: FlaskConical, href: (id) => `/estudos/laboratorio?abrir=${id}` },
  item: { rotulo: "Coleções", icone: Layers, href: (id) => `/colecoes/item/${id}` },
  evento: { rotulo: "Agenda", icone: CalendarDays, href: (id) => `/rotina/agenda?abrir=${id}` },
}

function useAtraso<T>(valor: T, ms = 220): T {
  const [v, setV] = React.useState(valor)
  React.useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}

/** A janela de busca. Quem decide abrir é o componente leve em ./busca. */
export function PainelBusca({ aberta, aoMudar: setAberta }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const router = useRouter()
  const [texto, setTexto] = React.useState("")
  const termo = useAtraso(texto.trim())

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["busca", termo],
    enabled: aberta && termo.length >= 2,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase().rpc("search_all", { q: termo, max_results: 40 })
      if (error) throw new Error(error.message)
      return (data ?? []) as Resultado[]
    },
  })

  const ir = (href: string) => {
    setAberta(false)
    setTexto("")
    router.push(href)
  }

  const grupos = React.useMemo(() => {
    const mapa = new Map<string, Resultado[]>()
    for (const r of resultados) {
      if (!TIPOS[r.kind]) continue
      mapa.set(r.kind, [...(mapa.get(r.kind) ?? []), r])
    }
    return [...mapa.entries()]
  }, [resultados])

  const atalhos = [HOJE, ...GRUPOS.flatMap((g) => g.itens), ...EXTRAS]

  return (
    <Dialog.Root open={aberta} onOpenChange={setAberta}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] dark:bg-black/50" />
        <Dialog.Content className="fixed inset-x-3 top-[10vh] z-50 mx-auto max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-overlay outline-none">
          <Dialog.Title className="sr-only">Buscar</Dialog.Title>
          <Dialog.Description className="sr-only">Busque páginas, tarefas, projetos e mais.</Dialog.Description>
          <Command shouldFilter={false} label="Buscar" className="flex max-h-[70vh] flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-ink-3" />
              <Command.Input
                value={texto}
                onValueChange={setTexto}
                placeholder="Buscar em tudo ou ir para uma página…"
                className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
              />
              {isFetching ? <span className="text-xs text-ink-3">Buscando…</span> : null}
            </div>
            <Command.List className="overflow-y-auto p-2 scrollbar-thin">
              {termo.length >= 2 && !isFetching && grupos.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-3">Nada encontrado para “{termo}”.</p>
              ) : null}

              {grupos.map(([tipo, itens]) => {
                const info = TIPOS[tipo]
                const Icone = info.icone
                return (
                  <Command.Group
                    key={tipo}
                    heading={info.rotulo}
                    className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-3"
                  >
                    {itens.map((r) => (
                      <Command.Item
                        key={`${tipo}-${r.id}`}
                        value={`${tipo}-${r.id}`}
                        onSelect={() => ir(info.href(r.id))}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-surface-2"
                      >
                        <Icone className="mt-0.5 size-4 shrink-0 text-ink-3" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.title || "Sem título"}</span>
                          {r.snippet ? <span className="block truncate text-xs text-ink-3">{r.snippet}</span> : null}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )
              })}

              {termo.length < 2 ? (
                <Command.Group
                  heading="Ir para"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-3"
                >
                  {atalhos
                    .filter((a) => !texto || a.rotulo.toLowerCase().includes(texto.toLowerCase()))
                    .map((a) => (
                      <Command.Item
                        key={a.href}
                        value={a.href}
                        onSelect={() => ir(a.href)}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-surface-2"
                      >
                        <a.icone className="size-4 text-ink-3" />
                        {a.rotulo}
                      </Command.Item>
                    ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
