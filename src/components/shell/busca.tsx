"use client"

import dynamic from "next/dynamic"
import * as React from "react"

const EVENTO = "dml:abrir-busca"

export function abrirBusca() {
  window.dispatchEvent(new CustomEvent(EVENTO))
}

// A janela de busca e a biblioteca de comandos só são baixadas na primeira vez que a busca abre
const PainelBusca = dynamic(() => import("./busca-painel").then((m) => m.PainelBusca), { ssr: false })

export function Busca() {
  const [aberta, setAberta] = React.useState(false)
  const [montada, setMontada] = React.useState(false)

  React.useEffect(() => {
    const abrir = () => {
      setMontada(true)
      setAberta(true)
    }
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setMontada(true)
        setAberta((a) => !a)
      }
    }
    window.addEventListener(EVENTO, abrir)
    window.addEventListener("keydown", tecla)
    return () => {
      window.removeEventListener(EVENTO, abrir)
      window.removeEventListener("keydown", tecla)
    }
  }, [])

  return montada ? <PainelBusca aberta={aberta} aoMudar={setAberta} /> : null
}
