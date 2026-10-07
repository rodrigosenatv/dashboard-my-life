import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"

export const estiloBotao = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primario: "bg-pen text-pen-ink hover:bg-pen/90",
        secundario: "bg-surface-2 text-ink hover:bg-surface-3",
        contorno: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
        fantasma: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        perigo: "bg-danger text-white hover:bg-danger/90",
        link: "h-auto px-0 text-pen underline-offset-4 hover:underline",
      },
      tamanho: {
        sm: "h-8 px-3 text-sm",
        md: "h-9 px-3.5 text-sm",
        lg: "h-11 px-5 text-base",
        icone: "size-9",
        "icone-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variante: "secundario", tamanho: "md" },
  },
)

type Props = React.ComponentProps<"button"> &
  VariantProps<typeof estiloBotao> & {
    asChild?: boolean
  }

export function Botao({ className, variante, tamanho, asChild, type, ...props }: Props) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(estiloBotao({ variante, tamanho }), className)}
      {...props}
    />
  )
}
