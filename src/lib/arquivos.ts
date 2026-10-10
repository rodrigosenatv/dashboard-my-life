"use client"

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { BUCKET_ARQUIVOS } from "@/lib/supabase/env"

/** Prefixo dos endereços de arquivos guardados no storage, dentro dos textos em markdown. */
export const PREFIXO_ARQUIVO = "arquivo://"

/** Gera um link temporário para um arquivo guardado no storage. */
export function useUrlArquivo(caminho: string | null | undefined) {
  return useQuery({
    queryKey: ["arquivo-url", caminho],
    enabled: Boolean(caminho),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase().storage.from(BUCKET_ARQUIVOS).createSignedUrl(caminho!, 60 * 60)
      if (error) throw new Error(error.message)
      return data.signedUrl
    },
  })
}
