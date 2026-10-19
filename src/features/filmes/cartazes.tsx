"use client"

import * as React from "react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { plural } from "@/lib/utils"
import { useChaveTmdb, useDadosFilmes, useGravarFilmes } from "./dados"
import { infoDoResultado, melhorResultado, type ResultadoBusca, type Titulo } from "./logica"
import { ErroTmdb, buscarNoTmdb, detalhesNoTmdb, testarChave } from "./tmdb"
import { AtribuicaoTmdb, MensagemErro } from "./ui"

/** O que guardar do resultado; a série leva a lista de episódios por temporada (se o TMDB devolver). */
export async function infoComEpisodios(r: ResultadoBusca, chave: string) {
  if (r.tipo !== "tv") return infoDoResultado(r)
  // Se os detalhes falharem, grava sem os episódios (o "+1 episódio" anda um por um)
  const eps = await detalhesNoTmdb(chave, "tv", r.id).then(
    (d) => d.eps,
    () => undefined,
  )
  return infoDoResultado(r, eps)
}

/** Guardar a chave do TMDB: testa antes e só salva se ela funcionar. Remover = salvar null. */
export function JanelaCartazes({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const { chave, salvar, salvando } = useChaveTmdb()
  const [rascunho, setRascunho] = React.useState("")
  const [erro, setErro] = React.useState<string | null>(null)
  const [testando, setTestando] = React.useState(false)

  // Ao abrir, a janela começa limpa (a chave salva aparece como "Chave salva")
  React.useEffect(() => {
    if (!aberta) return
    setRascunho("")
    setErro(null)
    setTestando(false)
  }, [aberta])

  const salvarChave = async (e: React.FormEvent) => {
    e.preventDefault()
    const nova = rascunho.trim()
    if (!nova || testando) return
    setErro(null)
    setTestando(true)
    try {
      await testarChave(nova)
    } catch {
      setErro("Essa chave não funcionou. Confira se copiou o Token de leitura da API inteiro.")
      setTestando(false)
      return
    }
    const ok = await salvar(nova)
    setTestando(false)
    if (ok) {
      toast.success("Chave do TMDB salva")
      aoMudar(false)
    }
  }

  const remover = async () => {
    const ok = await salvar(null)
    if (ok) toast.success("Chave removida")
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !testando && aoMudar(v)}
      titulo="Cartazes do TMDB"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={testando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form="form-cartazes" disabled={!rascunho.trim() || testando || salvando}>
            Salvar chave
          </Botao>
        </>
      }
    >
      <div className="grid gap-5">
        <p className="text-[15px] leading-relaxed text-ink-2">Com uma chave grátis do TMDB, a sua lista ganha cartazes, sinopse, trailer e onde assistir.</p>
        <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-ink-2 marker:text-ink-3">
          <li>
            Crie uma conta grátis em{" "}
            <a href="https://www.themoviedb.org/signup" target="_blank" rel="noreferrer" className="text-pen underline underline-offset-2">
              themoviedb.org
            </a>
            .
          </li>
          <li>Em Configurações › API, peça uma chave para uso pessoal.</li>
          <li>Copie o “Token de leitura da API” e cole aqui.</li>
        </ol>

        <form id="form-cartazes" onSubmit={salvarChave} className="grid gap-3" noValidate>
          <Campo rotulo="Chave do TMDB" htmlFor="cartazes-chave">
            <Entrada
              id="cartazes-chave"
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={erro ? true : undefined}
            />
          </Campo>
          {erro ? <MensagemErro texto={erro} /> : null}
        </form>

        {chave ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="font-medium text-ink">Chave salva</span>
            <Botao variante="fantasma" tamanho="sm" onClick={remover} disabled={salvando}>
              Remover chave
            </Botao>
          </div>
        ) : null}

        <AtribuicaoTmdb />
      </div>
    </Janela>
  )
}

/** Os títulos que a busca de cartazes ainda não tentou (sem cartaz e sem "não achado"). */
export const semCartazPendente = (titulos: Titulo[]) => titulos.filter((t) => !t.tmdb && !t.naoAchado)

/**
 * Busca o cartaz de cada título que ainda não tem, em sequência. Quem não achar fica marcado como
 * "não achado" (props._tmdb = false), para não voltar ao aviso; a pessoa escolhe na janela do título
 * ("Escolher cartaz"). Erro de rede não marca: o título volta na próxima busca.
 */
export function useBuscarCartazes() {
  const { titulos } = useDadosFilmes()
  const { chave } = useChaveTmdb()
  const gravar = useGravarFilmes()
  const [rodando, setRodando] = React.useState(false)
  const [feitos, setFeitos] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  // Um clique de cada vez: uma segunda busca no meio da primeira só repetiria as chamadas
  const emAndamento = React.useRef(false)

  const buscar = async () => {
    if (!chave || emAndamento.current) return
    const lista = semCartazPendente(titulos)
    if (!lista.length) return
    emAndamento.current = true
    setRodando(true)
    setFeitos(0)
    setTotal(lista.length)
    let achados = 0
    let naoAchados = 0
    let falhas = 0
    try {
      for (const t of lista) {
        try {
          const resultados = await buscarNoTmdb(chave, t.nome)
          const r = melhorResultado(resultados, t.nome, t.tipo)
          if (r) {
            const info = await infoComEpisodios(r, chave)
            void gravar.mudarProps(t.item, (p) => {
              p._tmdb = info as unknown as Json
            }, "filmes")
            achados++
          } else {
            void gravar.mudarProps(t.item, (p) => {
              p._tmdb = false
            }, "filmes")
            naoAchados++
          }
        } catch (e) {
          // Chave recusada: não adianta continuar com os outros títulos
          if (e instanceof ErroTmdb && e.status === 401) {
            toast.error("A chave do TMDB não funcionou. Confira em Cartazes (TMDB).")
            return
          }
          falhas++
        }
        setFeitos((n) => n + 1)
      }
      const detalhes = [
        naoAchados === 1 ? "1 não foi achado: escolha o cartaz na janela do título." : naoAchados > 1 ? `${naoAchados} não foram achados: escolha o cartaz na janela de cada título.` : "",
        falhas ? `Não deu para buscar ${falhas} agora. Tente de novo.` : "",
      ].filter(Boolean)
      const resumo = achados === 0 ? "Nenhum cartaz encontrado" : plural(achados, "cartaz encontrado", "cartazes encontrados")
      const aviso = { description: detalhes.length ? detalhes.join(" ") : undefined }
      if (achados === 0) toast.info(resumo, aviso)
      else toast.success(resumo, aviso)
    } finally {
      emAndamento.current = false
      setRodando(false)
    }
  }

  return { buscar, rodando, feitos, total }
}
