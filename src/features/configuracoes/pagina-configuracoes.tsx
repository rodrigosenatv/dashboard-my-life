"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, FileArchive, LoaderCircle, LogOut, Upload } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Cabecalho, Progresso, Secao, Segmentos } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Confirmar } from "@/components/ui/janela"
import { useSessao, useTema, type Tema } from "@/components/provedores"
import { supabase } from "@/lib/supabase/client"
import { novoId } from "@/lib/data"
import { numero } from "@/lib/utils"
import { useConfiguracoes, useSalvarConfiguracoes } from "./dados"
import { abrirZip } from "@/features/importar/zip"
import { montarPlano, resumoPlano, type Plano } from "@/features/importar/notion"
import { executarImportacao, exportarTudo, type Progresso as EstadoProgresso } from "@/features/importar/executar"

export function PaginaConfiguracoes() {
  return (
    <div className="max-w-3xl">
      <Cabecalho titulo="Configurações" descricao="Seu perfil, a aparência do app e a importação do Notion." />
      <div className="grid gap-12">
        <Perfil />
        <Aparencia />
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
  return (
    <Secao titulo="Aparência">
      <Segmentos<Tema>
        rotulo="Tema"
        valor={tema}
        aoMudar={mudarTema}
        opcoes={[
          { valor: "sistema", rotulo: "Igual ao sistema" },
          { valor: "claro", rotulo: "Claro" },
          { valor: "escuro", rotulo: "Escuro" },
        ]}
      />
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
