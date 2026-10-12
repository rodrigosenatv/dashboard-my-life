"use client"

import Link from "next/link"
import * as React from "react"
import { BookOpen, Cloud, CloudOff, Download, FilePlus2, FileUp, HardDrive, MoreHorizontal, RefreshCw, Trash } from "lucide-react"
import { toast } from "sonner"
import { Botao, estiloBotao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import type { Tables } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { apagarLivroLocal, lerLivroLocal, lerOriginal } from "./armazenamento"
import { useAtualizarDisponibilidade, useDisponibilidade, usePosicaoLocal } from "./dados"
import { DialogoArquivo, tamanhoLegivel } from "./dialogo-arquivo"
import { apagarLivroNuvem, baixarLivroNuvem, enviarLivroNuvem } from "./nuvem"

type Livro = Tables<"books">

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Bloco da tela do livro: abrir no leitor, adicionar ou gerenciar o arquivo. */
export function SecaoLivroDigital({ livro }: { livro: Livro }) {
  const disponivel = useDisponibilidade()(livro.id)
  const { data: posicao } = usePosicaoLocal(livro.id)
  const atualizar = useAtualizarDisponibilidade()
  const [dialogo, setDialogo] = React.useState(false)
  const [reconverter, setReconverter] = React.useState<File | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  // O PDF original fica guardado no aparelho para converter de novo quando o conversor melhorar
  const { data: original } = useQuery({
    queryKey: ["leitor", "original", livro.id],
    queryFn: async () => {
      const o = await lerOriginal(livro.id).catch(() => undefined)
      return o ? new File([o.arquivo], o.nome || "livro.pdf", { type: "application/pdf" }) : null
    },
    staleTime: Infinity,
  })

  const acao = async (fn: () => Promise<void>, ok: string) => {
    setOcupado(true)
    try {
      await fn()
      toast.success(ok)
    } catch (erro) {
      toast.error("Não deu certo.", { description: erro instanceof Error ? erro.message : undefined })
    } finally {
      setOcupado(false)
      atualizar()
    }
  }

  const enviarParaNuvem = () =>
    acao(async () => {
      const local = await lerLivroLocal(livro.id)
      if (!local) throw new Error("O arquivo não está neste aparelho.")
      await enviarLivroNuvem(livro.id, local.arquivo, local.nome)
    }, "Cópia guardada na nuvem.")

  const baixarArquivo = () =>
    acao(async () => {
      const local = await lerLivroLocal(livro.id)
      if (local) return baixar(local.arquivo, local.nome)
      if (!disponivel.naNuvem) throw new Error("Arquivo não encontrado.")
      baixar(await baixarLivroNuvem(disponivel.naNuvem), disponivel.naNuvem.name)
    }, "Download iniciado.")

  const porcentagem = posicao ? Math.round(posicao.fracao * 100) : null

  return (
    <Secao titulo="Livro digital">
      {disponivel.temArquivo ? (
        <div className="grid gap-3 rounded-lg border border-line bg-surface p-3 sm:flex sm:items-center">
          <Link href={`/ler/${livro.id}`} className={cn(estiloBotao({ variante: "primario", tamanho: "lg" }), "w-full sm:w-auto sm:min-w-44")}>
            <BookOpen /> {porcentagem ? "Continuar lendo" : "Ler"}
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
              {porcentagem !== null ? (
                <span className="tabular font-medium">
                  {porcentagem}% lido{posicao?.pagina ? ` · página ${posicao.pagina}` : ""}
                </span>
              ) : null}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-3">
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="size-3.5" /> {disponivel.noAparelho ? "Neste aparelho" : "Ainda não baixado aqui"}
                </span>
                <span className="inline-flex items-center gap-1">
                  {disponivel.naNuvem ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}
                  {disponivel.naNuvem ? `Na nuvem · ${tamanhoLegivel(disponivel.naNuvem.size ?? 0)}` : "Sem cópia na nuvem"}
                </span>
              </span>
            </div>
            <Menu>
              <MenuGatilho asChild>
                <Botao variante="fantasma" tamanho="icone" aria-label="Opções do arquivo" disabled={ocupado}>
                  <MoreHorizontal />
                </Botao>
              </MenuGatilho>
              <MenuConteudo>
                <MenuItem
                  onSelect={() => {
                    setReconverter(null)
                    setDialogo(true)
                  }}
                >
                  <FileUp /> Trocar arquivo
                </MenuItem>
                {original ? (
                  <MenuItem
                    onSelect={() => {
                      setReconverter(original)
                      setDialogo(true)
                    }}
                  >
                    <RefreshCw /> Converter o PDF de novo
                  </MenuItem>
                ) : null}
                <MenuItem onSelect={() => void baixarArquivo()}>
                  <Download /> Baixar o arquivo
                </MenuItem>
                {disponivel.noAparelho && !disponivel.naNuvem ? (
                  <MenuItem onSelect={() => void enviarParaNuvem()}>
                    <Cloud /> Guardar cópia na nuvem
                  </MenuItem>
                ) : null}
                <MenuSeparador />
                {disponivel.naNuvem ? (
                  <MenuItem perigo onSelect={() => void acao(() => apagarLivroNuvem(livro.id), "Cópia da nuvem apagada.")}>
                    <CloudOff /> Apagar cópia da nuvem
                  </MenuItem>
                ) : null}
                {disponivel.noAparelho ? (
                  <MenuItem perigo onSelect={() => void acao(() => apagarLivroLocal(livro.id), "Arquivo tirado deste aparelho.")}>
                    <Trash /> Tirar deste aparelho
                  </MenuItem>
                ) : null}
              </MenuConteudo>
            </Menu>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong px-4 py-4">
          <p className="max-w-md text-sm text-ink-2">
            Leia o PDF ou EPUB deste livro aqui no app, com o texto se ajustando à tela e a página em que parou guardada.
          </p>
          <Botao variante="primario" onClick={() => setDialogo(true)}>
            <FilePlus2 /> Adicionar PDF ou EPUB
          </Botao>
        </div>
      )}
      <DialogoArquivo aberta={dialogo} aoMudar={setDialogo} livro={livro} arquivoInicial={reconverter} />
    </Secao>
  )
}
