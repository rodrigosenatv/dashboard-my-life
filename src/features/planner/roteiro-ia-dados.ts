"use client"

import { useQueryClient } from "@tanstack/react-query"
import * as React from "react"
import { toast } from "sonner"
import { gravarConfiguracoes, useConfiguracoes } from "@/features/configuracoes/dados"
import { configParaSalvar, lerConfigRoteiro, mesmaConfig, separarErro, type ConfigRoteiroIA } from "@/features/conteudo/roteiro-ia"
import type { Provedor } from "@/lib/ia/info"
import type { Json } from "@/lib/supabase/database.types"

/* ------------------------------------------------------------------ */
/* Os prompts do roteiro (settings.prefs.roteiroIA)                    */
/* ------------------------------------------------------------------ */

/** A configuração dos roteiros com IA, com o padrão no que a pessoa não mudou. */
export function useConfigRoteiroIA() {
  const { data, isLoading } = useConfiguracoes()
  const bruto = ((data?.prefs ?? {}) as Record<string, Json | undefined>).roteiroIA
  const config = React.useMemo(() => lerConfigRoteiro(bruto), [bruto])
  return { config, carregando: isLoading }
}

/**
 * Grava a configuração dos roteiros. `mudar` recebe a que está no banco na hora, para uma tela não apagar o que
 * a outra acabou de mudar (ex.: as lacunas lembradas ao gerar e os prompts editados em Configurações).
 */
export function useGravarRoteiroIA() {
  const qc = useQueryClient()
  return React.useCallback(
    async (mudar: (atual: ConfigRoteiroIA) => ConfigRoteiroIA) => {
      await gravarConfiguracoes({ prefs: (gravadas) => ({ roteiroIA: configParaSalvar(mudar(lerConfigRoteiro(gravadas.roteiroIA))) as unknown as Json }) })
      await qc.invalidateQueries({ queryKey: ["settings"] })
    },
    [qc],
  )
}

/** O rascunho do editor de prompts: muda à vontade e só grava em "Salvar". */
export function useRascunhoRoteiro() {
  const { config, carregando } = useConfigRoteiroIA()
  const gravar = useGravarRoteiroIA()
  const [rascunho, setRascunho] = React.useState<ConfigRoteiroIA | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const atual = rascunho ?? config
  const mudou = rascunho !== null && !mesmaConfig(rascunho, config)

  const mudar = React.useCallback((f: (c: ConfigRoteiroIA) => ConfigRoteiroIA) => setRascunho((r) => f(r ?? config)), [config])

  const salvar = async (): Promise<boolean> => {
    if (!rascunho || !mudou) {
      setRascunho(null)
      return true
    }
    setSalvando(true)
    try {
      const final = rascunho
      await gravar(() => final)
      setRascunho(null)
      return true
    } catch (e) {
      toast.error("Não foi possível salvar os prompts.", { description: e instanceof Error ? e.message : undefined })
      return false
    } finally {
      setSalvando(false)
    }
  }

  return { config: atual, carregando, mudou, salvando, mudar, salvar, descartar: () => setRascunho(null) }
}

export type RascunhoRoteiro = ReturnType<typeof useRascunhoRoteiro>

/* ------------------------------------------------------------------ */
/* O pedido à IA (pela rota /api/ia, com a chave da pessoa)            */
/* ------------------------------------------------------------------ */

/**
 * Manda o pedido do roteiro e devolve o texto conforme chega (`aoPedaco` recebe o texto acumulado). Um erro antes
 * do primeiro texto é lançado; um erro no meio volta em `erro`, com o que já tinha chegado em `texto`.
 */
export async function pedirRoteiro({
  credencial,
  texto,
  sinal,
  aoPedaco,
}: {
  credencial: { provedor: Provedor; chave: string; modelo: string }
  texto: string
  sinal: AbortSignal
  aoPedaco: (acumulado: string) => void
}): Promise<{ texto: string; modelo: string | null; erro: string | null }> {
  const cancelou = (e: unknown) => (e as Error)?.name === "AbortError"
  let r: Response
  try {
    r = await fetch("/api/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modo: "roteiro", mensagens: [{ role: "user", content: texto }], ...credencial }),
      signal: sinal,
    })
  } catch (e) {
    if (cancelou(e)) throw e
    throw new Error("sem conexão com o app. Verifique a internet e tente de novo.")
  }
  if (!r.ok || !r.body) {
    const corpo = await r.json().catch(() => ({}))
    throw new Error(corpo.erro ?? `erro ${r.status}`)
  }
  const modelo = r.headers.get("x-modelo-ia")
  const leitor = r.body.getReader()
  const dec = new TextDecoder()
  let acumulado = ""
  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      acumulado += dec.decode(value, { stream: true })
      aoPedaco(separarErro(acumulado).texto)
    }
  } catch (e) {
    // Cancelado: quem pediu decide o que fazer com o que chegou; a conexão caiu: volta o que chegou, com o aviso
    if (cancelou(e)) throw e
    return { texto: separarErro(acumulado).texto, modelo, erro: "a conexão caiu no meio da resposta." }
  }
  acumulado += dec.decode()
  return { ...separarErro(acumulado), modelo }
}
