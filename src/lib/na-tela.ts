"use client"

import * as React from "react"

/**
 * Com o cacheComponents, o Next não desmonta a tela de onde a pessoa saiu: esconde (display: none)
 * para poder voltar do jeito que estava. Um vídeo tocando continuaria com som em segundo plano.
 *
 * `naTela` fica false enquanto a tela está escondida: quem usa tira os players (o iframe sai da
 * página e o YouTube, o Instagram, o TikTok e o Facebook param). Os vídeos e áudios dentro de `ref` pausam na
 * hora. Trocar o endereço do iframe para parar não serve: isso cria uma entrada a mais no
 * "voltar" do navegador, e o primeiro "voltar" não sairia do lugar.
 */
export function useNaTela<T extends HTMLElement>(ref?: React.RefObject<T | null>) {
  const [naTela, setNaTela] = React.useState(true)
  React.useLayoutEffect(() => {
    setNaTela(true)
    const el = ref?.current
    return () => {
      setNaTela(false)
      if (!el) return
      const midias = el.matches("video, audio") ? [el] : Array.from(el.querySelectorAll("video, audio"))
      for (const m of midias) (m as HTMLMediaElement).pause()
    }
  }, [ref])
  return naTela
}
