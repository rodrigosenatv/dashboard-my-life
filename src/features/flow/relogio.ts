"use client"

import * as React from "react"
import { toast } from "sonner"
import { tocar } from "@/components/pomodoro"
import { isoDia } from "@/lib/utils"
import * as L from "./logica"

/*
 * O relógio da sessão de foco. Fica fora do React de propósito: o Next esconde a tela do Flow quando a
 * pessoa sai dela, e o timer tem que continuar contando (no app inteiro, e depois de recarregar a página).
 * Por isso o estado é um só, na memória do navegador, guardado no localStorage.
 */

const CHAVE = "dml-flow-sessao"
/** No servidor e na primeira pintura: parado, sem dia (não conta nada). */
const SESSAO_SERVIDOR: L.Sessao = L.sessaoInicial("")

type Aviso = { texto: string; em: number }

let sessao: L.Sessao | null = null
let aviso: Aviso | null = null
const ouvintes = new Set<() => void>()
/** O setTimeout que dispara o fim da fase. */
let alarme: number | null = null
/** O setInterval que mantém o tempo no título da aba. */
let ticker: number | null = null
/** O título que a tela tinha antes de o timer mexer nele. */
let tituloBase: string | null = null
let ultimoTitulo: string | null = null

function avisar() {
  for (const o of ouvintes) o()
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao))
  } catch {}
}

/** Carrega uma vez (só no navegador). Fase que acabou com o app fechado conta, sem tocar. */
function atual(): L.Sessao {
  if (typeof window === "undefined") return SESSAO_SERVIDOR
  if (!sessao) {
    let bruto: unknown = null
    try {
      bruto = localStorage.getItem(CHAVE)
    } catch {}
    sessao = L.lerSessao(bruto, isoDia())
    if (L.faseAcabou(sessao, Date.now())) {
      sessao = L.concluirFase(sessao, isoDia())
      salvar()
    }
    window.addEventListener("storage", (e) => {
      // Outra aba mexeu: segue o que ela gravou
      if (e.key !== CHAVE) return
      sessao = L.lerSessao(e.newValue, isoDia())
      agendar()
      avisar()
    })
    agendar()
  }
  return sessao
}

function gravar(nova: L.Sessao) {
  if (nova === sessao) return
  sessao = nova
  salvar()
  agendar()
  avisar()
}

/** Reagenda o fim da fase e o tempo na aba, conforme a sessão esteja contando ou parada. */
function agendar() {
  if (typeof window === "undefined" || !sessao) return
  if (alarme !== null) window.clearTimeout(alarme)
  alarme = null
  if (sessao.fim !== null) {
    // O + 50 ms garante que, ao disparar, a fase já passou do fim (sem "falta 0 s" preso)
    alarme = window.setTimeout(acabou, Math.max(0, sessao.fim - Date.now()) + 50)
    if (ticker === null) {
      ticker = window.setInterval(atualizarTitulo, 1000)
      atualizarTitulo()
    }
    return
  }
  if (ticker !== null) {
    window.clearInterval(ticker)
    ticker = null
  }
  // Parou: a aba volta ao título da tela, se ainda é o que o timer escreveu
  if (tituloBase !== null && document.title === ultimoTitulo) document.title = tituloBase
  tituloBase = null
  ultimoTitulo = null
}

/** Escreve o tempo que falta no título da aba, enquanto a sessão conta. */
function atualizarTitulo() {
  if (!sessao) return
  const t = L.tituloDaAba(sessao, Date.now())
  if (t === null) return
  // Se o título mudou sem ser por nós, a tela trocou (o Next troca ao navegar): ele vira o base
  if (document.title !== ultimoTitulo) tituloBase = document.title
  document.title = t
  ultimoTitulo = t
}

/** Notificação do sistema, se a pessoa deixou. Sem permissão, ou com erro, o aviso do app já basta. */
function avisarNoSistema(texto: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return
    new Notification(texto, { tag: "dml-flow" })
  } catch {
    navigator.serviceWorker?.ready.then((r) => r.showNotification(texto, { tag: "dml-flow" })).catch(() => {})
  }
}

/** A fase acabou: conta o foco, avisa no app e no sistema e toca o som. Roda em qualquer tela do app. */
function acabou() {
  alarme = null
  const s = atual()
  if (!L.faseAcabou(s, Date.now())) {
    agendar()
    return
  }
  const fase = s.fase
  const nova = L.concluirFase(s, isoDia())
  const texto = L.avisoDoFim(fase, nova.fase)
  aviso = { texto, em: Date.now() }
  gravar(nova)
  tocar()
  avisarNoSistema(texto)
  toast(texto, {
    id: "flow-fim",
    duration: 20000,
    action: { label: L.rotuloAcaoDoFim(nova.fase), onClick: () => foco.comecar() },
  })
}

/** Assina as mudanças do relógio (é o `subscribe` do useSyncExternalStore). */
function assinar(fn: () => void) {
  ouvintes.add(fn)
  atual()
  return () => {
    ouvintes.delete(fn)
  }
}

/** A sessão de foco, ao vivo: qualquer tela do app vê a mesma. */
export function useSessaoFoco(): L.Sessao {
  return React.useSyncExternalStore(assinar, atual, () => SESSAO_SERVIDOR)
}

/** O último aviso de fim de fase (o texto e quando aconteceu), ou null. */
export function useAvisoFoco(): Aviso | null {
  return React.useSyncExternalStore(assinar, () => aviso, () => null)
}

/** "Agora" que anda sozinho enquanto `ativo` (atualiza na hora ao ligar). */
export function useAgora(ativo: boolean, intervalo = 250): number {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!ativo) return
    let id: number | undefined
    const ajustar = () => {
      window.clearInterval(id)
      if (document.visibilityState === "hidden") return
      setAgora(Date.now())
      id = window.setInterval(() => setAgora(Date.now()), intervalo)
    }
    ajustar()
    document.addEventListener("visibilitychange", ajustar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", ajustar)
    }
  }, [ativo, intervalo])
  return agora
}

/** Segundos que faltam, andando enquanto conta (nunca mais que a duração da fase). */
export function useRestante(intervalo = 250): number {
  const s = useSessaoFoco()
  const agora = useAgora(s.fim !== null, intervalo)
  return Math.min(L.restanteEm(s, agora), L.duracao(s.ritmo, s.fase))
}

/** As ações do Flow. Cada uma grava a sessão de hoje; a tela não precisa saber do relógio. */
export const foco = {
  comecar(): void {
    try {
      // Pede a permissão de notificação na primeira vez; não espera a resposta
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission()
    } catch {}
    gravar(L.comecar(L.doDia(atual(), isoDia()), Date.now()))
  },
  pausar(): void {
    gravar(L.pausar(L.doDia(atual(), isoDia()), Date.now()))
  },
  alternar(): void {
    if (L.rodando(atual())) foco.pausar()
    else foco.comecar()
  },
  reiniciar(): void {
    gravar(L.reiniciar(L.doDia(atual(), isoDia())))
  },
  pular(): void {
    gravar(L.pular(atual(), isoDia()))
  },
  escolherFase(f: L.Fase): void {
    gravar(L.escolherFase(L.doDia(atual(), isoDia()), f))
  },
  trocarRitmo(r: L.RitmoId): void {
    gravar(L.trocarRitmo(L.doDia(atual(), isoDia()), r))
  },
  escolherTarefa(t: L.TarefaEmFoco | null): void {
    gravar(L.escolherTarefa(L.doDia(atual(), isoDia()), t))
  },
  /** Volta a um estado guardado antes (o "Desfazer" dos avisos). */
  restaurar(s: L.Sessao): void {
    gravar(L.doDia(s, isoDia()))
  },
  /** O estado de agora (para guardar antes de uma ação e oferecer "Desfazer"). */
  agora(): L.Sessao {
    return atual()
  },
}
