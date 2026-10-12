"use client"

import { Minus, Plus, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  APARENCIA_PADRAO,
  FONTES,
  MARGENS,
  TAMANHO_MAX,
  TAMANHO_MIN,
  TEMAS,
  type Aparencia,
  type FonteLeitura,
  type MargemLeitura,
  type TemaLeitura,
} from "./aparencia"
import { Alternar, Grupo, Opcoes, PainelLeitor } from "./painel-leitor"

const ENTRELINHAS = [
  { valor: 1.3, rotulo: "Justo" },
  { valor: 1.55, rotulo: "Normal" },
  { valor: 1.8, rotulo: "Amplo" },
  { valor: 2.05, rotulo: "Extra" },
]

export function PainelAjustes({ aparencia, aoMudar, aoFechar }: { aparencia: Aparencia; aoMudar: (a: Aparencia) => void; aoFechar: () => void }) {
  const muda = (p: Partial<Aparencia>) => aoMudar({ ...aparencia, ...p })
  const entrelinha = ENTRELINHAS.reduce((a, b) => (Math.abs(b.valor - aparencia.entrelinhas) < Math.abs(a.valor - aparencia.entrelinhas) ? b : a)).valor

  return (
    <PainelLeitor titulo="Texto e página" aoFechar={aoFechar}>
      <Grupo rotulo="Tamanho da letra">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Diminuir a letra"
            disabled={aparencia.tamanho <= TAMANHO_MIN}
            onClick={() => muda({ tamanho: Math.max(TAMANHO_MIN, aparencia.tamanho - 10) })}
            className="grid h-12 flex-1 place-items-center rounded-xl bg-[var(--l-realce)] disabled:opacity-40"
          >
            <span className="flex items-center gap-1 text-sm">
              <Minus className="size-4" /> A
            </span>
          </button>
          <span className="tabular w-16 text-center text-sm font-semibold" aria-live="polite">
            {aparencia.tamanho}%
          </span>
          <button
            type="button"
            aria-label="Aumentar a letra"
            disabled={aparencia.tamanho >= TAMANHO_MAX}
            onClick={() => muda({ tamanho: Math.min(TAMANHO_MAX, aparencia.tamanho + 10) })}
            className="grid h-12 flex-1 place-items-center rounded-xl bg-[var(--l-realce)] disabled:opacity-40"
          >
            <span className="flex items-center gap-1 text-lg">
              <Plus className="size-4" /> A
            </span>
          </button>
        </div>
      </Grupo>

      <Grupo rotulo="Tema">
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-4 gap-2">
          {(Object.keys(TEMAS) as TemaLeitura[]).map((chave) => {
            const t = TEMAS[chave]
            const ativo = aparencia.tema === chave
            return (
              <button
                key={chave}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => muda({ tema: chave })}
                className={cn(
                  "grid h-14 place-items-center rounded-xl border text-sm font-medium",
                  ativo ? "ring-2 ring-[var(--l-link)] ring-offset-2 ring-offset-[var(--l-painel)]" : "",
                )}
                style={{ background: t.fundo, color: t.texto, borderColor: "var(--l-borda)" }}
              >
                {t.nome}
              </button>
            )
          })}
        </div>
      </Grupo>

      <Grupo rotulo="Fonte">
        <Opcoes<FonteLeitura>
          rotulo="Fonte"
          valor={aparencia.fonte}
          aoMudar={(fonte) => muda({ fonte })}
          opcoes={(Object.keys(FONTES) as FonteLeitura[]).map((f) => ({
            valor: f,
            rotulo: FONTES[f].nome,
            estilo: FONTES[f].pilha ? { fontFamily: FONTES[f].pilha! } : undefined,
          }))}
        />
      </Grupo>

      <Grupo rotulo="Espaço entre as linhas">
        <Opcoes rotulo="Espaço entre as linhas" valor={entrelinha} aoMudar={(entrelinhas) => muda({ entrelinhas })} opcoes={ENTRELINHAS} />
      </Grupo>

      <Grupo rotulo="Margens">
        <Opcoes<MargemLeitura>
          rotulo="Margens"
          valor={aparencia.margem}
          aoMudar={(margem) => muda({ margem })}
          opcoes={(Object.keys(MARGENS) as MargemLeitura[]).map((m) => ({ valor: m, rotulo: MARGENS[m].nome }))}
        />
      </Grupo>

      <Grupo rotulo="Alinhamento">
        <Opcoes
          rotulo="Alinhamento"
          valor={aparencia.justificado ? "j" : "e"}
          aoMudar={(v) => muda({ justificado: v === "j" })}
          opcoes={[
            { valor: "j", rotulo: "Justificado" },
            { valor: "e", rotulo: "À esquerda" },
          ]}
        />
      </Grupo>

      <Grupo rotulo="Parágrafos">
        <Opcoes<Aparencia["paragrafos"]>
          rotulo="Parágrafos"
          valor={aparencia.paragrafos}
          aoMudar={(paragrafos) => muda({ paragrafos })}
          opcoes={[
            { valor: "livro", rotulo: "Do livro" },
            { valor: "espaco", rotulo: "Espaço" },
            { valor: "recuo", rotulo: "Recuo" },
          ]}
        />
      </Grupo>

      <Grupo rotulo="Modo de leitura">
        <Opcoes<Aparencia["modo"]>
          rotulo="Modo de leitura"
          valor={aparencia.modo}
          aoMudar={(modo) => muda({ modo })}
          opcoes={[
            { valor: "paginas", rotulo: "Páginas" },
            { valor: "rolagem", rotulo: "Rolagem" },
          ]}
        />
      </Grupo>

      <div className="grid divide-y py-1" style={{ borderColor: "var(--l-borda)" }}>
        <Alternar
          rotulo="Separar sílabas no fim da linha"
          descricao="Deixa o texto justificado mais uniforme"
          valor={aparencia.hifenizar}
          aoMudar={(hifenizar) => muda({ hifenizar })}
        />
        <Alternar rotulo="Animação ao virar a página" valor={aparencia.animacao} aoMudar={(animacao) => muda({ animacao })} />
        <Alternar
          rotulo="Manter a tela acesa"
          descricao="Enquanto você lê; apaga depois de 10 minutos sem virar a página"
          valor={aparencia.telaAcesa}
          aoMudar={(telaAcesa) => muda({ telaAcesa })}
        />
      </div>

      <button
        type="button"
        onClick={() => aoMudar({ ...APARENCIA_PADRAO, tema: aparencia.tema })}
        className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--l-suave)] hover:text-[var(--l-texto)]"
      >
        <RotateCcw className="size-4" /> Voltar ao padrão
      </button>
    </PainelLeitor>
  )
}
