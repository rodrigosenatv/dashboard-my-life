"use client"

import * as React from "react"
import {
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  LoaderCircle,
  Paperclip,
  Presentation,
  Trash,
  Upload,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Confirmar } from "@/components/ui/janela"
import { Menu, MenuConteudo, MenuGatilho, MenuItem, MenuSeparador } from "@/components/ui/menu"
import { useUrlArquivo } from "@/lib/arquivos"
import { copiarTexto } from "@/lib/copiar"
import { cn } from "@/lib/utils"
import { IconePlataforma } from "./capa"
import { apagarMateriais, enviarMaterialDoCurso, linkParaBaixar, useDesfazerNotas, useMudarNotas } from "./dados"
import {
  adicionarArquivos,
  adicionarLink,
  arquivoPermitido,
  ehMaterialEnviado,
  EXTENSOES_DE_MATERIAL,
  normalizarLink,
  plataformaDoLink,
  plural,
  removerMaterial,
  TAMANHO_MAXIMO_MATERIAL,
  type Curso,
  type Material,
} from "./logica"

/** Quantos materiais aparecem antes de "Ver todos". */
const VISIVEIS = 6

const ICONE_DO_TIPO: Record<string, LucideIcon> = {
  PDF: FileText,
  Documento: FileText,
  Texto: FileText,
  Livro: FileText,
  Planilha: FileSpreadsheet,
  Apresentação: Presentation,
  Imagem: FileImage,
  Áudio: FileAudio,
  Vídeo: FileVideo,
  Compactado: FileArchive,
}

const CAMPO =
  "h-10 w-full min-w-0 rounded-xl border border-[var(--b-borda)] bg-ink/[0.04] px-3 text-[16px] text-ink placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none sm:text-sm toque:h-11"

const LINHA = "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--b-luz)]/50"

function Miolo({ icone, titulo, detalhe }: { icone: React.ReactNode; titulo: string; detalhe: string }) {
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--b-luz)]/12 text-[var(--b-luz)] [&_svg]:size-4">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{titulo}</span>
        {detalhe ? <span className="block truncate text-xs text-ink-3">{detalhe}</span> : null}
      </span>
    </>
  )
}

/** Um link guardado: abre em outra aba; no menu, copiar e tirar. */
function ItemLink({ material: m, aoTirar }: { material: Material; aoTirar: () => void }) {
  return (
    <li className="flex items-center gap-0.5">
      <a href={m.url} target="_blank" rel="noopener noreferrer" className={LINHA}>
        <Miolo icone={<IconePlataforma id={plataformaDoLink(m.url)?.id ?? "site"} />} titulo={m.titulo} detalhe={m.detalhe} />
      </a>
      <Menu>
        <MenuGatilho asChild>
          <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Mais opções de ${m.titulo}`}>
            <Ellipsis />
          </Botao>
        </MenuGatilho>
        <MenuConteudo className="tema-cursos w-48">
          <MenuItem asChild>
            <a href={m.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Abrir
            </a>
          </MenuItem>
          <MenuItem
            onSelect={async () => {
              if (await copiarTexto(m.url)) toast.success("Link copiado.")
              else toast.error("Não foi possível copiar.")
            }}
          >
            <Copy /> Copiar link
          </MenuItem>
          <MenuSeparador />
          <MenuItem perigo onSelect={aoTirar}>
            <Trash /> Tirar da lista
          </MenuItem>
        </MenuConteudo>
      </Menu>
    </li>
  )
}

/** Um arquivo guardado: abre em outra aba (o endereço é temporário); no menu, baixar e excluir. */
function ItemArquivo({ material: m, enviado, aoTirar }: { material: Material; enviado: boolean; aoTirar: () => void }) {
  const { data: url, isError } = useUrlArquivo(m.caminho)
  const Icone = ICONE_DO_TIPO[m.detalhe] ?? File
  const baixar = async () => {
    try {
      window.location.assign(await linkParaBaixar(m.caminho ?? "", m.titulo))
    } catch {
      toast.error("Não foi possível baixar o arquivo.")
    }
  }
  return (
    <li className="flex items-center gap-0.5">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={LINHA}>
          <Miolo icone={<Icone aria-hidden />} titulo={m.titulo} detalhe={m.detalhe} />
        </a>
      ) : (
        <span className={cn(LINHA, "hover:bg-transparent", !isError && "animate-pulse")} aria-busy={!isError}>
          <Miolo icone={<Icone aria-hidden />} titulo={m.titulo} detalhe={isError ? "Arquivo não encontrado" : m.detalhe} />
        </span>
      )}
      <Menu>
        <MenuGatilho asChild>
          <Botao variante="fantasma" tamanho="icone-sm" aria-label={`Mais opções de ${m.titulo}`}>
            <Ellipsis />
          </Botao>
        </MenuGatilho>
        <MenuConteudo className="tema-cursos w-48">
          {url ? (
            <MenuItem asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Abrir
              </a>
            </MenuItem>
          ) : null}
          {!isError ? (
            <MenuItem onSelect={() => void baixar()}>
              <Download /> Baixar
            </MenuItem>
          ) : null}
          {url || !isError ? <MenuSeparador /> : null}
          <MenuItem perigo onSelect={aoTirar}>
            <Trash /> {enviado ? "Excluir arquivo" : "Tirar da lista"}
          </MenuItem>
        </MenuConteudo>
      </Menu>
    </li>
  )
}

/** Guardar um link: o endereço e, se quiser, um nome. */
function FormularioLink({ aoSalvar, aoCancelar }: { aoSalvar: (url: string, titulo: string) => void; aoCancelar: () => void }) {
  const [url, setUrl] = React.useState("")
  const [titulo, setTitulo] = React.useState("")
  const [erro, setErro] = React.useState(false)
  const idErro = React.useId()

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const pronto = normalizarLink(url)
    if (!pronto) return setErro(true)
    aoSalvar(pronto, titulo)
  }

  return (
    <form onSubmit={salvar} className="mt-3 grid gap-2" noValidate onKeyDown={(e) => e.key === "Escape" && aoCancelar()}>
      <input
        value={url}
        onChange={(e) => {
          setUrl(e.target.value)
          setErro(false)
        }}
        autoFocus
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="https://…"
        aria-label="Endereço do link"
        aria-invalid={erro}
        aria-describedby={erro ? idErro : undefined}
        className={cn(CAMPO, erro && "border-danger focus-visible:border-danger")}
      />
      {erro ? (
        <p id={idErro} role="alert" className="px-1 text-xs text-danger">
          Confira o endereço: precisa ser um link, como https://site.com
        </p>
      ) : null}
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nome (opcional)" aria-label="Nome do link" maxLength={120} className={CAMPO} />
      <div className="flex justify-end gap-2">
        <Botao variante="fantasma" tamanho="sm" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao variante="primario" tamanho="sm" type="submit" disabled={!url.trim()}>
          Guardar link
        </Botao>
      </div>
    </form>
  )
}

/**
 * Os links e os arquivos do curso (o grupo, o Drive, a apostila, a planilha): guardar, abrir, baixar e tirar.
 * Ficam nas anotações do curso, nas seções "Links" e "Materiais"; os arquivos vão para o storage. Dá para
 * soltar arquivos em cima do cartão.
 */
export function ListaMateriais({ curso, materiais }: { curso: Curso; materiais: Material[] }) {
  const mudar = useMudarNotas()
  const desfazer = useDesfazerNotas()
  const entrada = React.useRef<HTMLInputElement>(null)
  const [novoLink, setNovoLink] = React.useState(false)
  const [enviando, setEnviando] = React.useState<string[]>([])
  const [todos, setTodos] = React.useState(false)
  // O arquivo da pergunta continua guardado depois de ela fechar, para o título não sumir na saída
  const [excluir, setExcluir] = React.useState<Material | null>(null)
  const [perguntar, setPerguntar] = React.useState(false)
  const [soltando, setSoltando] = React.useState(false)
  const visiveis = todos ? materiais : materiais.slice(0, VISIVEIS)

  const enviar = async (lista: File[]) => {
    if (!lista.length || enviando.length) return
    const aceitos = lista.filter((a) => arquivoPermitido(a.name) && a.size > 0 && a.size <= TAMANHO_MAXIMO_MATERIAL)
    const recusados = lista.filter((a) => !aceitos.includes(a))
    if (recusados.length) {
      const grande = recusados.some((a) => a.size > TAMANHO_MAXIMO_MATERIAL)
      toast.error(recusados.length === 1 ? `“${recusados[0].name}” não foi guardado.` : `${recusados.length} arquivos não foram guardados.`, {
        description: grande ? "Cada arquivo pode ter até 50 MB." : "O curso guarda documentos, planilhas, apresentações, imagens, áudio, vídeo e compactados.",
      })
    }
    if (!aceitos.length) return
    setEnviando(aceitos.map((a) => a.name))
    const prontos: { nome: string; caminho: string }[] = []
    let falhas = 0
    for (const arquivo of aceitos) {
      try {
        prontos.push(await enviarMaterialDoCurso(arquivo, curso.id))
      } catch {
        falhas++
      }
      setEnviando((atual) => atual.slice(1))
    }
    setEnviando([])
    if (prontos.length) {
      mudar(curso, (t) => adicionarArquivos(t, prontos))
      setTodos(true)
      toast.success(prontos.length === 1 ? "Arquivo guardado no curso." : `${prontos.length} arquivos guardados no curso.`)
    }
    if (falhas) toast.error(falhas === 1 ? "Um arquivo não foi enviado." : `${falhas} arquivos não foram enviados.`, { description: "Confira a conexão e tente de novo." })
  }

  const tirar = (m: Material) => {
    // O arquivo enviado por aqui sai também do storage: pergunta antes, porque não tem volta
    if (m.tipo === "arquivo" && ehMaterialEnviado(m.caminho, curso.id)) {
      setExcluir(m)
      setPerguntar(true)
      return
    }
    const mudanca = mudar(curso, (t) => removerMaterial(t, m))
    if (!mudanca) return void toast.error("Esse item mudou de lugar nas anotações. Tente de novo.")
    toast(m.tipo === "link" ? "Link tirado." : "Arquivo tirado da lista.", { action: { label: "Desfazer", onClick: () => desfazer(curso, mudanca) } })
  }

  const temArquivos = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files")

  return (
    <section
      aria-labelledby="titulo-materiais"
      className={cn("vidro p-4 transition-shadow sm:p-5", soltando && "ring-2 ring-[var(--b-luz)]")}
      onDragOver={(e) => {
        if (!temArquivos(e)) return
        e.preventDefault()
        setSoltando(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false)
      }}
      onDrop={(e) => {
        if (!temArquivos(e)) return
        e.preventDefault()
        setSoltando(false)
        void enviar(Array.from(e.dataTransfer.files))
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-materiais" className="rotulo-hud flex items-center gap-2">
          <Paperclip className="size-3.5 text-[var(--b-luz)]" aria-hidden /> Links e arquivos
        </h2>
        {materiais.length ? <span className="tabular text-xs text-ink-3">{materiais.length}</span> : null}
      </div>

      {materiais.length ? (
        <ul className="-mx-2 mt-2 grid gap-0.5">
          {visiveis.map((m) =>
            m.tipo === "link" ? (
              <ItemLink key={`${m.linha}:${m.url}`} material={m} aoTirar={() => tirar(m)} />
            ) : (
              <ItemArquivo key={`${m.linha}:${m.url}`} material={m} enviado={ehMaterialEnviado(m.caminho, curso.id)} aoTirar={() => tirar(m)} />
            ),
          )}
        </ul>
      ) : !enviando.length ? (
        <p className="mt-2 text-sm text-ink-2">{soltando ? "Solte para guardar no curso." : "Guarde o que você usa no curso: o grupo, o Drive, a apostila, a planilha."}</p>
      ) : null}
      {materiais.length > VISIVEIS ? (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-1 min-h-9 rounded-full px-2 text-sm font-medium text-[var(--b-luz)] hover:bg-ink/[0.06] toque:min-h-11">
          {todos ? "Mostrar menos" : `Ver todos (${materiais.length})`}
        </button>
      ) : null}

      {enviando.length ? (
        <p role="status" className="mt-2 flex items-center gap-2.5 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-sm text-ink-2">
          <LoaderCircle className="size-4 shrink-0 animate-spin text-[var(--b-luz)] motion-reduce:animate-none" aria-hidden />
          <span className="min-w-0 truncate">
            Enviando {enviando[0]}
            {enviando.length > 1 ? ` e mais ${plural(enviando.length - 1, "arquivo")}` : ""}…
          </span>
        </p>
      ) : null}

      {novoLink ? (
        <FormularioLink
          aoCancelar={() => setNovoLink(false)}
          aoSalvar={(url, titulo) => {
            mudar(curso, (t) => adicionarLink(t, { url, titulo }))
            setNovoLink(false)
            setTodos(true)
            toast.success("Link guardado no curso.")
          }}
        />
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Botao variante="contorno" className="bg-transparent" onClick={() => setNovoLink(true)}>
            <Link2 /> Link
          </Botao>
          <Botao variante="contorno" className="bg-transparent" disabled={enviando.length > 0} onClick={() => entrada.current?.click()}>
            <Upload /> Arquivo
          </Botao>
        </div>
      )}
      <input
        ref={entrada}
        type="file"
        multiple
        accept={EXTENSOES_DE_MATERIAL}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? [])
          e.target.value = ""
          void enviar(lista)
        }}
      />

      <Confirmar
        aberta={perguntar}
        aoMudar={setPerguntar}
        className="tema-cursos"
        titulo={`Excluir “${excluir?.titulo ?? ""}”?`}
        descricao="O arquivo sai do curso e é apagado. Isso não tem volta."
        aoConfirmar={() => {
          const m = excluir
          if (!m?.caminho) return
          const caminho = m.caminho
          if (!mudar(curso, (t) => removerMaterial(t, m))) return void toast.error("Esse arquivo mudou de lugar nas anotações. Tente de novo.")
          apagarMateriais([caminho]).then(
            () => toast.success("Arquivo excluído."),
            () => toast.error("O arquivo saiu da lista, mas não foi apagado do armazenamento."),
          )
        }}
      />
    </section>
  )
}
