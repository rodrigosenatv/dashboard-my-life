"use client"

import { ListaPaginas } from "./lista-paginas"

export function PaginaNotas() {
  return (
    <ListaPaginas
      area="projetos"
      titulo="Notas"
      descricao="Anotações, recursos de consulta e o que ficou guardado no arquivo."
      secoes={["notas", "recursos", "wiki", "geral", "arquivo"]}
      secaoNova="notas"
    />
  )
}
