"use client"

import * as React from "react"
import { ImageIcon } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import { isoDia, normalizar } from "@/lib/utils"
import { useBuscaTmdb, useChaveTmdb, useDadosFilmes, useGravarFilmes } from "./dados"
import {
  CATEGORIAS_FILMES,
  categoriaSugerida,
  estrelas,
  gradienteDoTitulo,
  imagemTmdb,
  PLATAFORMAS,
  type InfoTmdb,
  type ResultadoBusca,
  type Titulo,
} from "./logica"
import { infoComEpisodios, JanelaCartazes } from "./cartazes"
import { COLUNA, EscolherNota, MensagemErro } from "./ui"

const FORM = "form-adicionar"

/** As categorias de Filmes & Séries: as da lista fixa e as que já existem nos títulos (sem repetir). */
function categoriasDisponiveis(titulos: Titulo[]): string[] {
  const vistas = new Map<string, string>()
  for (const c of CATEGORIAS_FILMES) vistas.set(normalizar(c), c)
  for (const t of titulos) {
    if (t.categoria && !vistas.has(normalizar(t.categoria))) vistas.set(normalizar(t.categoria), t.categoria)
  }
  return [...vistas.values()]
}

const TIPOS = [
  { id: "filme", rotulo: "Filme" },
  { id: "serie", rotulo: "Série" },
] as const

/** Adicionar um título (buscando no TMDB, ou à mão sem chave) ou, com `trocarCartazDe`, escolher o cartaz de um. */
export function JanelaAdicionar({
  aberta,
  aoMudar,
  trocarCartazDe,
  aoVer,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  trocarCartazDe?: Titulo
  /** Abre o título que já está na lista (quando a pessoa escolhe um que já tem). */
  aoVer?: (t: Titulo) => void
}) {
  const { chave } = useChaveTmdb()
  const { titulos } = useDadosFilmes()
  const gravar = useGravarFilmes()

  const [termo, setTermo] = React.useState("")
  const [escolhido, setEscolhido] = React.useState<ResultadoBusca | null>(null)
  const [tipo, setTipo] = React.useState<"filme" | "serie">("filme")
  const [categoria, setCategoria] = React.useState("")
  const [plataforma, setPlataforma] = React.useState("")
  const [jaAssisti, setJaAssisti] = React.useState(false)
  const [nota, setNota] = React.useState<number | null>(null)
  const [nomeManual, setNomeManual] = React.useState("")
  const [erroNome, setErroNome] = React.useState(false)
  const [salvando, setSalvando] = React.useState(false)
  const [cartazesAberta, setCartazesAberta] = React.useState(false)

  // Ao abrir, começa do zero (no modo trocar, já procura pelo nome do título)
  React.useEffect(() => {
    if (!aberta) return
    setTermo(trocarCartazDe?.nome ?? "")
    setEscolhido(null)
    setTipo(trocarCartazDe?.tipo === "serie" ? "serie" : "filme")
    setCategoria("")
    setPlataforma("")
    setJaAssisti(false)
    setNota(null)
    setNomeManual("")
    setErroNome(false)
    setSalvando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, trocarCartazDe?.id])

  const busca = useBuscaTmdb(chave, termo)
  const termoLimpo = termo.trim()

  /** Grava um título novo na lista (os campos vêm do formulário; `tmdb` vem da busca). */
  const criarTitulo = async (dados: {
    nome: string
    tipo: "filme" | "serie"
    categoria: string
    plataforma: string
    jaAssisti: boolean
    nota: number | null
    tmdb?: InfoTmdb
  }) => {
    const props: Record<string, Json> = {
      [COLUNA.tipo]: dados.tipo === "serie" ? "Série" : "Filme",
      [COLUNA.assistido]: dados.jaAssisti,
    }
    if (dados.categoria) props[COLUNA.categoria] = dados.categoria
    if (dados.plataforma) props[COLUNA.plataforma] = dados.plataforma
    if (dados.jaAssisti) props[COLUNA.data] = isoDia()
    if (dados.jaAssisti && dados.nota) props[COLUNA.nota] = estrelas(dados.nota)
    if (dados.tmdb) props._tmdb = dados.tmdb as unknown as Json
    setSalvando(true)
    try {
      await gravar.criar("filmes", { title: dados.nome, props, position: Date.now() })
      toast.success(dados.jaAssisti ? `“${dados.nome}” está nos assistidos` : `“${dados.nome}” está na sua lista`)
      aoMudar(false)
    } catch {
      // Quem grava já avisou o que deu errado
    }
    setSalvando(false)
  }

  /** No modo trocar: o resultado escolhido vira o cartaz do título, e a janela fecha. */
  const trocarCartaz = async (r: ResultadoBusca) => {
    if (!chave || !trocarCartazDe) return
    setSalvando(true)
    const info = await infoComEpisodios(r, chave)
    void gravar.mudarProps(trocarCartazDe.item, (p) => {
      p._tmdb = info as unknown as Json
    }, "filmes")
    toast.success("Cartaz trocado")
    setSalvando(false)
    aoMudar(false)
  }

  const escolher = (r: ResultadoBusca) => {
    if (trocarCartazDe) {
      void trocarCartaz(r)
      return
    }
    setEscolhido(r)
    setTipo(r.tipo === "tv" ? "serie" : "filme")
    setCategoria(categoriaSugerida(r.generos, r.ano) ?? "")
    setPlataforma("")
    setJaAssisti(false)
    setNota(null)
  }

  const jaNaLista = escolhido && !trocarCartazDe ? titulos.find((t) => t.tmdb?.id === escolhido.id && t.tmdb.tipo === escolhido.tipo) : undefined

  const salvarEscolhido = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!escolhido || !chave || salvando) return
    setSalvando(true)
    const info = await infoComEpisodios(escolhido, chave)
    setSalvando(false)
    await criarTitulo({
      nome: escolhido.nome || escolhido.original,
      tipo,
      categoria,
      plataforma,
      jaAssisti,
      nota,
      tmdb: info,
    })
  }

  const salvarManual = async (e: React.FormEvent) => {
    e.preventDefault()
    const nome = nomeManual.trim()
    if (!nome) {
      setErroNome(true)
      return
    }
    await criarTitulo({ nome, tipo, categoria, plataforma, jaAssisti, nota })
  }

  const opcoesCategoria = [...categoriasDisponiveis(titulos).map((c) => ({ id: c, rotulo: c })), { id: "", rotulo: "Nenhuma" }]
  const opcoesPlataforma = [...PLATAFORMAS.map((p) => ({ id: p, rotulo: p })), { id: "", rotulo: "Nenhuma" }]

  /** Os campos do título novo: tipo, categoria, onde assistir e se já assistiu (com a nota). */
  const campos = (
    <>
      <Campo rotulo="Tipo">
        <EscolhaPilulas rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={[...TIPOS]} />
      </Campo>
      <Campo rotulo="Categoria">
        <EscolhaPilulas rotulo="Categoria" valor={categoria} aoMudar={setCategoria} opcoes={opcoesCategoria} />
      </Campo>
      <Campo rotulo="Onde assistir">
        <EscolhaPilulas rotulo="Onde assistir" valor={plataforma} aoMudar={setPlataforma} opcoes={opcoesPlataforma} />
      </Campo>
      <div className="grid gap-2">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={jaAssisti} onChange={(e) => setJaAssisti(e.target.checked)} className="size-4 accent-pen" />
          Já assisti
        </label>
        {jaAssisti ? <EscolherNota valor={nota} aoMudar={setNota} /> : null}
      </div>
    </>
  )

  // Sem chave: o formulário à mão, com a dica de ativar os cartazes
  if (!chave) {
    return (
      <>
        <Janela
          aberta={aberta}
          aoMudar={(v) => !salvando && aoMudar(v)}
          titulo="Adicionar filme ou série"
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
                Cancelar
              </Botao>
              <Botao variante="primario" type="submit" form={FORM} disabled={salvando}>
                Adicionar
              </Botao>
            </>
          }
        >
          <form id={FORM} onSubmit={salvarManual} className="grid gap-5" noValidate>
            <Campo rotulo="Nome" htmlFor="adicionar-nome">
              <Entrada
                id="adicionar-nome"
                value={nomeManual}
                onChange={(e) => {
                  setNomeManual(e.target.value)
                  setErroNome(false)
                }}
                autoComplete="off"
                aria-invalid={erroNome || undefined}
              />
              {erroNome ? <MensagemErro texto="Escreva o nome." /> : null}
            </Campo>
            {campos}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
              <span className="min-w-0 flex-1">Ative os cartazes para buscar o título com capa, sinopse e trailer.</span>
              <Botao variante="contorno" tamanho="sm" onClick={() => setCartazesAberta(true)}>
                <ImageIcon /> Ativar cartazes
              </Botao>
            </div>
          </form>
        </Janela>
        <JanelaCartazes aberta={cartazesAberta} aoMudar={setCartazesAberta} />
      </>
    )
  }

  // Com chave: busca no TMDB; ao escolher, mostra o escolhido e o formulário (ou troca o cartaz)
  const resultados = busca.data ?? []
  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo={trocarCartazDe ? "Escolher cartaz" : "Adicionar filme ou série"}
      rodape={
        escolhido && !jaNaLista && !trocarCartazDe ? (
          <>
            <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao variante="primario" type="submit" form={FORM} disabled={salvando}>
              Adicionar
            </Botao>
          </>
        ) : (
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
        )
      }
    >
      {!escolhido ? (
        <div className="grid gap-4">
          <Entrada
            type="search"
            aria-label="Buscar filme ou série"
            placeholder="Nome do filme ou série"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {busca.isError ? <MensagemErro texto={`Não deu para buscar agora. ${busca.error instanceof Error ? busca.error.message : ""}`.trim()} /> : null}
          {busca.isFetching && !busca.data ? <p className="text-sm text-ink-3">Buscando…</p> : null}
          {termoLimpo.length >= 2 && busca.data && busca.data.length === 0 && !busca.isFetching ? <p className="text-sm text-ink-2">Nada encontrado.</p> : null}
          {resultados.length ? (
            <ul className="grid gap-1">
              {resultados.map((r) => {
                const tipoTexto = r.tipo === "tv" ? "Série" : "Filme"
                return (
                  <li key={`${r.tipo}-${r.id}`}>
                    <button
                      type="button"
                      disabled={salvando}
                      aria-label={`${r.nome}${r.ano ? ` (${r.ano})` : ""}, ${r.tipo === "tv" ? "série" : "filme"}`}
                      onClick={() => escolher(r)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2 disabled:opacity-60 toque:min-h-11"
                    >
                      <Miniatura caminho={r.poster} nome={r.nome} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.nome}</span>
                        <span className="block text-xs text-ink-3">{[r.ano, tipoTexto].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <Miniatura caminho={escolhido.poster} nome={escolhido.nome} grande />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-snug">{escolhido.nome}</p>
              <p className="text-sm text-ink-3">{[escolhido.ano, escolhido.tipo === "tv" ? "Série" : "Filme"].filter(Boolean).join(" · ")}</p>
            </div>
            {!trocarCartazDe ? (
              <Botao variante="fantasma" tamanho="sm" onClick={() => setEscolhido(null)} disabled={salvando}>
                Escolher outro
              </Botao>
            ) : null}
          </div>

          {jaNaLista ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-pen-soft px-3 py-2.5 text-sm">
              <p className="font-medium text-ink">Já está na sua lista.</p>
              <Botao
                variante="contorno"
                tamanho="sm"
                onClick={() => {
                  aoMudar(false)
                  aoVer?.(jaNaLista)
                }}
              >
                Ver
              </Botao>
            </div>
          ) : trocarCartazDe ? null : (
            <form id={FORM} onSubmit={salvarEscolhido} className="grid gap-5" noValidate>
              {campos}
            </form>
          )}
        </div>
      )}
    </Janela>
  )
}

/** A miniatura do resultado (o cartaz pequeno, ou o degradê se não houver). */
function Miniatura({ caminho, nome, grande = false }: { caminho: string | null; nome: string; grande?: boolean }) {
  const src = imagemTmdb(caminho, grande ? "w185" : "w92")
  return (
    <span aria-hidden className={grande ? "h-24 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2" : "h-14 w-10 shrink-0 overflow-hidden rounded bg-surface-2"}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center p-1 text-center text-[9px] font-semibold leading-tight text-white" style={{ backgroundImage: gradienteDoTitulo(nome) }}>
          {nome}
        </span>
      )}
    </span>
  )
}

