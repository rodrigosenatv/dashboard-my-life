import type { Metadata } from "next"
import { Suspense } from "react"
import { FRASE_PADRAO, GRADE_DA_CAPA } from "@/lib/marca"
import { FormLogin } from "./form-login"

export const metadata: Metadata = { title: "Entrar" }

export default function PaginaLogin() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* A capa do caderno: no computador ocupa a metade esquerda; no celular, uma faixa no topo */}
      <div className="relative isolate flex flex-col justify-between gap-6 overflow-hidden bg-petroleo px-6 py-8 text-petroleo-tinta sm:px-10 lg:px-14 lg:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]" style={{ backgroundImage: GRADE_DA_CAPA }} />
        <p className="font-assinatura text-6xl leading-none lg:text-[6.5rem]">My life</p>
        <p className="max-w-sm text-lg text-white/85 lg:text-xl">“{FRASE_PADRAO}”</p>
      </div>

      <div className="grid place-items-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-semibold">Entrar</h1>
          <p className="mt-2 text-ink-2">Entre para ver o seu dia.</p>
          <Suspense>
            <FormLogin />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
