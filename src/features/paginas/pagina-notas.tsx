"use client"

import { ListaPaginas } from "./lista-paginas"

export function PaginaNotas() {
  return (
    <ListaPaginas
      area="projetos"
      titulo="Páginas"
      descricao="Páginas trazidas do Notion e escritas aqui: wiki pessoal, documentos e textos longos."
      secoes={["notas", "recursos", "wiki", "geral", "arquivo"]}
      secaoNova="notas"
    />
  )
}
