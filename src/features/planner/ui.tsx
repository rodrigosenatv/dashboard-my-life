"use client"

import {
  CheckCheck,
  CircleDashed,
  Clapperboard,
  FileText,
  GalleryHorizontal,
  Image as IconeImagem,
  Lightbulb,
  PenLine,
  Radio,
  Scissors,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react"
import type { Tables } from "@/lib/supabase/database.types"
import type { StatusConteudo } from "@/lib/rotulos"

export type Conteudo = Tables<"content_items">

/** Cada etapa da esteira com a sua cor e o seu ícone; "gravando" tem o ponto vermelho de gravação. */
export const ETAPA: Record<StatusConteudo, { cor: string; icone: LucideIcon; rec?: boolean }> = {
  ideia: { cor: "var(--b-ambar)", icone: Lightbulb },
  idealizando: { cor: "var(--b-violeta)", icone: PenLine },
  gravando: { cor: "#ff4d6d", icone: Video, rec: true },
  editando: { cor: "var(--b-coral)", icone: Scissors },
  finalizado: { cor: "var(--b-luz-2)", icone: CheckCheck },
  publicado: { cor: "var(--b-verde)", icone: Radio },
}
export const etapaDe = (status: string) => ETAPA[status as StatusConteudo] ?? ETAPA.idealizando

/** O ícone de cada formato; um formato que não está aqui usa `IconeFormatoOutro`. */
export const ICONE_FORMATO: Record<string, LucideIcon> = {
  Carrossel: GalleryHorizontal,
  "Reels/Shorts": Clapperboard,
  Vídeo: Video,
  Imagem: IconeImagem,
  Stories: CircleDashed,
  Texto: Type,
}
export const IconeFormatoOutro = FileText

/** Campo arredondado do Planner (busca, nova ideia, nova linha editorial). */
export const CAMPO =
  "h-11 rounded-full border border-[var(--b-borda)] bg-surface px-4 text-sm placeholder:text-ink-3 focus-visible:border-[var(--b-luz)] focus-visible:outline-none"

/** O que dizer depois de marcar como publicado: posts com respostas engajam mais (Buffer, quase 2 milhões de posts). */
export const DICA_AO_PUBLICAR = "Responda os comentários na primeira hora: posts com resposta engajam mais."
