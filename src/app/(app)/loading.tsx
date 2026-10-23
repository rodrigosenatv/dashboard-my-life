import { Esqueleto } from "@/components/ui/basicos"

export default function CarregandoPagina() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="grid gap-6">
      <Esqueleto className="h-9 w-56" />
      <Esqueleto className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Esqueleto className="h-48" />
        <Esqueleto className="h-48" />
      </div>
    </div>
  )
}

