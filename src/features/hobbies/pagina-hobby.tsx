"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { ArrowLeft, Ellipsis, Layers, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Carregando, ErroCarregar, Segmentos, Vazio } from "@/components/ui/basicos"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import type { Json } from "@/lib/supabase/database.types"
import { isoDia, plural } from "@/lib/utils"
import { filhosDe } from "@/features/paginas/dados"
import { diasDaSemana, resumirHobby, textoMinutos, textoSemana, useDadosHobbies, useGravarHobbies, usePaginasDosHobbies, usePaginasEmBranco, type Sessao } from "./dados"
import { FormHobby } from "./form-hobby"
import { FormPratica } from "./form-pratica"
import { MaterialHobby } from "./material"
import { PraticaHobby } from "./pratica"
import { Bolinhas, CapaHobby, FaixaSemana } from "./ui"

const ABAS = ["pratica", "material"] as const
type Aba = (typeof ABAS)[number]

/** Um hobby: a semana, o diário de prática e as páginas de estudo. */
export function PaginaHobby() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const router = useRouter()
  const { colecoes, hobbies, sessoes, carregando, erro } = useDadosHobbies()
  const { pagina, paginas, porId, carregando: carregandoPaginas } = usePaginasDosHobbies()
  const gravar = useGravarHobbies()
  const [registrar, setRegistrar] = React.useState(false)
  const [editandoSessao, setEditandoSessao] = React.useState<Sessao | null>(null)
  const [editar, setEditar] = React.useState(false)
  const [excluir, setExcluir] = React.useState(false)

  const hobby = hobbies.find((h) => h.id === id)
  const minhasSessoes = React.useMemo(() => sessoes.filter((s) => s.hobby === id), [sessoes, id])
  const paginasDoHobby = React.useMemo(() => (hobby?.paginas ?? []).map((p) => porId.get(p)).filter((p) => p !== undefined), [hobby?.paginas, porId])
  const soltas = React.useMemo(() => {
    if (!pagina) return []
    const ligadas = new Set(hobbies.flatMap((h) => h.paginas))
    return filhosDe(paginas, pagina.id).filter((p) => !ligadas.has(p.id))
  }, [pagina, paginas, hobbies])
  const emBranco = usePaginasEmBranco(React.useMemo(() => [...paginasDoHobby, ...soltas], [paginasDoHobby, soltas]))

  const pedida = params.get("aba")
  const aba: Aba = (ABAS as readonly string[]).includes(pedida ?? "") ? (pedida as Aba) : "pratica"
  const mudarAba = (a: Aba) => router.replace(`/vida/hobbies/${id}?aba=${a}`, { scroll: false })

  if (carregando || carregandoPaginas) return <Carregando linhas={6} />
  if (erro) return <ErroCarregar erro={erro} />
  if (!hobby)
    return (
      <Vazio
        titulo="Hobby não encontrado."
        descricao="Ele pode ter sido excluído."
        acao={
          <Botao asChild variante="contorno">
            <Link href="/vida/hobbies">Ver os hobbies</Link>
          </Botao>
        }
      />
    )

  const hoje = isoDia()
  const resumo = resumirHobby(minhasSessoes, hoje)
  const semana = diasDaSemana(hoje)
  const praticados = new Set(resumo.diasNaSemana)

  const apagarTudo = () => {
    // Sai da página antes de apagar, para não piscar "Hobby não encontrado"
    router.push("/vida/hobbies")
    void gravar.excluir([hobby.item, ...minhasSessoes.map((s) => s.item)])
    toast.success(`“${hobby.nome}” excluído`)
  }

  const excluirSessao = (s: Sessao) => {
    setEditandoSessao(null)
    void gravar.excluir([s.item])
    toast.success("Prática excluída", {
      action: {
        label: "Desfazer",
        onClick: () => void gravar.criar("pratica", { id: s.id, title: s.item.title, props: (s.item.props ?? {}) as Record<string, Json>, content: s.item.content, position: s.item.position }).catch(() => undefined),
      },
    })
  }

  return (
    <div className="max-w-3xl">
      <Link href="/vida/hobbies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Hobbies
      </Link>

      <header className="relative mb-4 overflow-hidden rounded-xl border border-line">
        <div className="relative aspect-[16/9] max-h-64 w-full sm:aspect-[21/7]">
          <CapaHobby hobby={hobby} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
          <div className="absolute right-3 top-3 flex gap-1.5">
            <Botao tamanho="sm" className="border-0 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60" onClick={() => setEditar(true)}>
              <Pencil /> Editar
            </Botao>
            <Menu>
              <MenuGatilho asChild>
                <Botao tamanho="icone-sm" className="border-0 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60" aria-label="Mais opções do hobby">
                  <Ellipsis />
                </Botao>
              </MenuGatilho>
              <MenuConteudo className="w-56">
                {colecoes.pratica ? (
                  <MenuItem onSelect={() => router.push(`/colecoes/${colecoes.pratica!.id}`)}>
                    <Layers /> Práticas em tabela
                  </MenuItem>
                ) : null}
                <MenuSeparador />
                <MenuItem perigo onSelect={() => setExcluir(true)}>
                  <Trash2 /> Excluir hobby
                </MenuItem>
              </MenuConteudo>
            </Menu>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
            <h1 className="font-display text-3xl font-semibold leading-tight">{hobby.nome}</h1>
            {hobby.objetivo ? <p className="mt-1 max-w-xl text-sm text-white/85">{hobby.objetivo}</p> : null}
          </div>
        </div>
      </header>

      <section aria-label="Esta semana" className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-3">Esta semana</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
            {textoSemana(hobby.meta, resumo.diasNaSemana.length)}
            {hobby.meta ? <Bolinhas feitas={resumo.diasNaSemana.length} meta={hobby.meta} /> : null}
          </p>
          {resumo.minutosNaSemana ? <p className="text-xs text-ink-3">{textoMinutos(resumo.minutosNaSemana)} de prática</p> : null}
          {!hobby.meta ? (
            <button type="button" onClick={() => setEditar(true)} className="mt-1 rounded-sm text-xs font-medium text-pen hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/40 toque:py-1.5">
              Definir meta por semana
            </button>
          ) : null}
        </div>
        <FaixaSemana dias={semana} praticados={praticados} hoje={hoje} />
        <Botao variante="primario" className="w-full sm:w-auto" onClick={() => setRegistrar(true)}>
          <Plus /> Registrar prática
        </Botao>
      </section>

      <Segmentos
        rotulo="Partes do hobby"
        valor={aba}
        aoMudar={mudarAba}
        className="mb-6"
        opcoes={[
          { valor: "pratica", rotulo: "Prática", contagem: minhasSessoes.length || undefined },
          { valor: "material", rotulo: "Material", contagem: paginasDoHobby.length || undefined },
        ]}
      />

      <div role="tabpanel" aria-label={aba}>
        {aba === "pratica" ? (
          <PraticaHobby sessoes={minhasSessoes} resumo={resumo} aoRegistrar={() => setRegistrar(true)} aoEditar={setEditandoSessao} />
        ) : (
          <MaterialHobby hobby={hobby} hobbies={hobbies} todas={paginas} paginasDoHobby={paginasDoHobby} soltas={soltas} emBranco={emBranco} paginaHobbies={pagina} />
        )}
      </div>

      <FormPratica
        aberta={registrar || Boolean(editandoSessao)}
        aoMudar={(v) => {
          if (v) return
          setRegistrar(false)
          setEditandoSessao(null)
        }}
        hobbies={hobbies}
        sessoes={sessoes}
        hobbyInicial={hobby.id}
        sessao={editandoSessao}
        aoExcluir={() => editandoSessao && excluirSessao(editandoSessao)}
      />
      <FormHobby
        aberta={editar}
        aoMudar={setEditar}
        hobby={hobby}
        sessoes={minhasSessoes}
        aoExcluir={() => {
          setEditar(false)
          setExcluir(true)
        }}
      />
      <Confirmar
        aberta={excluir}
        aoMudar={setExcluir}
        titulo={`Excluir “${hobby.nome}”?`}
        descricao={`${minhasSessoes.length ? `${plural(minhasSessoes.length, "prática registrada", "práticas registradas")} também ${minhasSessoes.length === 1 ? "sai" : "saem"}. ` : ""}As páginas de estudo continuam no app.`}
        aoConfirmar={apagarTudo}
      />
    </div>
  )
}
