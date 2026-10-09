"use client"

import * as React from "react"
import { Download, MonitorSmartphone } from "lucide-react"
import { Botao } from "@/components/ui/button"
import { Secao } from "@/components/ui/basicos"

/** O convite de instalação do Chrome/Edge/Android; não existe no Safari nem no Firefox. */
type ConviteInstalar = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// O navegador dispara o convite uma vez, logo ao carregar; fica guardado para a tela de Configurações usar depois
let convite: ConviteInstalar | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

function assinar(f: () => void) {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}

/** Registra o service worker e guarda o convite de instalação. Fica no layout raiz. */
export function RegistroPwa() {
  React.useEffect(() => {
    const guardar = (e: Event) => {
      e.preventDefault()
      convite = e as ConviteInstalar
      avisar()
    }
    const instalado = () => {
      convite = null
      avisar()
    }
    window.addEventListener("beforeinstallprompt", guardar)
    window.addEventListener("appinstalled", instalado)

    // Em desenvolvimento o service worker só atrapalharia a atualização ao vivo
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", guardar)
      window.removeEventListener("appinstalled", instalado)
    }
  }, [])
  return null
}

type Aparelho = { instalado: boolean; ios: boolean }

export function InstalarApp() {
  const disponivel = React.useSyncExternalStore(
    assinar,
    () => convite !== null,
    () => false,
  )
  const [aparelho, setAparelho] = React.useState<Aparelho | null>(null)

  React.useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    setAparelho({
      instalado: matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
      // O iPad recente se apresenta como Mac; a tela de toque é o que o distingue
      ios: /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.userAgent.includes("Mac") && nav.maxTouchPoints > 1),
    })
  }, [])

  const instalar = async () => {
    if (!convite) return
    await convite.prompt()
    const { outcome } = await convite.userChoice
    if (outcome === "accepted") {
      convite = null
      avisar()
    }
  }

  return (
    <Secao titulo="Instalar app" descricao="Use o My Life como um aplicativo, em janela própria e com ícone na tela inicial.">
      {!aparelho ? null : aparelho.instalado ? (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <MonitorSmartphone className="size-4 shrink-0 text-rotina" />
          O app já está instalado neste aparelho.
        </p>
      ) : disponivel ? (
        <Botao variante="primario" onClick={instalar}>
          <Download /> Instalar My Life
        </Botao>
      ) : aparelho.ios ? (
        <ol className="grid max-w-md list-decimal gap-1 pl-5 text-sm text-ink-2">
          <li>Abra o My Life no Safari.</li>
          <li>Toque em Compartilhar (o quadrado com a seta para cima).</li>
          <li>Escolha “Adicionar à Tela de Início”.</li>
        </ol>
      ) : (
        <p className="max-w-md text-sm text-ink-2">
          Abra o menu do navegador e escolha “Instalar app” ou “Adicionar à tela inicial”. No computador, a instalação funciona no Chrome e no Edge.
        </p>
      )}
    </Secao>
  )
}
