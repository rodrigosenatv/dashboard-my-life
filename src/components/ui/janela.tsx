"use client"

import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Janela modal. No celular abre como painel que sobe de baixo;
 * no computador, centralizada.
 */
export function Janela({
  aberta,
  aoMudar,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  titulo: string
  descricao?: string
  children: React.ReactNode
  rodape?: React.ReactNode
  largura?: "sm" | "md" | "lg" | "xl"
}) {
  return (
    <Dialog.Root open={aberta} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_120ms_ease-out] dark:bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col bg-surface text-ink shadow-overlay outline-none",
            "inset-x-0 bottom-0 rounded-t-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[12vh] sm:-translate-x-1/2 sm:rounded-xl",
            "w-full",
            largura === "sm" && "sm:max-w-sm",
            largura === "md" && "sm:max-w-lg",
            largura === "lg" && "sm:max-w-2xl",
            largura === "xl" && "sm:max-w-4xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3 pt-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-lg font-semibold">{titulo}</Dialog.Title>
              {descricao ? (
                <Dialog.Description className="mt-0.5 text-sm text-ink-2">{descricao}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-1 rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Fechar">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
          {rodape ? (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {rodape}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Pergunta de confirmação para ações que apagam algo. */
export function Confirmar({
  aberta,
  aoMudar,
  titulo,
  descricao,
  acao = "Excluir",
  aoConfirmar,
}: {
  aberta: boolean
  aoMudar: (v: boolean) => void
  titulo: string
  descricao?: string
  acao?: string
  aoConfirmar: () => void
}) {
  return (
    <Janela
      aberta={aberta}
      aoMudar={aoMudar}
      titulo={titulo}
      descricao={descricao}
      largura="sm"
      rodape={
        <>
          <button
            type="button"
            className="h-9 rounded-md px-3.5 text-sm font-medium text-ink-2 hover:bg-surface-2"
            onClick={() => aoMudar(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="h-9 rounded-md bg-danger px-3.5 text-sm font-medium text-white hover:bg-danger/90"
            onClick={() => {
              aoConfirmar()
              aoMudar(false)
            }}
          >
            {acao}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-2">Essa ação não pode ser desfeita.</p>
    </Janela>
  )
}
