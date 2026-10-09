import * as React from "react"
import { cn } from "@/lib/utils"

const base =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-ink placeholder:text-ink-3 transition-colors focus-visible:border-pen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pen/25 disabled:opacity-60"

export function Entrada({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(base, "h-9 text-sm toque:h-11 toque:text-[16px]", className)} {...props} />
}

export function AreaTexto({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-24 py-2 text-sm leading-relaxed toque:text-[16px]", className)} {...props} />
}

export function Seletor({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(base, "h-9 cursor-pointer pr-8 text-sm toque:h-11 toque:text-[16px]", className)} {...props}>
      {children}
    </select>
  )
}

export function Campo({
  rotulo,
  dica,
  children,
  className,
  htmlFor,
}: {
  rotulo: string
  dica?: React.ReactNode
  children: React.ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {rotulo}
      </label>
      {children}
      {dica ? <p className="text-xs text-ink-3">{dica}</p> : null}
    </div>
  )
}

/** Campo de texto que salva ao sair (blur) ou ao apertar Enter. */
export function EdicaoEmLinha({
  valor,
  aoSalvar,
  className,
  placeholder,
  multilinha,
  rotulo,
}: {
  valor: string
  aoSalvar: (novo: string) => void
  className?: string
  placeholder?: string
  multilinha?: boolean
  rotulo: string
}) {
  const [texto, setTexto] = React.useState(valor)
  React.useEffect(() => setTexto(valor), [valor])

  const salvar = () => {
    if (texto.trim() !== valor.trim()) aoSalvar(texto.trim())
  }

  const comum = {
    "aria-label": rotulo,
    value: texto,
    placeholder,
    onBlur: salvar,
    className: cn(
      "w-full rounded-md border border-transparent bg-transparent px-1.5 -mx-1.5 hover:border-line focus-visible:border-pen focus-visible:outline-none",
      className,
    ),
  }

  if (multilinha) {
    return (
      <textarea
        {...comum}
        rows={3}
        onChange={(e) => setTexto(e.target.value)}
      />
    )
  }
  return (
    <input
      {...comum}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
        if (e.key === "Escape") {
          setTexto(valor)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
