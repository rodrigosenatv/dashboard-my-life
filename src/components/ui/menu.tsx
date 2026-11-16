"use client"

import { DropdownMenu } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"
import { useTemaDasJanelas } from "./tema-janelas"

export const Menu = DropdownMenu.Root
export const MenuGatilho = DropdownMenu.Trigger

export function MenuConteudo({
  className,
  align = "end",
  ...props
}: React.ComponentProps<typeof DropdownMenu.Content>) {
  const tema = useTemaDasJanelas()
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          tema,
          "z-50 min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-lg border border-line bg-surface p-1 text-sm text-ink shadow-overlay data-[state=open]:animate-surgir",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  className,
  perigo,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & { perigo?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 outline-none toque:min-h-11 data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-ink-3",
        perigo && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  )
}

/** Um grupo de opções em que só uma vale (a situação de um curso, uma ordem): cada opção é um `MenuEscolha`. */
export const MenuEscolhas = DropdownMenu.RadioGroup

/** Uma opção de um `MenuEscolhas`: a escolhida ganha o sinal de certo à direita. */
export function MenuEscolha({ className, children, ...props }: React.ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 outline-none toque:min-h-11 data-[highlighted]:bg-surface-2 data-[state=checked]:font-medium",
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <DropdownMenu.ItemIndicator>
        <svg viewBox="0 0 12 12" className="size-3.5 text-pen" aria-hidden>
          <path d="M2.5 6.2 5 8.5 9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  )
}

export function MenuSeparador() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />
}

export function MenuRotulo({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">{children}</DropdownMenu.Label>
}
