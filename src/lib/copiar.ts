/**
 * Copia um texto para a área de transferência. Usa a API do navegador e, quando ela é negada
 * (alguns navegadores embutidos em apps negam), o jeito antigo, com uma caixa de texto escondida.
 * Diz se deu certo, para a tela avisar.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return copiarDoJeitoAntigo(texto)
  }
}

function copiarDoJeitoAntigo(texto: string): boolean {
  const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
  // Com uma janela aberta, a caixa fica dentro dela: fora, a janela puxaria o foco de volta
  const lugar = antes?.closest<HTMLElement>("[role=dialog]") ?? document.body
  const caixa = document.createElement("textarea")
  caixa.value = texto
  caixa.readOnly = true
  caixa.setAttribute("aria-hidden", "true")
  caixa.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none"
  lugar.appendChild(caixa)
  caixa.select()
  caixa.setSelectionRange(0, texto.length)
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  caixa.remove()
  antes?.focus({ preventScroll: true })
  return ok
}
