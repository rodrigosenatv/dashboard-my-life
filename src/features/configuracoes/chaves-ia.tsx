"use client"

import * as React from "react"
import { Check, ExternalLink, KeyRound, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { PROVEDORES, type InfoProvedor } from "@/lib/ia/info"
import { provedoresAtivos, salvarConfigIA, useConfigIA } from "@/lib/ia/chaves-locais"
import { cn } from "@/lib/utils"

function LinhaProvedor({ p }: { p: InfoProvedor }) {
  const cfg = useConfigIA()
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
    salvarConfigIA({ padrao: novaChave === null && cfg.padrao === p.id ? undefined : cfg.padrao, provedores })
  }

  const testar = async (k: string, m: string) => {
    setTestando(true)
    try {
      const r = await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teste: true, provedor: p.id, chave: k, modelo: m }) })
      const corpo = await r.json().catch(() => ({}))
      if (corpo.ok) toast.success(`${p.nome} respondeu. A chave funciona.`)
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
        className="grid gap-3 sm:grid-cols-[1fr_12rem]"
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
        <Campo rotulo="Modelo" htmlFor={`ia-m-${p.id}`} dica={`Ex.: ${p.exemploModelos}`}>
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
                  onChange={() => salvarConfigIA({ ...cfg, padrao: p.id })}
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
    </li>
  )
}

export function ChavesIA() {
  const [vercel, setVercel] = React.useState(false)
  React.useEffect(() => {
    fetch("/api/ia")
      .then((r) => r.json())
      .then((d) => setVercel(Boolean(d.vercel)))
      .catch(() => {})
  }, [])

  return (
    <Secao
      titulo="Inteligência artificial"
      descricao="Chaves de API para o Assistente. Cadastre uma ou mais e escolha qual usar por padrão."
    >
      <p className={cn("mb-4 flex gap-2 rounded-lg border border-line bg-surface-2/60 p-3 text-sm text-ink-2")}>
        <KeyRound className="mt-0.5 size-4 shrink-0 text-ink-3" />
        <span>
          As chaves ficam guardadas só neste navegador, não no banco de dados. Em outro aparelho ou navegador, cadastre de novo. Limpar os dados do navegador apaga as chaves.
          {vercel ? " Há também uma chave do Claude configurada na Vercel, usada quando este navegador não tem nenhuma." : ""}
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
