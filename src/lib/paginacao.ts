const PAGINA = 1000

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/** Busca todas as linhas, página por página (o Supabase devolve no máximo 1000 por vez). */
export async function buscarTodos<T>(montar: (de: number, ate: number) => Resposta<T>, sinal?: AbortSignal): Promise<T[]> {
  const todos: T[] = []
  for (let de = 0; ; de += PAGINA) {
    sinal?.throwIfAborted()
    const { data, error } = await montar(de, de + PAGINA - 1)
    sinal?.throwIfAborted()
    if (error) throw new Error(error.message)
    const lote = data ?? []
    todos.push(...lote)
    if (lote.length < PAGINA) break
  }
  return todos
}

