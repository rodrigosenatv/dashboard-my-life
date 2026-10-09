"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, FileArchive, ImageUp, LoaderCircle, LogOut, Upload } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Progresso, Secao, Segmentos } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { useSessao, useTema, type Tema } from "@/components/provedores"
import { InstalarApp } from "@/components/pwa"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"
import { novoId } from "@/lib/data"
import { numero } from "@/lib/utils"
import { useConfiguracoes, useSalvarConfiguracoes, type Preferencias } from "./dados"
import { ChavesIA } from "./chaves-ia"
import { FRASE_PADRAO } from "@/features/hoje/painel"
import { abrirZip } from "@/features/importar/zip"
import { montarPlano, resumoPlano, type Plano } from "@/features/importar/notion"
import { executarImportacao, exportarTudo, type Progresso as EstadoProgresso } from "@/features/importar/executar"

const TAMANHO_MAXIMO_CAPA = 8 * 1024 * 1024

export function PaginaConfiguracoes() {
  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Configurações" descricao="Seu perfil, a aparência do app, as chaves de IA e a importação do Notion." />
      <div className="grid gap-12">
        <Perfil />
        <Aparencia />
        <InstalarApp />
        <div id="ia" className="scroll-mt-6">
          <ChavesIA />
        </div>
        <ImportarNotion />
        <CopiaSeguranca />
        <Conta />
      </div>
    </div>
  )
}

function Perfil() {
  const { data, isLoading } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  const [nome, setNome] = React.useState<string | null>(null)
  const valor = nome ?? data?.display_name ?? ""

  return (
    <Secao titulo="Perfil" descricao="O nome usado na saudação da página Hoje.">
      <form
        className="flex max-w-md items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate({ display_name: valor.trim() || null }, { onSuccess: () => toast.success("Nome salvo") })
        }}
      >
        <Campo rotulo="Como quer ser chamado" htmlFor="cfg-nome" className="flex-1">
          <Entrada id="cfg-nome" value={valor} disabled={isLoading} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Botao type="submit" variante="contorno" disabled={salvar.isPending}>Salvar</Botao>
      </form>
    </Secao>
  )
}

function Aparencia() {
  const { tema, mudarTema } = useTema()
  const { usuario } = useSessao()
  const { data: cfg } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()
  const prefs = (cfg?.prefs ?? {}) as Preferencias & { frase?: string; capa?: string }
  const [frase, setFrase] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)
  const entradaCapa = React.useRef<HTMLInputElement>(null)
  const valorFrase = frase ?? prefs.frase ?? FRASE_PADRAO

  const arquivos = () => supabase().storage.from(BUCKET_ARQUIVOS)

  const salvarPrefs = (mudancas: Record<string, string | null>, aviso: string, depois?: { deuCerto?: () => void; falhou?: () => void }) =>
    salvar.mutate(
      { prefs: mudancas },
      {
        onSuccess: () => {
          toast.success(aviso)
          depois?.deuCerto?.()
        },
        onError: () => depois?.falhou?.(),
      },
    )

  async function enviarCapa(arquivo: File) {
    if (!usuario) return
    if (!arquivo.type.startsWith("image/")) return toast.error("Escolha uma imagem (PNG, JPG ou WebP).")
    if (arquivo.size > TAMANHO_MAXIMO_CAPA) return toast.error("A imagem é grande demais. Use uma de até 8 MB.")
    setEnviando(true)
    try {
      const ext = arquivo.name.split(".").pop()?.toLowerCase() || "png"
      const caminho = `${usuario.id}/capa/capa-${Date.now()}.${ext}`
      const { error } = await arquivos().upload(caminho, arquivo, { contentType: arquivo.type })
      if (error) throw new Error(error.message)
      // A imagem antiga só sai depois que a nova estiver gravada nas preferências; se gravar falhar, a nova é que sai
      const antiga = prefs.capa
      salvarPrefs({ capa: caminho }, "Capa atualizada", {
        deuCerto: () => {
          if (antiga) void arquivos().remove([antiga])
        },
        falhou: () => void arquivos().remove([caminho]),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a imagem.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Secao titulo="Aparência">
      <div className="grid gap-6">
        <Segmentos<Tema>
          rotulo="Tema"
          valor={tema}
          aoMudar={mudarTema}
          opcoes={[
            { valor: "escuro", rotulo: "Escuro" },
            { valor: "claro", rotulo: "Claro" },
            { valor: "sistema", rotulo: "Igual ao sistema" },
          ]}
        />
        <form
          className="flex max-w-xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            salvarPrefs({ frase: valorFrase.trim() || null }, "Frase salva")
          }}
        >
          <Campo rotulo="Frase da capa" htmlFor="cfg-frase" className="flex-1">
            <Entrada id="cfg-frase" value={valorFrase} onChange={(e) => setFrase(e.target.value)} />
          </Campo>
          <Botao type="submit" variante="contorno" disabled={salvar.isPending}>Salvar</Botao>
        </form>
        <div>
          <p className="mb-1.5 text-sm font-medium">Imagem de capa</p>
          <p className="mb-3 text-sm text-ink-3">Use a capa do seu Notion ou qualquer imagem larga. Sem imagem, a capa mostra o nome e a frase.</p>
          <input
            ref={entradaCapa}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Imagem de capa"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void enviarCapa(f)
              e.target.value = ""
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={() => entradaCapa.current?.click()} disabled={enviando}>
              {enviando ? <LoaderCircle className="animate-spin" /> : <ImageUp />} {prefs.capa ? "Trocar imagem" : "Enviar imagem"}
            </Botao>
            {prefs.capa ? (
              <Botao
                variante="fantasma"
                onClick={() => {
                  const antiga = prefs.capa!
                  salvarPrefs({ capa: null }, "Capa removida", { deuCerto: () => void arquivos().remove([antiga]) })
                }}
              >
                Remover imagem
              </Botao>
            ) : null}
          </div>
        </div>
      </div>
    </Secao>
  )
}

type EstadoImportacao =
  | { fase: "parado" }
  | { fase: "lendo"; nome: string }
  | { fase: "pronto"; nome: string; plano: Plano; arquivos: Map<string, Uint8Array> }
  | { fase: "gravando"; progresso: EstadoProgresso }
  | { fase: "concluido"; avisos: string[]; total: number }
  | { fase: "erro"; mensagem: string }

function ImportarNotion() {
  const { usuario } = useSessao()
  const qc = useQueryClient()
  const entrada = React.useRef<HTMLInputElement>(null)
  const [estado, setEstado] = React.useState<EstadoImportacao>({ fase: "parado" })
  const [confirmar, setConfirmar] = React.useState(false)

  async function ler(arquivo: File) {
    if (!usuario) return
    setEstado({ fase: "lendo", nome: arquivo.name })
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      const arquivos = abrirZip(bytes)
      const plano = montarPlano(arquivos, { usuarioId: usuario.id, novoId })
      setEstado({ fase: "pronto", nome: arquivo.name, plano, arquivos })
    } catch (e) {
      setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível ler o arquivo." })
    }
  }

  async function gravar() {
    if (estado.fase !== "pronto" || !usuario) return
    const { plano, arquivos } = estado
    const total = resumoPlano(plano).reduce((s, r) => s + r.total, 0)
    setEstado({ fase: "gravando", progresso: { etapa: "Preparando", feito: 0, total: 1 } })
    try {
      const { avisos } = await executarImportacao({
        cliente: supabase(),
        plano,
        arquivos,
        usuarioId: usuario.id,
        aoProgredir: (progresso) => setEstado({ fase: "gravando", progresso }),
      })
      await qc.invalidateQueries()
      setEstado({ fase: "concluido", avisos: [...plano.avisos, ...avisos], total })
      toast.success("Importação concluída")
    } catch (e) {
      setEstado({ fase: "erro", mensagem: e instanceof Error ? e.message : "A importação falhou." })
    }
  }

  return (
    <Secao
      titulo="Importar do Notion"
      descricao="Envie o .zip da exportação do Notion (Markdown e CSV, com arquivos). A página Senhas fica de fora. Importar de novo substitui a importação anterior sem mexer no que você criou aqui."
    >
      <input
        ref={entrada}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        aria-label="Arquivo .zip da exportação do Notion"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void ler(f)
          e.target.value = ""
        }}
      />

      <div className="rounded-lg border border-line bg-surface p-4">
        {estado.fase === "parado" || estado.fase === "erro" || estado.fase === "concluido" ? (
          <div className="grid gap-3">
            {estado.fase === "erro" ? <p className="text-sm text-danger">{estado.mensagem}</p> : null}
            {estado.fase === "concluido" ? (
              <div className="text-sm">
                <p className="font-medium">{numero(estado.total)} registros importados.</p>
                {estado.avisos.length ? <Avisos avisos={estado.avisos} /> : null}
              </div>
            ) : null}
            <div>
              <Botao variante="primario" onClick={() => entrada.current?.click()}>
                <Upload /> Escolher arquivo .zip
              </Botao>
            </div>
          </div>
        ) : null}

        {estado.fase === "lendo" ? (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <LoaderCircle className="size-4 animate-spin" /> Lendo {estado.nome}
          </p>
        ) : null}

        {estado.fase === "pronto" ? (
          <div className="grid gap-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <FileArchive className="size-4 text-ink-3" /> {estado.nome}
            </p>
            <table className="w-full text-sm">
              <tbody>
                {resumoPlano(estado.plano).map((r) => (
                  <tr key={r.tabela} className="border-b border-line last:border-0">
                    <td className="py-1.5 text-ink-2">{r.nome}</td>
                    <td className="py-1.5 text-right tabular-nums">{numero(r.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 text-ink-2">Arquivos e imagens</td>
                  <td className="py-1.5 text-right tabular-nums">{numero(estado.plano.arquivos.length)}</td>
                </tr>
              </tbody>
            </table>
            {estado.plano.avisos.length ? <Avisos avisos={estado.plano.avisos} /> : null}
            <div className="flex gap-2">
              <Botao variante="primario" onClick={() => setConfirmar(true)}>Importar agora</Botao>
              <Botao variante="fantasma" onClick={() => setEstado({ fase: "parado" })}>Cancelar</Botao>
            </div>
          </div>
        ) : null}

        {estado.fase === "gravando" ? (
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" /> {estado.progresso.etapa}
            </p>
            <Progresso rotulo="Progresso da importação" valor={(estado.progresso.feito / Math.max(1, estado.progresso.total)) * 100} />
            <p className="text-xs text-ink-3">Mantenha esta aba aberta até terminar.</p>
          </div>
        ) : null}
      </div>

      <Confirmar
        aberta={confirmar}
        aoMudar={setConfirmar}
        titulo="Importar do Notion?"
        descricao="Os dados de uma importação anterior serão substituídos por estes. O que você criou direto no app continua como está."
        acao="Importar"
        aoConfirmar={() => {
          setConfirmar(false)
          void gravar()
        }}
      />
    </Secao>
  )
}

function Avisos({ avisos }: { avisos: string[] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-ink-2">{avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`}</summary>
      <ul className="mt-2 grid max-h-60 gap-1 overflow-auto text-xs text-ink-3">
        {avisos.map((a, i) => <li key={i}>{a}</li>)}
      </ul>
    </details>
  )
}

function CopiaSeguranca() {
  const [baixando, setBaixando] = React.useState(false)
  async function baixar() {
    setBaixando(true)
    try {
      const dados = await exportarTudo(supabase())
      const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), dados }, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `my-life-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a cópia.")
    } finally {
      setBaixando(false)
    }
  }
  return (
    <Secao titulo="Cópia de segurança" descricao="Baixe todos os seus dados em um arquivo JSON.">
      <Botao variante="contorno" onClick={baixar} disabled={baixando}>
        {baixando ? <LoaderCircle className="animate-spin" /> : <Download />} Baixar dados
      </Botao>
    </Secao>
  )
}

function Conta() {
  const { usuario, sair } = useSessao()
  return (
    <Secao titulo="Conta">
      <p className="mb-3 text-sm text-ink-2">Conectado como {usuario?.email}</p>
      <Botao variante="contorno" onClick={() => void sair()}>
        <LogOut /> Sair
      </Botao>
    </Secao>
  )
}
