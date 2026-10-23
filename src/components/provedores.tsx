"use client"

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast, Toaster } from "sonner"
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
  const [temaLido, setTemaLido] = React.useState(false)

  React.useEffect(() => {
    try {
      setTema((localStorage.getItem(CHAVE_TEMA) as Tema) || "escuro")
    } catch {}
    setTemaLido(true)
  }, [])

  React.useEffect(() => {
    if (!temaLido) return
    const mq = matchMedia("(prefers-color-scheme: dark)")
    const aplicar = () => {
      const d = tema === "escuro" || (tema === "sistema" && mq.matches)
      document.documentElement.classList.toggle("dark", d)
      setEscuro(d)
    }
    aplicar()
    mq.addEventListener("change", aplicar)
    return () => mq.removeEventListener("change", aplicar)
  }, [tema, temaLido])

  const mudarTema = React.useCallback((t: Tema) => {
    setTema(t)
    try {
      localStorage.setItem(CHAVE_TEMA, t)
    } catch {}
  }, [])

  const valor = React.useMemo(() => ({ tema, mudarTema, escuro }), [tema, mudarTema, escuro])
  return <TemaCtx.Provider value={valor}>{children}</TemaCtx.Provider>
}

/** A chave legada não pode ser atribuída com segurança a nenhuma conta. */
function limparCredenciaisLegadas() {
  try { localStorage.removeItem("dml-ia") } catch {}
}

/** Não manter credenciais pessoais em dispositivos compartilhados após o logout. */
function limparCredenciaisIA() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const nome = localStorage.key(i)
      if (nome === "dml-ia" || nome?.startsWith("dml-ia:")) localStorage.removeItem(nome)
    }
    localStorage.removeItem("dml:usuario-offline")
    window.dispatchEvent(new Event("dml-ia-mudou"))
    navigator.serviceWorker?.controller?.postMessage({ type: "LIMPAR_CACHE_PESSOAL" })
  } catch {}
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
    limparCredenciaisLegadas()
    const sb = supabase()
    // A sessão guardada no aparelho basta para saber quem é a pessoa; quem valida o acesso
    // é o banco (RLS) e o proxy. Perguntar ao servidor aqui custava uma ida à rede em toda abertura.
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) try { localStorage.setItem("dml:usuario-offline", data.session.user.id) } catch {}
      setUsuario(data.session?.user ?? null)
      setCarregando(false)
    })
    let identidadeAtual = ""
    const { data } = sb.auth.onAuthStateChange((evento, sessao) => {
      if (sessao?.user.id && identidadeAtual && identidadeAtual !== sessao.user.id) {
        cliente.clear()
        limparCredenciaisIA()
      }
      identidadeAtual = sessao?.user.id ?? ""
      if (sessao?.user.id) try { localStorage.setItem("dml:usuario-offline", sessao.user.id) } catch {}
      setUsuario(sessao?.user ?? null)
      if (evento === "SIGNED_OUT") {
        limparCredenciaisIA()
        cliente.clear()
        router.replace("/login")
      }
    })
    return () => data.subscription.unsubscribe()
  }, [cliente, router])

  const sair = React.useCallback(async () => {
    limparCredenciaisIA()
    const { error } = await supabase().auth.signOut()
    // Sem rede o servidor não confirma a saída; a sessão deste aparelho é encerrada mesmo assim
    if (error) await supabase().auth.signOut({ scope: "local" })
  }, [])

  const valor = React.useMemo(() => ({ usuario, carregando, sair }), [usuario, carregando, sair])
  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>
}

/* ------------------------------------------------------------------ */
/* Tudo junto                                                          */
/* ------------------------------------------------------------------ */

/** Avisa quando a conexão cai e quando volta; sem isso as gravações falhavam sem explicação. */
function AvisoDeConexao() {
  React.useEffect(() => {
    const caiu = () => toast.warning("Você está sem conexão.", { id: "conexao", description: "O que você mudar agora não será salvo.", duration: Infinity })
    const voltou = () => toast.success("Conexão restabelecida.", { id: "conexao", description: undefined, duration: 3000 })
    if (!navigator.onLine) caiu()
    window.addEventListener("offline", caiu)
    window.addEventListener("online", voltou)
    return () => {
      window.removeEventListener("offline", caiu)
      window.removeEventListener("online", voltou)
    }
  }, [])
  return null
}

export function Provedores({ children }: { children: React.ReactNode }) {
  const [cliente] = React.useState(() => {
    const cliente: QueryClient = new QueryClient({
      // A maioria das telas não mostrava nada quando uma lista deixava de carregar: parecia só "vazia".
      // Um aviso único, com a opção de tentar de novo, cobre todas elas.
      queryCache: new QueryCache({
        onError: (erro, consulta) => {
          if (!navigator.onLine) return
          toast.error(consulta.state.data === undefined ? "Não foi possível carregar os dados." : "Não foi possível atualizar os dados.", {
            id: "erro-carregar",
            description: "Verifique sua conexão e tente novamente.",
            action: { label: "Tentar de novo", onClick: () => void cliente.refetchQueries({ type: "active" }) },
          })
        },
      }),
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
    })
    return cliente
  })

  return (
    <QueryClientProvider client={cliente}>
      <ProvedorTema>
        <ProvedorSessao cliente={cliente}>
          {children}
          <AvisoDeConexao />
          <Toaster
            position="bottom-center"
            toastOptions={{
              className: "!bg-surface !text-ink !border-line !shadow-overlay !font-sans",
              // A descrição e o botão dos avisos usavam as cores padrão da biblioteca, quase ilegíveis no tema escuro
              classNames: { description: "!text-ink-2", actionButton: "!bg-pen !text-pen-ink !font-medium" },
            }}
          />
        </ProvedorSessao>
      </ProvedorTema>
    </QueryClientProvider>
  )
}
