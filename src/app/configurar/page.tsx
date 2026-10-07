import type { Metadata } from "next"

export const metadata: Metadata = { title: "Configurar" }

export default function PaginaConfigurar() {
  return (
    <main className="mx-auto max-w-xl px-5 py-14">
      <p className="font-display text-4xl font-bold tracking-tight">My Life</p>
      <h1 className="mt-8 font-display text-2xl font-semibold">Falta ligar o banco de dados</h1>
      <p className="mt-3 text-ink-2">
        O app ainda não sabe qual projeto do Supabase usar. Na Vercel, abra o projeto e vá em{" "}
        <strong className="text-ink">Settings → Environment Variables</strong> e adicione:
      </p>
      <dl className="mt-5 grid gap-3 rounded-lg border border-line bg-surface p-4 text-sm">
        <div>
          <dt className="font-medium">NEXT_PUBLIC_SUPABASE_URL</dt>
          <dd className="text-ink-2">O endereço do projeto (Project URL), em Supabase → Project Settings → API.</dd>
        </div>
        <div>
          <dt className="font-medium">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</dt>
          <dd className="text-ink-2">A chave pública (publishable ou anon), na mesma tela.</dd>
        </div>
      </dl>
      <p className="mt-5 text-ink-2">Depois salve e faça um novo deploy. Esta página some sozinha.</p>
    </main>
  )
}
