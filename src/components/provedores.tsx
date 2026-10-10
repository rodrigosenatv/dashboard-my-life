"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Toaster } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { supabaseConfigurado } from "@/lib/supabase/env"

/* ------------------------------------------------------------------ */
/* Tema                                                                */
/* ------------------------------------------------------------------ */

export type Tema = "sistema" | "claro" | "escuro"
const CHAVE_TEMA = "dml-tema"
export const CHAVE_MENU_RECOLHIDO = "dml:menu-recolhido"

type ContextoTema = { tema: Tema; mudarTema: (t: Tema) => void; escuro: boolean }
const TemaCtx = React.createContext<ContextoTema>({ tema: "sistema", mudarTema: () => {}, escuro: false })

export const useTema = () => React.useContext(TemaCtx)

/** Script que roda antes da primeira pintura para evitar piscar o tema e a largura do menu. */
export const scriptTema = `(function(){try{var t=localStorage.getItem('${CHAVE_TEMA}')||'escuro';var d=t==='escuro'||(t==='sistema'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);if(localStorage.getItem('${CHAVE_MENU_RECOLHIDO}')==='1')document.documentElement.dataset.menu='recolhido';}catch(e){}})();`

function ProvedorTema({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = React.useState<Tema>("escuro")
  const [escuro, setEscuro] = React.useState(false)

  React.useEffect(() => {
    try {
      setTema((localStorage.getItem(CHAVE_TEMA) as Tema) || "escuro")
    } catch {}
  }, [])

  React.useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)")
    const aplicar = () => {
      const d = tema === "escuro" || (tema === "sistema" && mq.matches)
      document.documentElement.classList.toggle("dark", d)
      setEscuro(d)
    }
    aplicar()
    mq.addEventListener("change", aplicar)
    return () => mq.removeEventListener("change", aplicar)
  }, [tema])

  const mudarTema = React.useCallback((t: Tema) => {
    setTema(t)
    try {
      localStorage.setItem(CHAVE_TEMA, t)
    } catch {}
  }, [])

  return <TemaCtx.Provider value={{ tema, mudarTema, escuro }}>{children}</TemaCtx.Provider>
}

/* ------------------------------------------------------------------ */
/* Sessão                                                              */
/* ------------------------------------------------------------------ */

type ContextoSessao = { usuario: User | null; carregando: boolean; sair: () => Promise<void> }
const SessaoCtx = React.createContext<ContextoSessao>({ usuario: null, carregando: true, sair: async () => {} })

export const useSessao = () => React.useContext(SessaoCtx)

function ProvedorSessao({ children, cliente }: { children: React.ReactNode; cliente: QueryClient }) {
  const router = useRouter()
  const [usuario, setUsuario] = React.useState<User | null>(null)
  const [carregando, setCarregando] = React.useState(true)

  React.useEffect(() => {
    if (!supabaseConfigurado) {
      setCarregando(false)
      return
    }
    const sb = supabase()
    // A sessão guardada no aparelho basta para saber quem é a pessoa; quem valida o acesso
    // é o banco (RLS) e o proxy. Perguntar ao servidor aqui custava uma ida à rede em toda abertura.
    sb.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null)
      setCarregando(false)
    })
    const { data } = sb.auth.onAuthStateChange((evento, sessao) => {
      setUsuario(sessao?.user ?? null)
      if (evento === "SIGNED_OUT") {
        cliente.clear()
        router.replace("/login")
      }
    })
    return () => data.subscription.unsubscribe()
  }, [cliente, router])

  const sair = React.useCallback(async () => {
    const { error } = await supabase().auth.signOut()
    // Sem rede o servidor não confirma a saída; a sessão deste aparelho é encerrada mesmo assim
    if (error) await supabase().auth.signOut({ scope: "local" })
  }, [])

  return <SessaoCtx.Provider value={{ usuario, carregando, sair }}>{children}</SessaoCtx.Provider>
}

/* ------------------------------------------------------------------ */
/* Tudo junto                                                          */
/* ------------------------------------------------------------------ */

export function Provedores({ children }: { children: React.ReactNode }) {
  const [cliente] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // O app é de uma pessoa só e toda gravação já atualiza as listas afetadas:
            // dá para reaproveitar o que está em memória por mais tempo ao trocar de tela
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={cliente}>
      <ProvedorTema>
        <ProvedorSessao cliente={cliente}>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: "!bg-surface !text-ink !border-line !shadow-overlay !font-sans",
            }}
          />
        </ProvedorSessao>
      </ProvedorTema>
    </QueryClientProvider>
  )
}
