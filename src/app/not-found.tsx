import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Página não encontrada" }

export default function NaoEncontrada() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <p className="font-display text-5xl font-bold tracking-tight">My Life</p>
        <h1 className="mt-8 font-display text-2xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-ink-2">O endereço não existe ou a página foi removida.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-md bg-pen px-5 font-medium text-pen-ink hover:bg-pen/90"
        >
          Ir para Hoje
        </Link>
      </div>
    </main>
  )
}
