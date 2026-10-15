"use client"

import * as React from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import { useSessao } from "@/components/provedores"
import { TAMANHO_MAXIMO_FOTO, enviarFotoDeItem } from "@/features/colecoes/gravacao"
import type { Json } from "@/lib/supabase/database.types"
import { META_MAXIMA, useGarantirColecaoHobbies, useGravarHobbies, type Hobby, type Sessao } from "./dados"
import { CapaHobby } from "./ui"

const METAS = Array.from({ length: META_MAXIMA + 1 }, (_, i) => ({ id: String(i), rotulo: i === 0 ? "Sem meta" : `${i}×` }))

/** Novo hobby ou edição: nome, meta da semana, objetivo e foto. */
export function FormHobby({
  aberta,
  aoMudar,
  hobby,
  sessoes,
  aoSalvo,
  aoExcluir,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  /** Editando este hobby (sem ele, cria um novo). */
  hobby?: Hobby | null
  /** As práticas deste hobby: se o nome mudar, o título delas acompanha. */
  sessoes?: Sessao[]
  aoSalvo?: (id: string, novo: boolean) => void
  /** Mostra "Excluir hobby" no rodapé (quem chama pergunta antes). */
  aoExcluir?: () => void
}) {
  const { usuario } = useSessao()
  const gravar = useGravarHobbies()
  const garantirColecao = useGarantirColecaoHobbies()
  const [nome, setNome] = React.useState("")
  const [meta, setMeta] = React.useState("0")
  const [objetivo, setObjetivo] = React.useState("")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [tirarFoto, setTirarFoto] = React.useState(false)
  const [erroNome, setErroNome] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const entradaFoto = React.useRef<HTMLInputElement>(null)

  // Ao abrir, começa do que está gravado (ou em branco, para um hobby novo).
  // Só ao abrir (ou ao trocar de hobby): uma recarga dos dados com o formulário aberto não pode apagar o que a pessoa escreveu.
  React.useEffect(() => {
    if (!aberta) return
    setNome(hobby?.nome ?? "")
    setMeta(String(hobby?.meta ?? 0))
    setObjetivo(hobby?.objetivo ?? "")
    setArquivo(null)
    setTirarFoto(false)
    setErroNome(null)
    setEnviando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, hobby?.id])

  const [previa, setPrevia] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!arquivo) return setPrevia(null)
    const url = URL.createObjectURL(arquivo)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const temFotoAtual = !tirarFoto && Boolean(hobby?.capa || hobby?.capaUrl)

  const escolherFoto = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith("image/")) return toast.error("Escolha uma imagem (JPG, PNG ou WebP).")
    if (f.size > TAMANHO_MAXIMO_FOTO) return toast.error("A foto é grande demais. Use uma de até 20 MB.")
    setArquivo(f)
    setTirarFoto(false)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    const titulo = nome.trim()
    if (!titulo) return setErroNome("Dê um nome ao hobby.")
    setErroNome(null)

    const id = hobby?.id ?? crypto.randomUUID()
    // undefined: a foto fica como está; null: sai
    let caminho: string | null | undefined = tirarFoto ? null : undefined
    if (arquivo) {
      if (!usuario) return toast.error("Sua sessão expirou. Entre de novo para enviar a foto.")
      setEnviando(true)
      try {
        const colecao = await garantirColecao()
        caminho = await enviarFotoDeItem(arquivo, usuario.id, colecao.id, id)
      } catch (err) {
        setEnviando(false)
        return toast.error("Não foi possível enviar a foto.", { description: err instanceof Error ? err.message : undefined })
      }
    }

    const metaDias = Number(meta) || 0
    const aplicar = (props: Record<string, Json>) => {
      if (metaDias > 0) props["Meta por semana"] = metaDias
      else delete props["Meta por semana"]
      if (objetivo.trim()) props.Objetivo = objetivo.trim()
      else delete props.Objetivo
      // A foto enviada ou retirada vale no lugar da que veio do Notion
      if (caminho !== undefined) delete props.Foto
      return props
    }

    try {
      if (hobby) {
        await gravar.mudar(
          hobby.item,
          (atual) => ({
            title: titulo,
            props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }),
            ...(caminho !== undefined ? { cover_path: caminho } : {}),
          }),
          "hobbies",
        )
        if (titulo !== hobby.nome) for (const s of sessoes ?? []) void gravar.mudar(s.item, () => ({ title: titulo }), "pratica")
      } else {
        await gravar.criar("hobbies", { id, title: titulo, props: aplicar({ _paginas: [] }), cover_path: caminho ?? null })
      }
    } catch {
      setEnviando(false)
      return
    }
    setEnviando(false)
    aoMudar(false)
    aoSalvo?.(id, !hobby)
  }

  const idForm = "form-hobby"

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !enviando && aoMudar(v)}
      titulo={hobby ? "Editar hobby" : "Novo hobby"}
      descricao={hobby ? undefined : "Ele ganha um cartão com a prática da semana e as páginas de estudo."}
      rodape={
        <>
          {hobby && aoExcluir ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={aoExcluir} disabled={enviando}>
              <Trash2 /> Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={enviando}>
            {enviando ? "Enviando a foto…" : hobby ? "Salvar" : "Criar hobby"}
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <Campo rotulo="Nome" htmlFor="hobby-nome">
          <Entrada
            id="hobby-nome"
            autoFocus={!hobby}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Piano, Boxe, Fotografia"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={erroNome ? true : undefined}
            aria-describedby={erroNome ? "hobby-erro" : undefined}
          />
          {erroNome ? (
            <p id="hobby-erro" role="alert" className="text-sm text-danger">
              {erroNome}
            </p>
          ) : null}
        </Campo>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Meta por semana</span>
          <EscolhaPilulas rotulo="Dias por semana" valor={meta} aoMudar={setMeta} opcoes={METAS} />
          <p className="text-xs text-ink-3">Quantos dias da semana você quer praticar. Dá para mudar quando quiser.</p>
        </div>

        <Campo rotulo="Objetivo" htmlFor="hobby-objetivo" dica="Opcional. Aparece no topo da página do hobby.">
          <Entrada id="hobby-objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex.: tocar duas músicas inteiras até dezembro" autoComplete="off" enterKeyHint="done" />
        </Campo>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Foto</span>
          {previa || temFotoAtual ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {previa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previa} alt="" className="h-full w-full object-cover" />
                ) : hobby ? (
                  <CapaHobby hobby={hobby} />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Botao variante="contorno" tamanho="sm" onClick={() => entradaFoto.current?.click()}>
                  Trocar
                </Botao>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => {
                    setArquivo(null)
                    if (hobby?.capa || hobby?.capaUrl) setTirarFoto(true)
                  }}
                >
                  Tirar
                </Botao>
              </div>
            </div>
          ) : (
            <Botao variante="contorno" className="justify-self-start" onClick={() => entradaFoto.current?.click()}>
              <ImagePlus /> Adicionar foto
            </Botao>
          )}
          <input
            ref={entradaFoto}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              escolherFoto(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </div>
      </form>
    </Janela>
  )
}
