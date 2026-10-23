"use client"

import * as React from "react"
import { Janela } from "@/components/ui/janela"
import { Botao } from "@/components/ui/button"

class LimiteFormulario extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { falhou: boolean }> {
  state = { falhou: false }
  static getDerivedStateFromError() { return { falhou: true } }
  render() { return this.state.falhou ? this.props.fallback : this.props.children }
}

/** Uma falha de rede no chunk não desmonta a página nem prende uma lazy rejeitada. */
export function FormularioSobDemanda<P extends { aberta: boolean; aoMudar: (aberta: boolean) => void }>({
  carregar, propriedades, titulo,
}: { carregar: () => Promise<{ default: React.ComponentType<P> }>; propriedades: P; titulo: string }) {
  const [{ Componente, tentativa }, setCarregamento] = React.useState(() => ({ Componente: React.lazy(carregar), tentativa: 0 }))
  const tentar = () => setCarregamento(atual => ({ Componente: React.lazy(carregar), tentativa: atual.tentativa + 1 }))
  return (
    <LimiteFormulario key={tentativa} fallback={
      <Janela aberta aoMudar={propriedades.aoMudar} titulo={titulo}>
        <p role="alert" className="py-4 text-sm text-ink-2">Não foi possível carregar o formulário. Verifique sua conexão e tente novamente.</p>
        <Botao onClick={tentar}>Tentar novamente</Botao>
      </Janela>
    }>
      <React.Suspense fallback={<Janela aberta aoMudar={propriedades.aoMudar} titulo={titulo}><p role="status" className="py-6 text-sm text-ink-2">Carregando…</p></Janela>}>
        <Componente {...propriedades} />
      </React.Suspense>
    </LimiteFormulario>
  )
}
