import "server-only"

export class ErroIA extends Error {
  constructor(
    message: string,
    public status?: number,
    /** Motivo específico, quando há um texto melhor que o do status (ex.: "limite-diario"). */
    public codigo?: string,
  ) {
    super(message)
  }
}

/** Lê um fluxo SSE e devolve o JSON de cada linha "data:". */
export async function* eventosSSE(resposta: Response): AsyncGenerator<unknown> {
  const leitor = resposta.body!.getReader()
  const dec = new TextDecoder()
  let resto = ""
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    const linhas = resto.split("\n")
    resto = linhas.pop() ?? ""
    for (const l of linhas) {
      const evento = lerLinhaSSE(l)
      if (evento !== undefined) yield evento
    }
  }
  // O último evento pode chegar sem quebra de linha no fim
  const evento = lerLinhaSSE(resto)
  if (evento !== undefined) yield evento
}

function lerLinhaSSE(linha: string): unknown {
  const t = linha.trim()
  if (!t.startsWith("data:")) return undefined
  const dado = t.slice(5).trim()
  if (!dado || dado === "[DONE]") return undefined
  try {
    return JSON.parse(dado)
  } catch {
    return undefined
  }
}

export async function falhaHttp(r: Response): Promise<never> {
  let detalhe = ""
  try {
    const corpo = await r.json()
    detalhe = corpo?.error?.message ?? corpo?.message ?? ""
  } catch {}
  throw new ErroIA(detalhe || `erro ${r.status}`, r.status)
}
