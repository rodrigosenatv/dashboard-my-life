"use client"

import * as React from "react"
import { ChevronDown, Settings2, Sparkles, Square, X } from "lucide-react"
import { toast } from "sonner"
import { Botao } from "@/components/ui/button"
import { Progresso, Segmentos } from "@/components/ui/basicos"
import { Campo, Entrada } from "@/components/ui/campos"
import { LinkIntencao as Link } from "@/components/ui/link-intencao"
import { credencial, provedoresAtivos, useConfigIA } from "@/lib/ia/chaves-locais"
import { infoProvedor } from "@/lib/ia/info"
import { cn } from "@/lib/utils"
import {
  MODELOS_ROTEIRO,
  ehLacunaDoTopico,
  ehParteDoTitulo,
  lacunasDoModelo,
  lerResposta,
  modeloDoFormato,
  montarPedido,
  montarRoteiro,
  partesSemResposta,
  rotuloDaLacuna,
  semLinhaIncompleta,
  tituloEscolhido,
  type IdModeloRoteiro,
} from "@/features/conteudo/roteiro-ia"
import { JanelaPromptsRoteiro } from "./prompts-roteiro"
import { pedirRoteiro, useConfigRoteiroIA, useGravarRoteiroIA } from "./roteiro-ia-dados"

export type MudancasGeradas = { titulo?: string; roteiro?: string; formato?: string }

const comMaiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/**
 * "Gerar com IA" no conteúdo: preenche as lacunas ([TÓPICO], [NICHO]…) e, com um clique, a IA escreve o roteiro
 * inteiro pelos prompts de Configurações (título, gancho, desenvolvimento, legenda, hashtags, checklist…). O
 * roteiro aparece enquanto ela escreve; o título vai para o campo do título; tudo com "Desfazer".
 */
export function GerarRoteiro({
  titulo,
  formato,
  plataformas,
  linha,
  roteiro,
  bloqueado,
  abertoDeInicio,
  aoAplicar,
  aoGerando,
}: {
  titulo: string
  formato: string
  plataformas: string[]
  /** O nome da linha editorial. */
  linha: string | null
  roteiro: string
  /** O roteiro gravado ainda está chegando: gerar agora seria apagado por ele. */
  bloqueado?: boolean
  /** Aberto num conteúdo sem roteiro gravado; null enquanto o roteiro gravado não chega. */
  abertoDeInicio: boolean | null
  aoAplicar: (m: MudancasGeradas) => void
  aoGerando: (gerando: boolean) => void
}) {
  const cfgIA = useConfigIA()
  const provedor = provedoresAtivos(cfgIA)[0] ?? null
  const cred = provedor ? credencial(cfgIA, provedor) : null
  const nomeIA = provedor ? (infoProvedor(provedor)?.nome ?? "IA") : "IA"
  const { config, carregando } = useConfigRoteiroIA()
  const gravar = useGravarRoteiroIA()

  // Até a pessoa abrir ou fechar, vale o que a janela diz (aberto sem roteiro gravado, fechado com)
  const [escolhaAberto, setAberto] = React.useState<boolean | null>(null)
  const aberto = escolhaAberto ?? abertoDeInicio ?? false
  const [escolhido, setEscolhido] = React.useState<IdModeloRoteiro | null>(null)
  const [digitado, setDigitado] = React.useState<Record<string, string>>({})
  const [gerando, setGerando] = React.useState(false)
  const [progresso, setProgresso] = React.useState({ texto: "", parte: 0, total: 1 })
  const [sugestao, setSugestao] = React.useState<string | null>(null)
  const [verPrompts, setVerPrompts] = React.useState(false)
  const abortar = React.useRef<AbortController | null>(null)
  // O título pode mudar enquanto a IA escreve: no fim vale o que está no campo
  const tituloAgora = React.useRef(titulo)
  React.useEffect(() => {
    tituloAgora.current = titulo
  }, [titulo])
  // Fechou a janela no meio: o pedido para (e deixa de gastar a cota)
  React.useEffect(() => () => abortar.current?.abort(), [])

  const modelo = escolhido ?? modeloDoFormato(formato)
  const info = MODELOS_ROTEIRO.find((m) => m.id === modelo)!
  const partes = config.modelos[modelo]
  const ativas = partes.filter((p) => p.ativa)
  const lacunas = lacunasDoModelo(partes, config.instrucoes)
  const valor = (l: string) => digitado[l] ?? (ehLacunaDoTopico(l) ? "" : (config.lacunas[l] ?? ""))
  // O tópico vazio vale o título do conteúdo
  const efetivo = (l: string) => valor(l).trim() || (ehLacunaDoTopico(l) ? titulo.trim() : "")
  const topicos = lacunas.filter(ehLacunaDoTopico)
  const falta = topicos.length ? topicos.some((l) => !efetivo(l)) : !titulo.trim() && !lacunas.some((l) => efetivo(l))
  // Sem os prompts da pessoa ainda (ou com o roteiro gravado chegando), gerar agora usaria o padrão ou seria apagado
  const esperando = Boolean(bloqueado) || carregando

  const gerar = async () => {
    if (gerando || esperando || !cred || falta) return
    const valores = Object.fromEntries(lacunas.map((l) => [l, efetivo(l)]))
    const topico = topicos.map((l) => valores[l]).find(Boolean) ?? ""
    const antes: MudancasGeradas = { titulo, roteiro, formato }
    const formatoNovo = formato ? undefined : info.formato
    setSugestao(null)

    // As lacunas que não mudam a cada conteúdo ([NICHO], [PALAVRA-CHAVE]…) chegam preenchidas da próxima vez
    const lembrar = Object.fromEntries(Object.entries(valores).filter(([l, v]) => v && !ehLacunaDoTopico(l)))
    if (Object.entries(lembrar).some(([l, v]) => config.lacunas[l] !== v)) void gravar((c) => ({ ...c, lacunas: { ...c.lacunas, ...lembrar } })).catch(() => {})

    const { texto: pedido, partesIA } = montarPedido(partes, valores, { titulo, formato: formato || info.formato, plataformas, linha }, config.instrucoes)
    const desfazer = {
      label: "Desfazer",
      onClick: () => {
        aoAplicar(antes)
        setSugestao(null)
      },
    }
    // Só textos fixos: não precisa da IA
    if (!partesIA.length) {
      aoAplicar({ roteiro: montarRoteiro(partes, null, valores), formato: formatoNovo })
      toast.success("Roteiro montado", { action: desfazer })
      return
    }

    const ctrl = new AbortController()
    abortar.current = ctrl
    setGerando(true)
    aoGerando(true)
    setProgresso({ texto: `Pedindo ao ${nomeIA}…`, parte: 0, total: partesIA.length })
    let resultado = { texto: "", modelo: null as string | null, erro: null as string | null }
    let falha: string | null = null
    let ultimaTela = 0
    try {
      resultado = await pedirRoteiro({
        credencial: cred,
        texto: pedido,
        sinal: ctrl.signal,
        aoPedaco: (acumulado) => {
          resultado.texto = acumulado
          // A tela acompanha a IA, sem redesenhar o roteiro a cada pedacinho
          if (Date.now() - ultimaTela < 150) return
          ultimaTela = Date.now()
          const leitura = lerResposta(semLinhaIncompleta(acumulado), partesIA)
          if (leitura.atual < 0) return setProgresso({ texto: "Começando a escrever…", parte: 0, total: partesIA.length })
          aoAplicar({ roteiro: montarRoteiro(partes, leitura, valores, { parcial: true }) })
          setProgresso({
            texto: `Escrevendo ${partesIA[leitura.atual].nome} · ${leitura.atual + 1} de ${partesIA.length}`,
            parte: leitura.atual,
            total: partesIA.length,
          })
        },
      })
    } catch (e) {
      if ((e as Error).name !== "AbortError") falha = (e as Error).message
    } finally {
      abortar.current = null
      setGerando(false)
      aoGerando(false)
    }

    const parou = ctrl.signal.aborted
    const erro = falha ?? resultado.erro
    const texto = resultado.texto
    if (!texto.trim()) {
      if (!parou) toast.error("Não foi possível gerar o roteiro.", { description: erro ? comMaiuscula(erro) : "A IA não devolveu texto. Tente de novo." })
      return
    }
    const leitura = lerResposta(texto, partesIA)
    // Parou antes da primeira parte: o roteiro nem chegou a mudar
    if (parou && leitura.atual < 0) return void toast("Geração cancelada", { description: "O roteiro ficou como estava." })
    const mudancas: MudancasGeradas = { roteiro: montarRoteiro(partes, leitura, valores, { parcial: parou, bruto: texto }), formato: formatoNovo }
    // O título criado vai para o campo quando ele está vazio ou é o próprio tópico; senão, fica a sugestão
    const parteTitulo = partesIA.findIndex(ehParteDoTitulo)
    // Parou no meio do título: a primeira linha pode estar cortada
    const tituloInteiro = (!parou && !erro) || leitura.atual > parteTitulo
    const novo = parteTitulo >= 0 && tituloInteiro ? tituloEscolhido(leitura.conteudos[parteTitulo]) : null
    let sugerido = false
    if (novo) {
      const atual = tituloAgora.current.trim()
      if (!atual || atual === topico) mudancas.titulo = novo
      else if (atual !== novo) {
        setSugestao(novo)
        sugerido = true
      }
    }
    aoAplicar(mudancas)

    if (parou) return void toast("Geração interrompida", { description: "O que já tinha saído ficou no roteiro.", action: desfazer })
    if (erro) return void toast.error("A resposta parou no meio", { description: comMaiuscula(erro), action: desfazer })
    // Deu certo: o cartão fecha e o roteiro fica à vista (a não ser que haja um título sugerido para decidir)
    if (!sugerido) setAberto(false)
    const faltaram = partesSemResposta(partesIA, leitura)
    const via = resultado.modelo && (provedor === "openrouter" || provedor === "gemini") ? `via ${resultado.modelo} · ` : ""
    toast.success("Roteiro gerado", {
      description:
        leitura.atual < 0
          ? "A IA não separou as partes: o texto veio inteiro. Gere de novo ou ajuste à mão."
          : faltaram.length
            ? `A IA não escreveu: ${faltaram.join(", ")}. Gere de novo ou complete à mão.`
            : `${via}revise e salve`,
      action: desfazer,
    })
  }

  const nomes = ativas.map((p) => p.nome)
  const resumo = nomes.length > 3 ? `${nomes.slice(0, 3).join(", ")} e mais ${nomes.length - 3}` : nomes.join(", ")

  return (
    <div className="rounded-xl border border-line bg-ink/[0.02]">
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          aria-expanded={aberto}
          aria-controls="ct-ia-corpo"
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left"
        >
          <span aria-hidden className="orbe-ia size-7" data-pensando={gerando ? "" : undefined} data-apagado={cred ? undefined : ""} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Gerar com IA</span>
            <span className="block truncate text-xs text-ink-3">
              {gerando ? progresso.texto : cred ? `${info.rotulo} · ${resumo}` : "Nenhuma IA conectada neste navegador"}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-3 transition-transform", aberto && "rotate-180")} />
        </button>
        {/* O andamento, para quem usa leitor de tela */}
        <p role="status" className="sr-only">
          {gerando ? progresso.texto : ""}
        </p>
        <Botao variante="fantasma" tamanho="icone-sm" aria-label="Configurar os prompts do roteiro" title="Configurar os prompts" onClick={() => setVerPrompts(true)}>
          <Settings2 />
        </Botao>
      </div>

      {aberto ? (
        <div id="ct-ia-corpo" className="grid gap-3 border-t border-line p-3">
          {!cred ? (
            <div className="grid justify-items-start gap-2.5">
              <p className="text-sm text-ink-2">Conecte uma IA para escrever o roteiro inteiro com um clique. O OpenRouter tem modelos gratuitos; a chave fica só neste navegador.</p>
              <Botao asChild variante="contorno" tamanho="sm">
                <Link href="/configuracoes#ia">Conectar uma IA</Link>
              </Botao>
            </div>
          ) : gerando ? (
            // Enquanto a IA escreve, o cartão fica baixo para o roteiro aparecer logo abaixo dele
            <div className="grid gap-3">
              <Progresso rotulo="Partes do roteiro escritas" valor={Math.max(4, (progresso.parte / progresso.total) * 100)} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Botao variante="contorno" onClick={() => abortar.current?.abort()}>
                  <Square className="fill-current" /> Parar
                </Botao>
                <p className="min-w-0 flex-1 basis-48 text-xs text-ink-3">O roteiro aparece abaixo enquanto a IA escreve. O que já saiu fica, se você parar.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden className="text-xs text-ink-3">
                  Prompts de
                </span>
                <Segmentos<IdModeloRoteiro>
                  rotulo="Prompts de qual modelo"
                  valor={modelo}
                  aoMudar={setEscolhido}
                  opcoes={MODELOS_ROTEIRO.map((m) => ({ valor: m.id, rotulo: m.rotulo }))}
                />
              </div>
              {lacunas.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {lacunas.map((l, i) => {
                    const doTopico = ehLacunaDoTopico(l)
                    return (
                      <Campo key={l} rotulo={rotuloDaLacuna(l)} htmlFor={`ct-lacuna-${i}`} dica={doTopico ? "Vazio, vale o título do conteúdo." : undefined}>
                        <Entrada
                          id={`ct-lacuna-${i}`}
                          value={valor(l)}
                          maxLength={300}
                          placeholder={doTopico ? titulo.trim() || "Sobre o que é este conteúdo?" : "Vazio: a IA deduz pelo tópico"}
                          onChange={(e) => setDigitado((d) => ({ ...d, [l]: e.target.value }))}
                          onKeyDown={(e) => {
                            // Enter aqui gera, em vez de enviar o formulário do conteúdo
                            if (e.key !== "Enter") return
                            e.preventDefault()
                            void gerar()
                          }}
                        />
                      </Campo>
                    )
                  })}
                </div>
              ) : null}

              {sugestao ? (
                <div className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="text-ink-3">Título criado pela IA: </span>
                    {sugestao}
                  </p>
                  <Botao
                    variante="contorno"
                    tamanho="sm"
                    onClick={() => {
                      aoAplicar({ titulo: sugestao })
                      setSugestao(null)
                    }}
                  >
                    Usar
                  </Botao>
                  <Botao variante="fantasma" tamanho="icone-sm" aria-label="Manter o meu título" onClick={() => setSugestao(null)}>
                    <X />
                  </Botao>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Botao variante="primario" disabled={falta || esperando} onClick={() => void gerar()}>
                  <Sparkles /> {roteiro.trim() ? "Gerar de novo" : "Gerar roteiro completo"}
                </Botao>
                <p className="min-w-0 flex-1 basis-48 text-xs text-ink-3">
                  {esperando
                    ? "Carregando…"
                    : falta
                      ? "Escreva o título ou o tópico para gerar."
                      : `Um pedido ao ${nomeIA} escreve ${ativas.length === 1 ? "a parte" : `as ${ativas.length} partes`} de uma vez. Revise antes de salvar.`}
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}

      <JanelaPromptsRoteiro aberta={verPrompts} aoMudar={setVerPrompts} modeloInicial={modelo} />
    </div>
  )
}
