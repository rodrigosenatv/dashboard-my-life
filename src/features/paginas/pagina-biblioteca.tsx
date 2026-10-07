"use client"

import { ListaPaginas } from "./lista-paginas"

export function PaginaBiblioteca() {
  return (
    <ListaPaginas
      area="conteudo"
      titulo="Biblioteca"
      descricao="Cursos, módulos e prompts. Em qualquer bloco de prompt você pode copiar ou mandar direto para o assistente."
      secoes={["biblioteca", "planner"]}
      secaoNova="biblioteca"
    />
  )
}
