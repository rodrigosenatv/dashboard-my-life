import { Suspense } from "react"
import { BarraLateral } from "@/components/shell/barra-lateral"
import { AbasArea, BarraInferior, TopoCelular } from "@/components/shell/celular"
import { Busca } from "@/components/shell/busca"
import { NovoGlobal } from "@/components/shell/novo"
import { SoNoNavegador } from "@/components/shell/so-no-navegador"
import { Esqueleto } from "@/components/ui/basicos"

// O conteúdo é pessoal e montado no navegador; não há casca estática para validar.
export const instant = false

function CarregandoPagina() {
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

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      {/* A navegação lê a rota atual; em rotas com id ela só resolve na requisição. */}
      <Suspense fallback={<aside aria-hidden className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-bg recolhido:w-16 lg:block" />}>
        <BarraLateral />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div aria-hidden className="h-14 border-b border-line lg:hidden" />}>
          <TopoCelular />
        </Suspense>
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-14 lg:pt-9">
          <Suspense fallback={null}>
            <AbasArea />
          </Suspense>
          <Suspense fallback={<CarregandoPagina />}>
            <SoNoNavegador esqueleto={<CarregandoPagina />}>{children}</SoNoNavegador>
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <BarraInferior />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <Busca />
        <NovoGlobal />
      </Suspense>
    </div>
  )
}
