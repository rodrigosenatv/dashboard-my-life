/** Só aceita chamadas com Origin exatamente igual à origem da aplicação. */
export function mesmaOrigem(origem: string | null, url: string): boolean {
  if (!origem || origem === "null") return false
  try {
    const declarada = new URL(origem)
    const destino = new URL(url)
    return declarada.origin === destino.origin && declarada.href === declarada.origin + "/"
  } catch {
    return false
  }
}
