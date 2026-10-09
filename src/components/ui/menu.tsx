"use client"

import { DropdownMenu } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"

export const Menu = DropdownMenu.Root
export const MenuGatilho = DropdownMenu.Trigger

export function MenuConteudo({
  className,
  align = "end",
  ...props
}: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-48 rounded-lg border border-line bg-surface p-1 text-sm text-ink shadow-overlay",
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

export function MenuSeparador() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />
}

export function MenuRotulo({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">{children}</DropdownMenu.Label>
}
