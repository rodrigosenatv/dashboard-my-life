import type { Metadata } from "next"
import { Suspense } from "react"
import { FormLogin } from "./form-login"

export const metadata: Metadata = { title: "Entrar" }

export default function PaginaLogin() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <p className="font-display text-5xl font-bold tracking-tight">My Life</p>
        <p className="mt-3 text-ink-2">Entre para ver o seu dia.</p>
        <Suspense>
          <FormLogin />
        </Suspense>
      </div>
    </main>
  )
}
