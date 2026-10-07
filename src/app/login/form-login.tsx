"use client"

import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Botao } from "@/components/ui/button"
import { Campo, Entrada } from "@/components/ui/campos"
import { supabase } from "@/lib/supabase/client"

function traduzir(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("invalid login")) return "E-mail ou senha incorretos."
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar."
  if (m.includes("already registered") || m.includes("already been registered")) return "Esse e-mail já tem conta. Entre com sua senha."
  if (m.includes("password should be")) return "A senha precisa ter pelo menos 6 caracteres."
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Novos cadastros estão desativados neste app."
  if (m.includes("rate limit")) return "Muitas tentativas seguidas. Espere um minuto e tente de novo."
  if (m.includes("fetch")) return "Sem conexão com o servidor. Verifique a internet."
  return msg
}

export function FormLogin() {
  const router = useRouter()
  const params = useSearchParams()
  const voltar = params.get("voltar") || "/"
  const [modo, setModo] = React.useState<"entrar" | "criar">("entrar")
  const [email, setEmail] = React.useState("")
  const [senha, setSenha] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(
    params.get("erro") === "link" ? "O link expirou ou já foi usado. Entre com e-mail e senha." : null,
  )

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setEnviando(true)
    try {
      const sb = supabase()
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha })
        if (error) throw error
        router.replace(voltar.startsWith("/") ? voltar : "/")
        router.refresh()
      } else {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        if (data.session) {
          router.replace("/")
          router.refresh()
        } else {
          setAviso(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail e clique no link para entrar.`)
          setModo("entrar")
        }
      }
    } catch (err) {
      setErro(traduzir(err instanceof Error ? err.message : String(err)))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-8 grid gap-4">
      <Campo rotulo="E-mail" htmlFor="email">
        <Entrada
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 text-base"
        />
      </Campo>
      <Campo rotulo="Senha" htmlFor="senha" dica={modo === "criar" ? "Pelo menos 6 caracteres." : undefined}>
        <Entrada
          id="senha"
          type="password"
          autoComplete={modo === "entrar" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="h-11 text-base"
        />
      </Campo>

      {erro ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" className="rounded-md bg-pen-soft px-3 py-2 text-sm text-pen">
          {aviso}
        </p>
      ) : null}

      <Botao type="submit" variante="primario" tamanho="lg" disabled={enviando}>
        {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
      </Botao>

      <p className="text-center text-sm text-ink-2">
        {modo === "entrar" ? "Primeiro acesso?" : "Já tem conta?"}{" "}
        <button
          type="button"
          className="font-medium text-pen underline-offset-4 hover:underline"
          onClick={() => {
            setModo(modo === "entrar" ? "criar" : "entrar")
            setErro(null)
          }}
        >
          {modo === "entrar" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </form>
  )
}
