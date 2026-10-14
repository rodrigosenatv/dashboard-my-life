"use client"

import * as React from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { useSessao } from "@/components/provedores"
import { Capa } from "@/features/colecoes/visao-colecao"
import type { Json } from "@/lib/supabase/database.types"
import { isoDia } from "@/lib/utils"
import { STATUS_SALVO, TAMANHO_MAXIMO_FOTO, enviarFotoViagem, lerValorDigitado, situacaoDaViagem, textoDias, useGarantirColecaoViagens, useGravarViagens, type Viagem } from "./dados"
import { CampoReais, valorNoCampo } from "./ui"

const PREFIXO_ARQUIVO = "arquivo://"

/** Nova viagem ou edição: destino, datas (ou ainda sem data), orçamento e foto. */
export function FormViagem({
  aberta,
  aoMudar,
  viagem,
  aoSalva,
  aoExcluir,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  /** Editando esta viagem (sem ela, cria uma nova). */
  viagem?: Viagem | null
  aoSalva?: (id: string, nova: boolean) => void
  /** Mostra "Excluir viagem" no rodapé (quem chama pergunta antes). */
  aoExcluir?: () => void
}) {
  const { usuario } = useSessao()
  const gravar = useGravarViagens()
  const garantirColecao = useGarantirColecaoViagens()
  const [nome, setNome] = React.useState("")
  const [semData, setSemData] = React.useState(false)
  const [ida, setIda] = React.useState("")
  const [volta, setVolta] = React.useState("")
  const [orcamento, setOrcamento] = React.useState("")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [tirarFoto, setTirarFoto] = React.useState(false)
  const [erro, setErro] = React.useState<{ campo: "nome" | "datas" | "orcamento"; texto: string } | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const entradaFoto = React.useRef<HTMLInputElement>(null)

  // Ao abrir, começa do que está gravado (ou em branco, para uma viagem nova)
  React.useEffect(() => {
    if (!aberta) return
    setNome(viagem?.nome ?? "")
    setSemData(Boolean(viagem && !viagem.ida))
    setIda(viagem?.ida ?? "")
    setVolta(viagem?.volta ?? "")
    setOrcamento(valorNoCampo(viagem?.orcamento))
    setArquivo(null)
    setTirarFoto(false)
    setErro(null)
    setEnviando(false)
  }, [aberta, viagem])

  const [previa, setPrevia] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!arquivo) return setPrevia(null)
    const url = URL.createObjectURL(arquivo)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const dias = !semData && ida ? Math.max(1, Math.round((Date.parse(volta && volta >= ida ? volta : ida) - Date.parse(ida)) / 86_400_000) + 1) : null
  const fotoAtual = !tirarFoto && viagem?.capa ? viagem.capa : null

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
    const destino = nome.trim()
    if (!destino) return setErro({ campo: "nome", texto: "Diga para onde é a viagem." })
    if (!semData && !ida) return setErro({ campo: "datas", texto: "Escolha a data de ida ou marque “Ainda sem data”." })
    const valorOrcamento = orcamento.trim() ? lerValorDigitado(orcamento) : null
    if (orcamento.trim() && valorOrcamento === null) return setErro({ campo: "orcamento", texto: "Use só números, como 3.000 ou 2500,50." })
    setErro(null)

    const id = viagem?.id ?? crypto.randomUUID()
    // undefined: a foto fica como está; null: sai
    let caminho: string | null | undefined = tirarFoto ? null : undefined
    if (arquivo) {
      if (!usuario) return toast.error("Sua sessão expirou. Entre de novo para enviar a foto.")
      setEnviando(true)
      try {
        const colecao = await garantirColecao()
        caminho = await enviarFotoViagem(arquivo, usuario.id, colecao.id, id)
      } catch (err) {
        setEnviando(false)
        return toast.error("Não foi possível enviar a foto.", { description: err instanceof Error ? err.message : undefined })
      }
    }

    const novaIda = semData ? null : ida
    const novaVolta = semData ? null : volta && volta >= ida ? volta : ida
    const situacao = situacaoDaViagem(novaIda, novaVolta, "", isoDia())
    const aplicar = (props: Record<string, Json>) => {
      // As datas passam a valer por Ida e Volta; o campo Data do Notion sai para não voltar a contar
      delete props.Data
      if (novaIda) {
        props.Ida = novaIda
        props.Volta = novaVolta
      } else {
        delete props.Ida
        delete props.Volta
      }
      // Sem data, uma viagem antiga marcada como realizada continua realizada
      if (novaIda || viagem?.situacao !== "realizada") props.Status = STATUS_SALVO[situacao]
      if (valorOrcamento !== null) props["Orçamento Total"] = valorOrcamento
      else delete props["Orçamento Total"]
      if (caminho) props.Foto = `${PREFIXO_ARQUIVO}${encodeURIComponent(caminho)}`
      else if (caminho === null) delete props.Foto
      return props
    }

    try {
      if (viagem) {
        await gravar.mudar(
          viagem.item,
          (atual) => ({
            title: destino,
            props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }),
            ...(caminho !== undefined ? { cover_path: caminho } : {}),
          }),
          "viagens",
        )
      } else {
        await gravar.criar("viagens", { id, title: destino, props: aplicar({}), cover_path: caminho ?? null })
      }
    } catch {
      setEnviando(false)
      return
    }
    setEnviando(false)
    aoMudar(false)
    aoSalva?.(id, !viagem)
  }

  const idForm = "form-viagem"

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !enviando && aoMudar(v)}
      titulo={viagem ? "Editar viagem" : "Nova viagem"}
      descricao={viagem ? undefined : "Sem data, ela fica em Quero ir. Dá para completar depois."}
      rodape={
        <>
          {viagem && aoExcluir ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={aoExcluir} disabled={enviando}>
              <Trash2 /> Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={enviando}>
            {enviando ? "Enviando a foto…" : viagem ? "Salvar" : "Criar viagem"}
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <Campo rotulo="Destino" htmlFor="viagem-nome">
          <Entrada
            id="viagem-nome"
            autoFocus={!viagem}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Salvador, Chapada Diamantina"
            autoComplete="off"
            enterKeyHint="next"
            aria-invalid={erro?.campo === "nome" || undefined}
            aria-describedby={erro?.campo === "nome" ? "viagem-erro" : undefined}
          />
        </Campo>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Datas</legend>
          {semData ? null : (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-ink-3">
                Ida
                <Entrada
                  type="date"
                  value={ida}
                  onChange={(e) => {
                    setIda(e.target.value)
                    if (volta && e.target.value && volta < e.target.value) setVolta(e.target.value)
                  }}
                  aria-invalid={erro?.campo === "datas" || undefined}
                  aria-describedby={erro?.campo === "datas" ? "viagem-erro" : undefined}
                />
              </label>
              <label className="grid gap-1 text-xs text-ink-3">
                Volta
                <Entrada type="date" value={volta} min={ida || undefined} onChange={(e) => setVolta(e.target.value)} />
              </label>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-2 toque:min-h-10">
            <input type="checkbox" checked={semData} onChange={(e) => setSemData(e.target.checked)} className="size-4 accent-[var(--pen)]" />
            Ainda sem data (fica em Quero ir)
          </label>
          {dias ? <p className="text-xs text-ink-3">{textoDias(dias)} de viagem</p> : null}
        </fieldset>

        <Campo rotulo="Orçamento" htmlFor="viagem-orcamento" dica="Opcional. Os gastos da viagem são comparados com ele.">
          <CampoReais
            id="viagem-orcamento"
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            placeholder="3.000"
            aria-invalid={erro?.campo === "orcamento" || undefined}
            aria-describedby={erro?.campo === "orcamento" ? "viagem-erro" : undefined}
          />
        </Campo>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Foto</span>
          {previa || fotoAtual ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {previa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previa} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Capa caminho={fotoAtual!} className="aspect-auto h-full" />
                )}
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
                    if (viagem?.capa) setTirarFoto(true)
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

        {erro ? (
          <p id="viagem-erro" role="alert" className="text-sm text-danger">
            {erro.texto}
          </p>
        ) : null}
      </form>
    </Janela>
  )
}
