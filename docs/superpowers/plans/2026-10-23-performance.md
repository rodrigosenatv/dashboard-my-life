# Otimização de performance

> Execução: superpowers:executing-plans; revisão independente ao final.

**Objetivo:** reduzir trabalho de rede, CPU e carregamento sem mudar funcionalidades ou identidade visual.
**Arquitetura:** preservar Next App Router, React Query, RLS e o modelo de coleções existente. Atuar nas causas observadas, com imports sob demanda, cancelamento real, índices em memória e cleanup de recursos.
**Stack:** Next 16, React 19, TypeScript, Supabase, Tailwind.
**Especificação:** solicitação do usuário nesta sessão; preservar recursos, design, desktop e mobile.

## Diagnóstico anterior às alterações

Inventário: 276 arquivos em src, 44 páginas. Leitura da arquitetura, providers, navegação, hooks, chamadas de rede, migração SQL, assets, CSS, listeners, leitor e importador; build de referência e inventário dos scripts de cada rota.

| Prioridade | Evidência | Impacto / decisão |
|---|---|---|
| P0 | Auditoria npm: Next 16.4.0 vulnerável | Atualizar patch compatível e validar build; não executar downgrade sugerido para ESLint. |
| P1 | useLista/useRegistro ignoram AbortSignal | Paginação continua após navegação/cancelamento de mutação; propagar cancelamento até HTTP e entre lotes. |
| P1 | capture_projects ordena apenas capture_id | Empates podem tornar paginação inconsistente; incluir project_id. |
| P1 | Configurações importa ZIP, parser e executor estaticamente | Bytes de importação pagos sem uso; carregar seção sob demanda e descompactar assincronamente. |
| P1 | Formulários fechados montados nas páginas | JS e hooks desnecessários; separar formulários pesados e montar quando abertos. |
| P1 | Leitor abre recurso assíncrono após cleanup | Recursos podem sobreviver à saída durante abertura; fechar novamente após resolução e limpar timers/documento. |
| P2 | Árvore chama filter e contagem recursiva por nó | Custo quadrático em bibliotecas grandes; indexar filhos/ancestrais e memorizar buscas. |
| P2 | Imagens de coleções sem loading lazy | Download fora do viewport; adiar download e decodificar assincronamente. Assinaturas permanecem nos hooks. |
| P2 | Links markdown internos usam âncora comum | Reload completo; usar navegação Next para caminhos internos. |
| P2 | Sem loading.tsx no segmento principal | Adicionar fallback de navegação reutilizando o esqueleto atual. |
| P2 | Providers criam objetos de contexto por render | Estabilizar valores; evitar propagação sem mudança de dados. |
| P2 | Relógio visual conta mesmo com aba oculta | Suspender atualizações visuais e atualizar ao voltar; manter alarme real. |
| P2 | Contagem de coleções filtra todos os itens por coleção | Índice linear compartilhado por render. |
| P3 | Listas completas, histórico e conteúdo JSON nas coleções | Paginação HTTP existe, mas não limita memória; alteração para paginação funcional requer preservar filtros/agregados. Não truncar listas silenciosamente. |

## Limites e decisões

- Nenhum projeto Supabase disponível corresponde ao Dashboard my life: sem EXPLAIN, estatísticas ou migrações em produção; RLS já usa `(select auth.uid())` e vários índices existem.
- Sem subscriptions realtime identificadas no código da aplicação. Não adicionar realtime desnecessariamente.
- Shell de conteúdo é deliberadamente client-only por sessão/fuso; não remover a proteção de hidratação nem introduzir cache compartilhado de dados privados.
- CSS tem reduced-motion, fontes locais e dimensões em grande parte das capas. Não reestilizar indiscriminadamente.
- PDF e Foliate já usam imports dinâmicos; preservar workers, IndexedDB e leitura offline.
- Medir bytes dos scripts no HTML de produção; isso não equivale a Lighthouse, FPS ou Web Vitals de usuários reais.

## Tarefas

- [x] 1. Criar regressões executáveis para cancelamento/paginação, árvore e ZIP; aplicar otimizações de dados com mesmas chaves de cache.
- [x] 2. Separar importação/configurações e formulários sob demanda; manter feedback de carregamento e tratamento de falha.
- [x] 3. Melhorar navegação, imagens, contexto e timers; preservar ações, foco e responsividade.
- [x] 4. Corrigir cleanup do leitor/conversor; validar erros e cancelamento durante abertura.
- [x] 5. Atualizar patches de segurança compatíveis; executar testes, lint, TypeScript e build; comparar bundles.
- [x] 6. Revisão independente, relatório com evidências e PR sem merge automático.

## Foco da revisão

Cache otimista e chaves existentes; listas acima de 1000 linhas; abort entre lotes; arquivos ZIP aninhados; saída durante abertura do livro; navegação interna com fragmentos; loading mobile; ausência de credenciais reais não deve ser apresentada como teste autenticado.

## Registro de execução

- Baseline: commit 072b067; lint limpo. Compilação e TypeScript passaram; build foi interrompido pelo aviso de segurança do Next após gerar rotas.
- Decisão: checkout recém-clonado e branch dedicada, preservando main. Execução já autorizada pelo pedido do usuário.

- Concluído: 15 testes, lint, TypeScript, build limpo, auditoria npm e revisão independente. [Relatório e limites](../../performance/auditoria-2026-10-23.md).
- Medição repetida com mesmo Next 16.4.2 nos dois builds; resultado detalhado no relatório.
