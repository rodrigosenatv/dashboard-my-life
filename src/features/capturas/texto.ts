/** Texto corrido para a prévia de duas linhas: sem imagens, endereços nem marcação. */
export function previaTexto(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^```.*$/gm, "")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}
