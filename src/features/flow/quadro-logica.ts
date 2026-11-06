// O quadro dos alvos do Flow, sem tela (testado em tests/flow-quadro.test.cjs). Sem imports: o teste carrega
// este arquivo sozinho.

/** Onde fica o caminho da imagem (no bucket "arquivos") nas preferências. */
export const PREF_QUADRO = "quadroAlvos"

/** O caminho do quadro guardado nas preferências, ou null quando não há (ou o valor veio estragado). */
export function lerQuadro(prefs: Record<string, unknown> | null | undefined): string | null {
  const v = prefs?.[PREF_QUADRO]
  if (typeof v !== "string") return null
  const caminho = v.trim()
  // Só caminhos dentro da pasta de alguém (como "<usuário>/flow/quadro-1.webp"), sem subir de pasta
  if (!caminho || caminho.startsWith("/") || caminho.split("/").some((parte) => parte === ".." || parte === "") || !caminho.includes("/")) return null
  return caminho
}

const EXTENSOES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" }

/** A extensão do arquivo pelo tipo da imagem (o nome só vale quando o tipo não diz). */
export function extensaoDaImagem(tipo: string, nome: string): string {
  const pelaTipo = EXTENSOES[tipo.toLowerCase()]
  if (pelaTipo) return pelaTipo
  const pelaNome = (nome.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
  return pelaNome === "jpeg" ? "jpg" : Object.values(EXTENSOES).includes(pelaNome) ? pelaNome : "jpg"
}

/** O caminho de um quadro novo: um nome por envio, para o navegador não mostrar a imagem antiga guardada. */
export function caminhoNovoDoQuadro(usuarioId: string, extensao: string, agora: number): string {
  return `${usuarioId}/flow/quadro-${agora}.${extensao}`
}

/** Quanto da fase já passou, de 0 a 1 (a barra fina da tela de foco). */
export function progressoDaFase(restante: number, duracao: number): number {
  if (!(duracao > 0)) return 0
  return Math.min(1, Math.max(0, 1 - restante / duracao))
}
