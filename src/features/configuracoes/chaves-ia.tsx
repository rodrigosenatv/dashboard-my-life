"use client"

import * as React from "react"
import { Check, ChevronDown, ExternalLink, KeyRound, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { PROVEDORES, type InfoProvedor } from "@/lib/ia/info"
import { provedoresAtivos, salvarConfigIA, useConfigIA } from "@/lib/ia/chaves-locais"
import { useSessao } from "@/components/provedores"

function LinhaProvedor({ p }: { p: InfoProvedor }) {
  const cfg = useConfigIA()
  const { usuario } = useSessao()
  const atual = cfg.provedores[p.id]
  const [chave, setChave] = React.useState("")
  const [modelo, setModelo] = React.useState<string | null>(null)
  const [testando, setTestando] = React.useState(false)
  const valorModelo = modelo ?? atual?.modelo ?? ""
  const padrao = provedoresAtivos(cfg)[0] === p.id

  const gravar = (novaChave: string | null) => {
    const provedores = { ...cfg.provedores }
    if (novaChave === null) delete provedores[p.id]
    else provedores[p.id] = { chave: novaChave, modelo: valorModelo.trim() || undefined }
    salvarConfigIA({ padrao: novaChave === null && cfg.padrao === p.id ? undefined : cfg.padrao, provedores }, usuario?.id ?? null)
  }

  const testar = async (k: string, m: string) => {
    setTestando(true)
    try {
      const r = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teste: true, provedor: p.id, chave: k, modelo: m }) })
      const corpo = await r.json().catch(() => ({}))
      if (corpo.ok) toast.success(p.id === "openrouter" && corpo.modelo ? `${p.nome} respondeu pelo modelo ${corpo.modelo}. A chave funciona.` : `${p.nome} respondeu. A chave funciona.`)
      else toast.error(`${p.nome}: ${corpo.erro ?? `erro ${r.status}`}`)
    } finally {
      setTestando(false)
    }
  }

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="font-medium">
          {p.nome} <span className="font-normal text-ink-3">· {p.empresa}</span>
        </p>
        {atual?.chave ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rotina-soft px-2 py-0.5 text-xs font-medium text-rotina">
            <Check className="size-3" /> Chave salva, final {atual.chave.slice(-4)}
          </span>
        ) : (
          <span className="text-xs text-ink-3">Sem chave</span>
        )}
        <a href={p.painel} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-pen hover:underline">
          Criar chave <ExternalLink className="size-3" />
        </a>
      </div>
      <form
        className={p.id === "openrouter" ? "grid gap-3 sm:grid-cols-[1fr_18rem]" : "grid gap-3 sm:grid-cols-[1fr_12rem]"}
        onSubmit={(e) => {
          e.preventDefault()
          const k = chave.trim() || atual?.chave
          if (!k) return
          gravar(k)
          setChave("")
          setModelo(null)
          toast.success(`Chave do ${p.nome} salva neste navegador.`)
        }}
      >
        <Campo rotulo={atual?.chave ? "Trocar chave" : "Chave de API"} htmlFor={`ia-${p.id}`} dica={p.dica}>
          <Entrada
            id={`ia-${p.id}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder={atual?.chave ? `•••• ${atual.chave.slice(-4)}` : "Cole a chave aqui"}
          />
        </Campo>
        <Campo
          rotulo="Modelo"
          htmlFor={`ia-m-${p.id}`}
          dica={p.id === "openrouter" ? "“auto” usa sempre o gratuito mais avançado e troca sozinho quando um atinge o limite ou sai do ar. Ou liste modelos em ordem, separados por vírgula (pode incluir auto no fim)." : `Ex.: ${p.exemploModelos}`}
        >
          <Entrada id={`ia-m-${p.id}`} value={valorModelo} onChange={(e) => setModelo(e.target.value)} placeholder={p.modeloPadrao} spellCheck={false} />
        </Campo>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Botao type="submit" variante="primario" tamanho="sm" disabled={!chave.trim() && !(atual?.chave && modelo !== null)}>
            Salvar
          </Botao>
          <Botao
            type="button"
            variante="contorno"
            tamanho="sm"
            disabled={testando || !(chave.trim() || atual?.chave)}
            onClick={() => testar(chave.trim() || atual!.chave, valorModelo.trim() || p.modeloPadrao)}
          >
            {testando ? <LoaderCircle className="animate-spin" /> : null} Testar
          </Botao>
          {atual?.chave ? (
            <>
              <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-sm text-ink-2">
                <input
                  type="radio"
                  name="ia-padrao"
                  checked={padrao}
                  onChange={() => salvarConfigIA({ ...cfg, padrao: p.id }, usuario?.id ?? null)}
                  className="accent-[var(--pen)]"
                />
                Usar por padrão
              </label>
              <Botao
                type="button"
                variante="fantasma"
                tamanho="sm"
                className="ml-auto text-danger hover:text-danger"
                onClick={() => {
                  gravar(null)
                  toast.success(`Chave do ${p.nome} removida deste navegador.`)
                }}
              >
                Remover
              </Botao>
            </>
          ) : null}
        </div>
      </form>
      {p.id === "openrouter" ? <OrdemGratuitos /> : null}
    </li>
  )
}

type Gratuito = { id: string; nome: string; contexto: number }

/** Mostra em que ordem o modo automático vai tentar os modelos gratuitos agora. */
function OrdemGratuitos() {
  const [aberta, setAberta] = React.useState(false)
  const [estado, setEstado] = React.useState<{ carregando: boolean; modelos?: Gratuito[]; erro?: string }>({ carregando: false })

  const alternar = async () => {
    const abrir = !aberta
    setAberta(abrir)
    if (!abrir || estado.modelos || estado.carregando) return
    setEstado({ carregando: true })
    try {
      const r = await fetch("/api/ia/gratuitos")
      const corpo = await r.json().catch(() => ({}))
      setEstado(r.ok && Array.isArray(corpo.modelos) ? { carregando: false, modelos: corpo.modelos } : { carregando: false, erro: corpo.erro ?? `Erro ${r.status}` })
    } catch {
      setEstado({ carregando: false, erro: "Sem conexão. Tente de novo." })
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button type="button" onClick={alternar} aria-expanded={aberta} className="inline-flex min-h-9 items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ChevronDown className={`size-4 transition-transform ${aberta ? "rotate-180" : ""}`} />
        Ordem atual dos modelos gratuitos
      </button>
      {aberta ? (
        <div className="mt-2">
          {estado.carregando ? (
            <p className="flex items-center gap-2 text-sm text-ink-3" role="status">
              <LoaderCircle className="size-4 animate-spin" /> Consultando o OpenRouter…
            </p>
          ) : estado.erro ? (
            <p className="text-sm text-danger">{estado.erro}</p>
          ) : (
            <>
              <ol className="grid gap-1 text-sm">
                {estado.modelos?.map((m, i) => (
                  <li key={m.id} className="flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1 odd:bg-surface-2/60">
                    <span className="w-5 shrink-0 text-right tabular-nums text-ink-3">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate" title={m.id}>
                      {m.nome.replace(/\s*\(free\)\s*$/i, "")}
                      <span className="ml-2 hidden font-mono text-xs text-ink-3 sm:inline">{m.id}</span>
                    </span>
                    {m.contexto ? <span className="shrink-0 text-xs tabular-nums text-ink-3">{Math.round(m.contexto / 1000)}k</span> : null}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-ink-3">
                A ordem é estimada pelo preço da versão paga de cada modelo, tamanho, raciocínio, contexto e data de lançamento, e é atualizada a cada 30 minutos. Cada troca de modelo gasta um pedido da cota gratuita (cerca de 50 por dia sem créditos comprados).
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function ChavesIA() {
  return (
    <Secao
      titulo="Inteligência artificial"
      descricao="Conecte sua própria conta do Claude, ChatGPT, Gemini ou OpenRouter (este com modelos gratuitos). Cada pessoa é responsável pelo consumo da sua API."
    >
      <p className="mb-4 flex gap-2 rounded-lg border border-line bg-surface-2/60 p-3 text-sm text-ink-2">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <span>
          Cada usuário cria sua própria chave e responde pelo consumo, custos ou franquia oferecidos pelo provedor. Assinaturas de chat não necessariamente incluem créditos de API. As chaves ficam somente neste navegador, não no banco de dados; ao sair da conta ou limpar os dados do navegador, elas são apagadas.
        </span>
      </p>
      <ul className="grid gap-3">
        {PROVEDORES.map((p) => (
          <LinhaProvedor key={p.id} p={p} />
        ))}
      </ul>
    </Secao>
  )
}
