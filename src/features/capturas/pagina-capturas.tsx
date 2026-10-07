"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Archive, ArchiveRestore, ExternalLink, FolderKanban, Plus, Search } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Carregando, Etiqueta, Segmentos, Vazio } from "@/components/ui/basicos"
import { Seletor } from "@/components/ui/campos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo } from "@/components/ui/menu"
import { Markdown } from "@/components/markdown"
import { useAtualizar, useLista } from "@/lib/data"
import { supabase } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/database.types"
import { contem, dominio, haQuanto, urlValida } from "@/lib/utils"
import { DialogoCaptura } from "./dialogo-captura"

type Captura = Tables<"captures">
type Aba = "entrada" | "todas" | "arquivo"

export function PaginaCapturas() {
  const params = useSearchParams()
  const qc = useQueryClient()
  const [aba, setAba] = React.useState<Aba>("entrada")
  const [busca, setBusca] = React.useState("")
  const [tipo, setTipo] = React.useState("")
  const [categoria, setCategoria] = React.useState("")
  const [aberta, setAberta] = React.useState<Captura | null>(null)
  const [nova, setNova] = React.useState(false)
  const [expandida, setExpandida] = React.useState<string | null>(null)

  const { data: capturas = [], isLoading } = useLista("captures", { ordem: [{ coluna: "captured_at", asc: false }] })
  const { data: vinculos = [] } = useLista("capture_projects", { colunas: "capture_id,project_id" })
  const { data: projetos = [] } = useLista("projects", { colunas: "id,name,parent_id,archived,done", ordem: [{ coluna: "name" }] })
  const { data: areas = [] } = useLista("areas", { ordem: [{ coluna: "name" }] })
  const atualizar = useAtualizar("captures")

  React.useEffect(() => {
    const id = params.get("abrir")
    if (id) {
      const c = capturas.find((x) => x.id === id)
      if (c) setAberta(c)
    }
  }, [params, capturas])

  const projetosDe = React.useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const v of vinculos) mapa.set(v.capture_id, [...(mapa.get(v.capture_id) ?? []), v.project_id])
    return mapa
  }, [vinculos])
  const nomeProjeto = new Map(projetos.map((p) => [p.id, p.name]))
  const nomeArea = new Map(areas.map((a) => [a.id, a.name]))
  const ativos = projetos.filter((p) => !p.archived && !p.done && !p.parent_id)

  const naEntrada = (c: Captura) => !c.archived && !c.area_id && !projetosDe.has(c.id)
  const base = capturas.filter((c) => (aba === "entrada" ? naEntrada(c) : aba === "arquivo" ? c.archived : !c.archived))
  const lista = base.filter(
    (c) =>
      contem(`${c.title} ${c.content ?? ""} ${c.tags.join(" ")}`, busca) &&
      (!tipo || c.kind === tipo) &&
      (!categoria || c.category === categoria),
  )
  const tipos = [...new Set(capturas.map((c) => c.kind).filter(Boolean))] as string[]
  const categorias = [...new Set(capturas.map((c) => c.category).filter(Boolean))] as string[]

  const ligar = async (captura: string, projeto: string) => {
    await supabase().from("capture_projects").upsert({ capture_id: captura, project_id: projeto }, { onConflict: "capture_id,project_id", ignoreDuplicates: true })
    qc.invalidateQueries({ queryKey: ["capture_projects"] })
  }

  return (
    <div>
      <Cabecalho
        area="projetos"
        titulo="Capturas"
        descricao="Ideias, links, citações e anotações. O que não tem projeto nem área fica na caixa de entrada até você organizar."
        acoes={<Botao variante="primario" onClick={() => setNova(true)}><Plus /> Nova captura</Botao>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmentos
          rotulo="Capturas"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "entrada", rotulo: "Caixa de entrada", contagem: capturas.filter(naEntrada).length },
            { valor: "todas", rotulo: "Todas", contagem: capturas.filter((c) => !c.archived).length },
            { valor: "arquivo", rotulo: "Arquivo", contagem: capturas.filter((c) => c.archived).length },
          ]}
        />
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar" aria-label="Filtrar capturas" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-sm placeholder:text-ink-3 focus-visible:border-pen focus-visible:outline-none" />
        </div>
        {tipos.length > 1 ? (
          <Seletor aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-auto">
            <option value="">Todos os tipos</option>
            {tipos.map((t) => <option key={t}>{t}</option>)}
          </Seletor>
        ) : null}
        {categorias.length > 1 ? (
          <Seletor aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-auto max-w-60">
            <option value="">Todas as categorias</option>
            {categorias.map((t) => <option key={t}>{t}</option>)}
          </Seletor>
        ) : null}
      </div>

      {isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <Vazio
          titulo={aba === "entrada" && !busca ? "Caixa de entrada vazia." : "Nenhuma captura encontrada."}
          descricao={aba === "entrada" && !busca ? "Tudo organizado. Use a captura rápida da tela Hoje para anotar ideias." : undefined}
        />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {lista.map((c) => {
            const link = urlValida(c.url)
            const projetosC = projetosDe.get(c.id) ?? []
            const aberto = expandida === c.id
            return (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => setAberta(c)} className="min-w-0 flex-1 text-left">
                    <p className="font-medium leading-snug">{c.title || "Sem título"}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      {c.kind ? <span>{c.kind}</span> : null}
                      {c.category ? <span>{c.category}</span> : null}
                      <span>{haQuanto(c.captured_at)}</span>
                      {c.area_id ? <Etiqueta cor="projetos">{nomeArea.get(c.area_id)}</Etiqueta> : null}
                      {projetosC.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1"><FolderKanban className="size-3" />{nomeProjeto.get(p)}</span>
                      ))}
                      {c.tags.slice(0, 4).map((t) => <Etiqueta key={t}>{t}</Etiqueta>)}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2" title={link}>
                        <ExternalLink className="size-3.5" /> <span className="hidden sm:inline">{dominio(link)}</span>
                      </a>
                    ) : null}
                    {!c.archived ? (
                      <Menu>
                        <MenuGatilho asChild>
                          <Botao variante="fantasma" tamanho="sm">Organizar</Botao>
                        </MenuGatilho>
                        <MenuConteudo className="max-h-80 w-64 overflow-y-auto">
                          <MenuRotulo>Ligar a um projeto</MenuRotulo>
                          {ativos.length === 0 ? <MenuItem disabled>Nenhum projeto ativo</MenuItem> : null}
                          {ativos.map((p) => (
                            <MenuItem key={p.id} onSelect={() => ligar(c.id, p.id)}>{p.name}</MenuItem>
                          ))}
                          <MenuRotulo>Mover para a área</MenuRotulo>
                          {areas.map((a) => (
                            <MenuItem key={a.id} onSelect={() => atualizar.mutate({ id: c.id, area_id: a.id })}>{a.name}</MenuItem>
                          ))}
                          <MenuRotulo>Ou</MenuRotulo>
                          <MenuItem onSelect={() => atualizar.mutate({ id: c.id, archived: true })}><Archive /> Arquivar</MenuItem>
                        </MenuConteudo>
                      </Menu>
                    ) : (
                      <Botao variante="fantasma" tamanho="sm" onClick={() => atualizar.mutate({ id: c.id, archived: false })}>
                        <ArchiveRestore /> Restaurar
                      </Botao>
                    )}
                  </div>
                </div>
                {c.content ? (
                  <div className="mt-2">
                    {aberto ? (
                      <Markdown texto={c.content} className="text-sm" />
                    ) : (
                      <p className="line-clamp-2 text-sm text-ink-2">{c.content.replace(/[#*_`>\[\]]/g, "")}</p>
                    )}
                    {c.content.length > 160 ? (
                      <button type="button" onClick={() => setExpandida(aberto ? null : c.id)} className="mt-1 text-xs font-medium text-pen">
                        {aberto ? "Mostrar menos" : "Ler tudo"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <DialogoCaptura aberta={nova || Boolean(aberta)} aoMudar={(v) => { if (!v) { setNova(false); setAberta(null) } }} captura={aberta} />
    </div>
  )
}
