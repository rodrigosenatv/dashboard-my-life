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
import { lerValorDigitado } from "@/features/viagens/logica"
import type { Json } from "@/lib/supabase/database.types"
import { useGarantirColecaoPecas, useGravarGuardaRoupa } from "./dados"
import {
  CONSERVACOES,
  COL,
  CORES,
  TIPOS_PECA,
  opcoesCom,
  outfitsDaPeca,
  propsDaPeca,
  propsDoOutfit,
  validarPeca,
  type ErrosPeca,
  type Outfit,
  type Peca,
} from "./logica"
import { EscolhaVarias, FotoPeca, IconeDoTipo } from "./ui"

const TAMANHOS = ["P", "M", "G", "GG"]

/** Os valores que aparecem nas peças já cadastradas, sem repetir, para as opções do formulário. */
const unicos = (valores: (string | null)[]) => Array.from(new Set(valores.filter((v): v is string => Boolean(v))))

/**
 * Nova peça, novo desejo ou edição (nome, tipo, cor, tamanho, marca, valor, link e foto).
 * "Já tenho esta peça" decide se é peça ou desejo.
 */
export function JanelaFormPeca({
  aberta,
  aoMudar,
  peca,
  comprado,
  pecas,
  outfits,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  peca?: Peca
  /** Ao criar: marca "Já tenho esta peça" (peça) ou não (desejo). */
  comprado: boolean
  pecas: Peca[]
  outfits: Outfit[]
}) {
  const { usuario } = useSessao()
  const gravar = useGravarGuardaRoupa()
  const garantirColecao = useGarantirColecaoPecas()
  const entradaFoto = React.useRef<HTMLInputElement>(null)

  const [jaTenho, setJaTenho] = React.useState(comprado)
  const [nome, setNome] = React.useState("")
  const [tipo, setTipo] = React.useState("")
  const [cores, setCores] = React.useState<string[]>([])
  const [marca, setMarca] = React.useState("")
  const [tamanho, setTamanho] = React.useState("")
  const [valor, setValor] = React.useState("")
  const [site, setSite] = React.useState("")
  const [conservacao, setConservacao] = React.useState("")
  const [arquivo, setArquivo] = React.useState<File | null>(null)
  const [tirarFoto, setTirarFoto] = React.useState(false)
  const [erros, setErros] = React.useState<ErrosPeca>({})
  const [enviando, setEnviando] = React.useState(false)

  // Ao abrir (ou trocar de peça), começa do que está gravado. Uma recarga dos dados com a janela aberta
  // não pode apagar o que a pessoa já escreveu, por isso só reage a abrir ou a trocar de peça.
  React.useEffect(() => {
    if (!aberta) return
    setJaTenho(peca ? peca.comprado : comprado)
    setNome(peca?.nome ?? "")
    // Peça com mais de um tipo (ex.: "Moletom, Jaqueta") mantém o texto inteiro se a pessoa não mexer no tipo
    setTipo(peca ? (peca.tipos.length > 1 ? peca.tipos.join(", ") : (peca.tipo ?? "")) : "")
    setCores(peca?.cores ?? [])
    setMarca(peca?.marca ?? "")
    setTamanho(peca?.tamanho ?? "")
    setValor(peca?.valor !== null && peca?.valor !== undefined ? peca.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "")
    setSite(peca?.site ?? "")
    setConservacao(peca?.conservacao ?? "")
    setArquivo(null)
    setTirarFoto(false)
    setErros({})
    setEnviando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, peca?.id])

  const [previa, setPrevia] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!arquivo) return setPrevia(null)
    const url = URL.createObjectURL(arquivo)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const temFoto = Boolean(arquivo) || (!tirarFoto && Boolean(peca && (peca.foto || peca.fotoUrl)))

  const escolherFoto = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith("image/")) return toast.error("Escolha uma imagem (JPG, PNG ou WebP).")
    if (f.size > TAMANHO_MAXIMO_FOTO) return toast.error("A foto é grande demais. Use uma de até 20 MB.")
    setArquivo(f)
    setTirarFoto(false)
  }

  const retirarFoto = () => {
    setArquivo(null)
    setTirarFoto(true)
  }

  // As opções vêm das peças que já existem; o tipo composto de uma peça (ex.: "Moletom, Jaqueta") entra como opção própria
  const tipoComposto = peca && peca.tipos.length > 1 ? peca.tipos.join(", ") : null
  const opcoesTipo = [...(tipoComposto ? [tipoComposto] : []), ...opcoesCom(TIPOS_PECA, unicos(pecas.flatMap((p) => p.tipos)))]
  const opcoesCor = opcoesCom(CORES, unicos(pecas.flatMap((p) => p.cores)))
  const opcoesTamanho = opcoesCom(TAMANHOS, unicos(pecas.map((p) => p.tamanho)))
  const marcas = unicos(pecas.map((p) => p.marca))

  const titulo = peca ? (jaTenho ? "Editar peça" : "Editar desejo") : jaTenho ? "Nova peça" : "Novo desejo"
  // Foco no nome só com mouse: no celular, o teclado subiria por cima do formulário logo ao abrir
  const focoNoNome = !peca && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches
  const idForm = "form-peca"

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    const novosErros = validarPeca({ nome, valor, site })
    setErros(novosErros)
    // O foco vai para o primeiro campo com erro: a janela rola até ele, mesmo se a pessoa salvou lá embaixo
    const primeiroErro = novosErros.nome ? "peca-nome" : novosErros.valor ? "peca-valor" : novosErros.site ? "peca-site" : null
    if (primeiroErro) {
      document.getElementById(primeiroErro)?.focus()
      return
    }

    const id = peca?.id ?? crypto.randomUUID()
    const nomeLimpo = nome.trim()
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
    setEnviando(false)

    const campos = {
      tipo: tipo || null,
      cores,
      marca,
      tamanho,
      conservacao: conservacao || null,
      comprado: jaTenho,
      valor: valor.trim() ? lerValorDigitado(valor) : null,
      site,
    }
    const aplicar = (atual: Record<string, Json> | null) => {
      const props = propsDaPeca(atual, campos)
      // A foto nova (ou a retirada) vale no lugar da que veio do Notion
      if (caminho !== undefined) delete props[COL.foto]
      return props
    }

    if (peca) {
      // Se o nome mudou, os outfits que usam esta peça passam a mostrar o nome novo
      const outfitsAfetados = nomeLimpo !== peca.nome ? outfitsDaPeca(peca.id, outfits) : []
      void gravar.mudar(
        peca.item,
        (atual) => ({
          title: nomeLimpo,
          props: aplicar((atual.props ?? null) as Record<string, Json> | null),
          ...(caminho !== undefined ? { cover_path: caminho } : {}),
        }),
        "pecas",
      )
      for (const o of outfitsAfetados) {
        void gravar.mudar(
          o.item,
          (atual) => ({
            props: propsDoOutfit((atual.props ?? null) as Record<string, Json> | null, {
              pecas: o.pecas.map((p) => (p.id === peca.id ? { ...p, nome: nomeLimpo } : p)),
              lugares: o.lugares,
              horas: o.horas,
              climas: o.climas,
            }),
          }),
          "outfits",
        )
      }
      toast.success("Alterações salvas")
    } else {
      void gravar
        .criar("pecas", { id, title: nomeLimpo, props: aplicar(null), cover_path: caminho ?? null, position: Date.now() })
        .catch(() => undefined)
      toast.success(jaTenho ? `“${nomeLimpo}” está nas peças` : `“${nomeLimpo}” está nos desejos`)
    }
    aoMudar(false)
  }

  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !enviando && aoMudar(v)}
      titulo={titulo}
      largura="lg"
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={enviando}>
            {peca ? "Salvar" : "Adicionar"}
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-5" noValidate>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Foto</span>
          <div className="flex items-center gap-3">
            <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line">
              {previa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previa} alt="" className="absolute inset-0 size-full object-cover" />
              ) : temFoto && peca ? (
                <FotoPeca peca={peca} className="absolute inset-0" />
              ) : (
                <span aria-hidden className="absolute inset-0 grid place-items-center">
                  <IconeDoTipo tipo={tipo || null} className="size-8 text-ink-3" />
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {temFoto ? (
                <>
                  <Botao variante="contorno" tamanho="sm" onClick={() => entradaFoto.current?.click()}>
                    Trocar foto
                  </Botao>
                  <Botao variante="fantasma" tamanho="sm" onClick={retirarFoto}>
                    <Trash2 /> Tirar foto
                  </Botao>
                </>
              ) : (
                <Botao variante="contorno" tamanho="sm" onClick={() => entradaFoto.current?.click()}>
                  <ImagePlus /> Escolher foto
                </Botao>
              )}
            </div>
          </div>
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

        <Campo rotulo="Nome" htmlFor="peca-nome">
          <Entrada
            id="peca-nome"
            autoFocus={focoNoNome}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Camisa polo azul"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={erros.nome ? true : undefined}
            aria-describedby={erros.nome ? "peca-nome-erro" : undefined}
          />
          {erros.nome ? (
            <p id="peca-nome-erro" role="alert" className="text-sm text-danger">
              {erros.nome}
            </p>
          ) : null}
        </Campo>

        {/* O preço e o link vêm logo depois do nome: num desejo, são o que mais importa */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Valor (R$)" htmlFor="peca-valor">
            <Entrada
              id="peca-valor"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={erros.valor ? true : undefined}
              aria-describedby={erros.valor ? "peca-valor-erro" : undefined}
            />
            {erros.valor ? (
              <p id="peca-valor-erro" role="alert" className="text-sm text-danger">
                {erros.valor}
              </p>
            ) : null}
          </Campo>
          <Campo rotulo="Link da loja" htmlFor="peca-site">
            <Entrada
              id="peca-site"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={erros.site ? true : undefined}
              aria-describedby={erros.site ? "peca-site-erro" : undefined}
            />
            {erros.site ? (
              <p id="peca-site-erro" role="alert" className="text-sm text-danger">
                {erros.site}
              </p>
            ) : null}
          </Campo>
        </div>

        <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={jaTenho} onChange={(e) => setJaTenho(e.target.checked)} className="size-4 accent-pen" />
          Já tenho esta peça
        </label>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Tipo</span>
          <EscolhaPilulas
            rotulo="Tipo"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[...opcoesTipo.map((t) => ({ id: t, rotulo: t })), { id: "", rotulo: "Nenhum" }]}
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink-2">Cor</span>
          <EscolhaVarias rotulo="Cor" opcoes={opcoesCor} valores={cores} aoMudar={setCores} comCor />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tamanho" htmlFor="peca-tamanho">
            <Entrada id="peca-tamanho" list="lista-tamanhos" value={tamanho} onChange={(e) => setTamanho(e.target.value)} autoComplete="off" enterKeyHint="done" />
            <datalist id="lista-tamanhos">
              {opcoesTamanho.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Marca" htmlFor="peca-marca">
            <Entrada id="peca-marca" list="lista-marcas" value={marca} onChange={(e) => setMarca(e.target.value)} autoComplete="off" enterKeyHint="done" />
            <datalist id="lista-marcas">
              {marcas.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Campo>
        </div>

        {jaTenho ? (
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink-2">Conservação</span>
            <EscolhaPilulas
              rotulo="Conservação"
              valor={conservacao}
              aoMudar={setConservacao}
              opcoes={[...CONSERVACOES.map((c) => ({ id: c, rotulo: c })), { id: "", rotulo: "Nenhuma" }]}
            />
          </div>
        ) : null}
      </form>
    </Janela>
  )
}
