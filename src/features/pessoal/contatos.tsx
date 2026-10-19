"use client"

import * as React from "react"
import { BookUser, Mail, MapPin, MessageCircle, Phone, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Json } from "@/lib/supabase/database.types"
import { Botao } from "@/components/ui/button"
import { Secao, Vazio } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { Janela } from "@/components/ui/janela"
import { EscolhaPilulas } from "@/components/ui/pilulas"
import { primeiroNome } from "@/lib/utils"
import { Iniciais } from "./ui"
import { useGravarPessoal } from "./dados"
import { buscarContatos, categoriasDosContatos, type Contato, gravarCampo, juntarCategorias, linkEmail, linkLigar, linkMapa, linkWhatsApp } from "./logica"

const LIMITE_SEM_BUSCA = 6

/** Os contatos: busca, filtro por categoria e, em cada linha, ligar, mandar mensagem e e-mail. */
export function CartaoContatos({ contatos, aoNovo, aoEditar }: { contatos: Contato[]; aoNovo: () => void; aoEditar: (c: Contato) => void }) {
  const [busca, setBusca] = React.useState("")
  const [categoria, setCategoria] = React.useState("")
  const [todos, setTodos] = React.useState(false)
  const categorias = React.useMemo(() => categoriasDosContatos(contatos), [contatos])
  const filtrados = React.useMemo(() => buscarContatos(contatos, busca, categoria || null), [contatos, busca, categoria])
  const buscando = busca.trim() !== ""
  const visiveis = buscando || todos ? filtrados : filtrados.slice(0, LIMITE_SEM_BUSCA)

  return (
    <Secao
      titulo="Contatos"
      acao={
        <Botao variante="fantasma" tamanho="sm" onClick={aoNovo}>
          <Plus /> Novo contato
        </Botao>
      }
    >
      {!contatos.length ? (
        <Vazio
          icone={<BookUser />}
          titulo="Nenhum contato ainda."
          descricao="Guarde telefone, e-mail e endereço de quem é importante para você."
          acao={
            <Botao variante="primario" tamanho="sm" onClick={aoNovo}>
              <Plus /> Novo contato
            </Botao>
          }
        />
      ) : (
        <div className="rounded-xl border border-line bg-surface p-2 sm:p-3">
          {contatos.length > LIMITE_SEM_BUSCA ? (
            <div className="px-1 pb-2">
              <Entrada type="search" aria-label="Buscar contato" placeholder="Buscar contato" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          ) : null}
          {categorias.length >= 2 ? (
            <div className="px-1 pb-2">
              <EscolhaPilulas
                rotulo="Filtrar contatos por categoria"
                valor={categoria}
                aoMudar={setCategoria}
                opcoes={[{ id: "", rotulo: "Todos" }, ...categorias.map((c) => ({ id: c.nome, rotulo: c.nome }))]}
              />
            </div>
          ) : null}

          {filtrados.length ? (
            <ul className="grid">
              {visiveis.map((c) => (
                <LinhaContato key={c.id} contato={c} aoEditar={aoEditar} />
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-ink-2">Nenhum contato encontrado para “{busca.trim()}”.</p>
          )}

          {!buscando && filtrados.length > LIMITE_SEM_BUSCA ? (
            <div className="px-1 pt-1">
              <Botao variante="fantasma" tamanho="sm" onClick={() => setTodos((v) => !v)}>
                {todos ? "Mostrar menos" : `Mostrar todos (${filtrados.length})`}
              </Botao>
            </div>
          ) : null}
        </div>
      )}
    </Secao>
  )
}

/** Uma linha: o nome abre a janela de edição; os ícones ligam, mandam mensagem ou e-mail (só o que existe). */
function LinhaContato({ contato: c, aoEditar }: { contato: Contato; aoEditar: (c: Contato) => void }) {
  const ligar = linkLigar(c.celular)
  const whats = linkWhatsApp(c.celular)
  const email = linkEmail(c.email)
  // Cada ícone tem o seu lugar na linha, mesmo quando não existe: as colunas ficam alinhadas
  const vazio = <span aria-hidden className="size-8 shrink-0 toque:size-11" />
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2 toque:min-h-11">
      <button type="button" onClick={() => aoEditar(c)} className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left">
        <Iniciais nome={c.nome} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{c.nome}</span>
          {c.categorias.length ? <span className="block truncate text-xs text-ink-2">{c.categorias.join(", ")}</span> : null}
        </span>
      </button>
      {ligar ? (
        <Botao asChild variante="fantasma" tamanho="icone-sm">
          <a href={ligar} aria-label={`Ligar para ${c.nome}`}>
            <Phone />
          </a>
        </Botao>
      ) : vazio}
      {whats ? (
        <Botao asChild variante="fantasma" tamanho="icone-sm">
          <a href={whats} target="_blank" rel="noreferrer" aria-label={`Mandar mensagem para ${c.nome} no WhatsApp`}>
            <MessageCircle />
          </a>
        </Botao>
      ) : vazio}
      {email ? (
        <Botao asChild variante="fantasma" tamanho="icone-sm">
          <a href={email} aria-label={`Mandar e-mail para ${c.nome}`}>
            <Mail />
          </a>
        </Botao>
      ) : vazio}
    </li>
  )
}

/** Novo contato ou edição de um; a exclusão tem "Desfazer", como nos aniversários. */
export function FormContato({ aberta, aoMudar, contato, categorias }: { aberta: boolean; aoMudar: (v: boolean) => void; contato: Contato | null; categorias: string[] }) {
  const gravar = useGravarPessoal()
  const [nome, setNome] = React.useState("")
  const [celular, setCelular] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [endereco, setEndereco] = React.useState("")
  const [categoria, setCategoria] = React.useState("")
  const [erro, setErro] = React.useState<{ campo: "nome" | "email"; texto: string } | null>(null)
  const [salvando, setSalvando] = React.useState(false)

  // Ao abrir, começa do que está gravado (ou em branco, para um contato novo)
  React.useEffect(() => {
    if (!aberta) return
    setNome(contato?.nome === "Sem nome" ? "" : (contato?.nome ?? ""))
    setCelular(contato?.celular ?? "")
    setEmail(contato?.email ?? "")
    setEndereco(contato?.endereco ?? "")
    setCategoria(contato?.categorias.join(", ") ?? "")
    setErro(null)
    setSalvando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, contato?.id])

  /** Põe cada campo nas propriedades (na coluna que o item já usa); campo vazio sai do item. */
  const aplicar = (props: Record<string, Json>) => {
    gravarCampo(props, ["Celular", "Telefone", "WhatsApp", "Fone"], celular.trim())
    gravarCampo(props, ["E-mail", "Email"], email.trim())
    gravarCampo(props, ["Endereço", "Endereco"], endereco.trim())
    gravarCampo(props, ["Categoria", "Categorias", "Tags"], juntarCategorias(categoria))
    return props
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salvando) return
    const t = nome.trim()
    if (!t) return setErro({ campo: "nome", texto: "Escreva o nome." })
    if (email.trim() && !email.includes("@")) return setErro({ campo: "email", texto: "Confira o e-mail." })
    setErro(null)
    setSalvando(true)
    try {
      if (contato) {
        await gravar.mudar(contato.item, (atual) => ({ title: t, props: aplicar({ ...((atual.props ?? {}) as Record<string, Json>) }) }), "contatos")
        toast.success("Contato atualizado")
      } else {
        await gravar.criar("contatos", { title: t, props: aplicar({}) })
        toast.success(`${primeiroNome(t)} está nos contatos`)
      }
    } catch {
      // Quem grava já avisou o que deu errado
      setSalvando(false)
      return
    }
    setSalvando(false)
    aoMudar(false)
  }

  const excluir = () => {
    if (!contato) return
    const item = contato.item
    aoMudar(false)
    void gravar.excluir([item])
    toast.success("Contato excluído", {
      action: {
        label: "Desfazer",
        onClick: () => void gravar.criar("contatos", { id: item.id, title: item.title, props: (item.props ?? {}) as Record<string, Json>, content: item.content, position: item.position }).catch(() => undefined),
      },
    })
  }

  const idForm = "form-contato"
  const mapa = linkMapa(endereco)
  return (
    <Janela
      aberta={aberta}
      aoMudar={(v) => !salvando && aoMudar(v)}
      titulo={contato ? "Editar contato" : "Novo contato"}
      rodape={
        <>
          {contato ? (
            <Botao variante="fantasma" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" onClick={excluir} disabled={salvando}>
              <Trash2 /> Excluir
            </Botao>
          ) : null}
          <Botao variante="fantasma" onClick={() => aoMudar(false)} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao variante="primario" type="submit" form={idForm} disabled={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <form id={idForm} onSubmit={salvar} className="grid gap-4" noValidate>
        <Campo rotulo="Nome" htmlFor="contato-nome">
          <Entrada id="contato-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" aria-invalid={erro?.campo === "nome" || undefined} />
          {erro?.campo === "nome" ? <Erro texto={erro.texto} /> : null}
        </Campo>
        <Campo rotulo="Celular" htmlFor="contato-celular">
          <Entrada id="contato-celular" type="tel" inputMode="tel" autoComplete="off" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="Ex.: (71) 98888-1111" />
        </Campo>
        <Campo rotulo="E-mail" htmlFor="contato-email">
          <Entrada id="contato-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={erro?.campo === "email" || undefined} />
          {erro?.campo === "email" ? <Erro texto={erro.texto} /> : null}
        </Campo>
        <Campo
          rotulo="Endereço"
          htmlFor="contato-endereco"
          dica={
            mapa ? (
              <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-pen hover:underline">
                <MapPin className="size-3.5" aria-hidden /> Abrir no mapa
              </a>
            ) : undefined
          }
        >
          <Entrada id="contato-endereco" autoComplete="off" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </Campo>
        <Campo rotulo="Categoria" htmlFor="contato-categoria" dica="Ex.: Família. Separe por vírgula para mais de uma.">
          <Entrada id="contato-categoria" list="contato-categorias" autoComplete="off" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          <datalist id="contato-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
      </form>
    </Janela>
  )
}

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {texto}
    </p>
  )
}
