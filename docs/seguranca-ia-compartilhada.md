# Controle de uso da IA compartilhada (Etapa 2 — primeira correção)

A chave compartilhada `ANTHROPIC_API_KEY` somente pode ser usada com quotas persistentes
no PostgreSQL do Supabase. Contadores em memória não funcionam corretamente entre
instâncias da Vercel.

## Ordem de ativação (não aplicada automaticamente)

1. Identificar e confirmar a **instância Supabase correta** do Dashboard My Life.
2. Aplicar a migration `supabase/migrations/20261023180000_limite_ia_compartilhada.sql`.
   Conferir as permissões das RPCs: somente `service_role`; tabelas em schema `app_private`
   com RLS habilitado e sem acesso para `anon` ou `authenticated`.
3. Configurar `SUPABASE_SERVICE_ROLE_KEY` como variável secreta **somente do servidor**
   na Vercel. Não usar `NEXT_PUBLIC_`, não expor em logs nem no navegador.
4. Criar um novo deployment, após aprovação para publicação.
5. Validar em ambiente de testes: 401 sem login, 429 após o limite, 503 se quota
   indisponível, `Retry-After`, cancelamento e concorrência entre instâncias.

## Política inicial

- 8 pedidos por usuário por hora, máximo de 60 pedidos totais por dia UTC.
- 1 resposta simultânea por usuário, 4 simultâneas globalmente.
- Reserva expira em 8 minutos se uma instância cair.
- A quota é consumida no momento da reserva, mesmo se o provedor falhar:
  evita tentativas gratuitas ilimitadas.
- Somente o fallback com chave compartilhada é afetado: chaves pessoais enviadas
  pelo usuário continuam usando o comportamento anterior.

## Segurança e operação

As RPCs são `SECURITY INVOKER` e só recebem `EXECUTE` pela role
`service_role`. O servidor verifica o JWT com `getClaims()` antes de invocar
a RPC. Nunca passar a chave privilegiada para funções client-side.

Se a migration, a chave privilegiada ou o banco não estiverem disponíveis,
a chamada compartilhada é negada (503) e não tenta o provedor, protegendo a
conta contra cobranças não controladas. O `GET /api/ia` só informa que o fallback
está habilitado quando as duas credenciais estão configuradas.

**Pendência:** a política limita número de pedidos, não estima ou impõe um teto
exato de tokens/custo por resposta. Para um orçamento financeiro estrito seria
necessário telemetria de tokens e um orçamento parametrizado. Não alegar
proteção por valor monetário exato.

**Testes:** `npm test` inclui testes unitários do contrato da quota e uma
checagem estática da migration e do handler. É necessário validar as RPCs
com PostgreSQL real em ambiente isolado antes do merge/deploy.
