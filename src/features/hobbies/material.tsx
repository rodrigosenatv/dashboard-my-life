"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Ellipsis, FileText, FolderInput, Plus, Trash2, Unlink } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Etiqueta, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Confirmar, Janela } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuRotulo, MenuSeparador } from "@/components/ui/menu"
import { novoId, useCriar, useExcluir } from "@/lib/data"
import { cn, plural } from "@/lib/utils"
import { contarDescendentes, type PaginaResumo } from "@/features/paginas/dados"
import { lerIds, useGravarHobbies, type Hobby } from "./dados"

const tituloDe = (p: PaginaResumo) => p.title.trim() || "Sem título"

/** Mover uma página entre hobbies e excluir, mantendo as listas de páginas dos hobbies em dia. */
function useAcoesPaginas(hobbies: Hobby[]) {
  const gravar = useGravarHobbies()
  const excluirPagina = useExcluir("pages")

  const tirarDeTodos = (id: string) => {
    for (const h of hobbies) {
      if (!h.paginas.includes(id)) continue
      void gravar.mudarProps(h.item, (props) => void (props._paginas = lerIds(props._paginas).filter((x) => x !== id)), "hobbies")
    }
  }

  const mover = (pagina: PaginaResumo, destino: string | null) => {
    tirarDeTodos(pagina.id)
    const hobby = hobbies.find((h) => h.id === destino)
    if (hobby) {
      void gravar.mudarProps(
        hobby.item,
        (props) => {
          const ids = lerIds(props._paginas)
          if (!ids.includes(pagina.id)) props._paginas = [...ids, pagina.id]
        },
        "hobbies",
      )
      toast.success(`“${tituloDe(pagina)}” agora está em ${hobby.nome}`)
    } else {
      toast.success(`“${tituloDe(pagina)}” saiu do hobby`)
    }
  }

  const excluir = (pagina: PaginaResumo) => {
    excluirPagina.mutate(pagina.id)
    tirarDeTodos(pagina.id)
    toast.success(`“${tituloDe(pagina)}” excluída`)
  }

  return { mover, excluir }
}

function IconeDaPagina({ pagina }: { pagina: PaginaResumo }) {
  return pagina.icon && !pagina.icon.startsWith("/") && pagina.icon.length <= 4 ? (
    <span aria-hidden className="w-5 shrink-0 text-center">
      {pagina.icon}
    </span>
  ) : (
    <FileText aria-hidden className="size-4 shrink-0 text-ink-3" />
  )
}

/**
 * As páginas de uma lista (de um hobby ou as que ainda não estão em nenhum): abrir, mover para
 * outro hobby, tirar do hobby e excluir (com pergunta antes).
 */
export function ListaDePaginas({
  paginas,
  todas,
  hobbies,
  atual,
  emBranco,
}: {
  paginas: PaginaResumo[]
  /** Todas as páginas do app (para contar as subpáginas). */
  todas: PaginaResumo[]
  hobbies: Hobby[]
  /** O hobby em que estas páginas estão; null quando não estão em nenhum. */
  atual: string | null
  emBranco: ReadonlySet<string>
}) {
  const router = useRouter()
  const { mover, excluir } = useAcoesPaginas(hobbies)
  const [apagar, setApagar] = React.useState<PaginaResumo | null>(null)
  const outros = hobbies.filter((h) => h.id !== atual)
  const subpaginas = React.useMemo(() => new Map(paginas.map((p) => [p.id, contarDescendentes(todas, p.id)])), [paginas, todas])
  const filhasDaApagar = apagar ? (subpaginas.get(apagar.id) ?? 0) : 0

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {paginas.map((p) => {
          const filhas = subpaginas.get(p.id) ?? 0
          return (
            <li key={p.id} className="flex items-center pr-1.5">
              <Link href={`/paginas/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3 transition-colors hover:bg-surface-2 toque:min-h-12">
                <IconeDaPagina pagina={p} />
                <span className="min-w-0 truncate font-medium">{tituloDe(p)}</span>
                {emBranco.has(p.id) ? <Etiqueta className="shrink-0">Em branco</Etiqueta> : null}
                {filhas ? <span className="ml-auto shrink-0 pl-2 text-xs text-ink-3">{plural(filhas, "subpágina")}</span> : null}
              </Link>
              <Menu>
                <MenuGatilho asChild>
                  <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Mais opções de ${tituloDe(p)}`}>
                    <Ellipsis />
                  </Botao>
                </MenuGatilho>
                <MenuConteudo className="max-h-80 w-60 overflow-y-auto">
                  <MenuItem onSelect={() => router.push(`/paginas/${p.id}`)}>
                    <FileText /> Abrir
                  </MenuItem>
                  {outros.length ? (
                    <>
                      <MenuSeparador />
                      <MenuRotulo>{atual ? "Mover para" : "Colocar em"}</MenuRotulo>
                      {outros.map((h) => (
                        <MenuItem key={h.id} onSelect={() => mover(p, h.id)}>
                          <FolderInput /> <span className="min-w-0 truncate">{h.nome}</span>
                        </MenuItem>
                      ))}
                    </>
                  ) : null}
                  {atual ? (
                    <MenuItem onSelect={() => mover(p, null)}>
                      <Unlink /> Tirar do hobby
                    </MenuItem>
                  ) : null}
                  <MenuSeparador />
                  <MenuItem perigo onSelect={() => setApagar(p)}>
                    <Trash2 /> Excluir página
                  </MenuItem>
                </MenuConteudo>
              </Menu>
            </li>
          )
        })}
      </ul>
      <Confirmar
        aberta={Boolean(apagar)}
        aoMudar={(v) => !v && setApagar(null)}
        titulo={apagar ? `Excluir “${tituloDe(apagar)}”?` : "Excluir página?"}
        descricao={filhasDaApagar ? `${plural(filhasDaApagar, "subpágina")} também ${filhasDaApagar === 1 ? "sai" : "saem"}.` : undefined}
        aoConfirmar={() => apagar && excluir(apagar)}
      />
    </>
  )
}

/** A aba Material de um hobby: as páginas de estudo dele, uma página nova e as que ainda estão sem hobby. */
export function MaterialHobby({
  hobby,
  hobbies,
  todas,
  paginasDoHobby,
  soltas,
  emBranco,
  paginaHobbies,
}: {
  hobby: Hobby
  hobbies: Hobby[]
  todas: PaginaResumo[]
  paginasDoHobby: PaginaResumo[]
  /** Páginas de Hobbies que não estão em nenhum hobby. */
  soltas: PaginaResumo[]
  emBranco: ReadonlySet<string>
  /** A página "Hobbies" do Notion, onde as páginas novas ficam. */
  paginaHobbies: PaginaResumo | null
}) {
  const [nova, setNova] = React.useState(false)
  const [existentes, setExistentes] = React.useState(false)

  const botoes = (
    <div className="flex flex-wrap gap-2">
      <Botao variante="contorno" onClick={() => setNova(true)}>
        <Plus /> Nova página
      </Botao>
      {soltas.length ? (
        <Botao variante="fantasma" onClick={() => setExistentes(true)}>
          <FolderInput /> Adicionar existente
        </Botao>
      ) : null}
    </div>
  )

  return (
    <div className="grid gap-4">
      {paginasDoHobby.length ? (
        <>
          <p className="text-sm text-ink-2">Anotações, exercícios e tudo que você estuda sobre {hobby.nome}.</p>
          <ListaDePaginas paginas={paginasDoHobby} todas={todas} hobbies={hobbies} atual={hobby.id} emBranco={emBranco} />
          {botoes}
        </>
      ) : (
        <Vazio
          icone={<FileText />}
          titulo="Nenhuma página de estudo neste hobby."
          descricao="Guarde aqui anotações, exercícios e referências."
          acao={botoes}
        />
      )}
      <NovaPagina aberta={nova} aoMudar={setNova} hobby={hobby} paginaHobbies={paginaHobbies} todas={todas} />
      <AdicionarPaginas aberta={existentes} aoMudar={setExistentes} hobby={hobby} soltas={soltas} emBranco={emBranco} />
    </div>
  )
}

function NovaPagina({ aberta, aoMudar, hobby, paginaHobbies, todas }: { aberta: boolean; aoMudar: (v: boolean) => void; hobby: Hobby; paginaHobbies: PaginaResumo | null; todas: PaginaResumo[] }) {
  const router = useRouter()
  const criarPagina = useCriar("pages")
  const gravar = useGravarHobbies()
  const [titulo, setTitulo] = React.useState("")
  const [salvando, setSalvando] = React.useState(false)
  const [erro, setErro] = React.useState(false)

  React.useEffect(() => {
    if (!aberta) return
    setTitulo("")
    setSalvando(false)
    setErro(false)
  }, [aberta])

  const criar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    const nome = titulo.trim()
    if (!nome) return setErro(true)
    setSalvando(true)
    const id = novoId()
    const irmas = todas.filter((p) => p.parent_id === (paginaHobbies?.id ?? null))
    try {
      await criarPagina.mutateAsync({ id, title: nome, section: "geral", parent_id: paginaHobbies?.id ?? null, content: "", position: Math.max(0, ...irmas.map((p) => p.position)) + 1 })
    } catch {
      // O aviso do erro já apareceu
      setSalvando(false)
      return
    }
    await gravar.mudarProps(hobby.item, (props) => void (props._paginas = [...lerIds(props._paginas), id]), "hobbies")
    aoMudar(false)
    router.push(`/paginas/${id}?editar=1`)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo="Nova página"
      descricao={`Ela fica em ${hobby.nome} e abre pronta para escrever.`}
      largura="sm"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-nova-pagina" disabled={salvando}>
            Criar e abrir
          </Botao>
        </>
      }
    >
      <form id="form-nova-pagina" onSubmit={criar} noValidate>
        <Campo rotulo="Nome da página" htmlFor="nova-pagina-titulo">
          <Entrada
            id="nova-pagina-titulo"
            autoFocus
            value={titulo}
            onChange={(e) => {
              setTitulo(e.target.value)
              setErro(false)
            }}
            placeholder="Ex.: Combinações de soco"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={erro || undefined}
            aria-describedby={erro ? "nova-pagina-erro" : undefined}
          />
          {erro ? (
            <p id="nova-pagina-erro" role="alert" className="text-sm text-danger">
              Dê um nome à página.
            </p>
          ) : null}
        </Campo>
      </form>
    </Janela>
  )
}

function AdicionarPaginas({ aberta, aoMudar, hobby, soltas, emBranco }: { aberta: boolean; aoMudar: (v: boolean) => void; hobby: Hobby; soltas: PaginaResumo[]; emBranco: ReadonlySet<string> }) {
  const gravar = useGravarHobbies()
  const [marcadas, setMarcadas] = React.useState<string[]>([])

  React.useEffect(() => {
    if (aberta) setMarcadas([])
  }, [aberta])

  const alternar = (id: string) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))

  const adicionar = () => {
    if (!marcadas.length) return
    void gravar.mudarProps(hobby.item, (props) => void (props._paginas = [...lerIds(props._paginas), ...marcadas.filter((id) => !lerIds(props._paginas).includes(id))]), "hobbies")
    toast.success(`${plural(marcadas.length, "página adicionada", "páginas adicionadas")} a ${hobby.nome}`)
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo="Adicionar páginas existentes"
      descricao={`Estas páginas de Hobbies ainda não estão em nenhum hobby. Escolha as de ${hobby.nome}.`}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={adicionar} disabled={!marcadas.length}>
            {marcadas.length ? `Adicionar ${marcadas.length}` : "Adicionar"}
          </Botao>
        </>
      }
    >
      <ul className="-mx-2 grid gap-0.5">
        {soltas.map((p) => (
          <li key={p.id}>
            <label className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-surface-2 toque:min-h-12")}>
              <input type="checkbox" checked={marcadas.includes(p.id)} onChange={() => alternar(p.id)} className="size-4 shrink-0 accent-[var(--pen)]" />
              <span className="min-w-0 truncate">{tituloDe(p)}</span>
              {emBranco.has(p.id) ? <Etiqueta className="shrink-0">Em branco</Etiqueta> : null}
            </label>
          </li>
        ))}
      </ul>
    </Janela>
  )
}
