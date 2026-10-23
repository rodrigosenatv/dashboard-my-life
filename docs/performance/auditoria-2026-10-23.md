# Auditoria de performance — Dashboard my life

Análise da arquitetura, 276 arquivos de src inventariados, 44 páginas, rotas, providers, hooks de dados, importação, leitor, CSS, assets, migração e integração Supabase. O [plano e diagnóstico priorizado](../superpowers/plans/2026-10-23-performance.md) registra as causas identificadas antes das alterações. Esta auditoria não substitui perfil de uma sessão autenticada em produção.

## Melhorias executadas

| Prioridade | Gargalo e impacto | Implementação |
|---|---|---|
| P0 | Dependência Next com alerta crítico na auditoria inicial | Patch 16.4.2 compatível; build validado. Auditoria npm atual sem vulnerabilidades, incluindo dev. |
| P1 | Requisições e paginação continuam após cancelamento | AbortSignal chega ao HTTP e interrompe lotes; preservadas chaves e comportamento do cache otimista. |
| P1 | Empates na relação capture_projects | Ordenação composta capture_id + project_id mantém desempate estável. |
| P1 | Parser e ZIP bloqueiam interface e entram no bundle de configurações | Imports por ação; descompactação e preparação do plano em worker com transferência de buffers, encerramento e cancelamento. |
| P1 | Formulários fechados montam hooks e código | Quatro formulários sob demanda, loading com fechamento e recuperação local após erro. Menu Novo antecipa apenas opção sob foco/ponteiro. |
| P1 | Abertura assíncrona do leitor pode terminar depois de sair | Fechamento após resolução cancelada, listeners abortáveis e limpeza de timers; destruição do PDF também em abort/erro. |
| P2 | Fotos grandes e pipeline duplicado | Helper único no upload: JPEG/PNG estático elegível vira WebP menor, dimensão limitada, recursos liberados. |
| P2 | Árvore e contagens repetem filtros completos | Índices de filhos/contagens e buscas memorizadas; construção iterativa tolera ciclos e profundidade elevada. |
| P2 | Navegação interna markdown recarrega aplicação | Next Link para caminhos internos e boundary de loading reutiliza skeleton atual. |
| P2 | Contextos e Markdown recalculam sem mudança | Valores de providers estáveis e Markdown memorizado. Tema salvo respeitado antes da persistência. |
| P2 | Timers e imagens disputam trabalho fora da tela | Relógio visual pausa em aba oculta; imagens de coleções usam lazy e decoding async. |

## Compressão automática de fotos e capas

Aplica-se a novos envios/substituições de capas em Configurações, fotos de itens/guarda-roupa/hobbies, viagens e avaliações de treino. Processamento no dispositivo antes do upload, sem serviço externo ou biblioteca adicional.

- JPEG/PNG estático a partir de 150 KiB e até 20 MiB, sujeito ao limite já existente de cada formulário (capa principal: 8 MiB).
- WebP com qualidade 0,82; lado maior até 1920 px na capa principal e 1600 px nas fotos de coleções/viagens/treino. Não amplia imagens pequenas.
- Aplica orientação EXIF do bitmap e preserva canal alpha. Mantém original se a conversão falhar ou não ficar menor.
- GIF/APNG, SVG, WebP/AVIF e demais formatos permanecem intactos. Imagens acima de 32 milhões de pixels ou lado de 16384 px não são decodificadas pelo helper.
- Extensão, MIME e tamanho enviados acompanham o resultado. Bitmap e canvas são liberados.
- Arquivos existentes no Storage e anexos de importações não foram regravados. O percentual de redução depende da imagem; não foi medido com codificador de navegador real nesta execução.

## Comparação dos scripts de produção

Baseline 072b067 e working tree compilados com as mesmas dependências (Next 16.4.2) para isolar mudanças no código. Soma dos arquivos JS referenciados por script no HTML, comprimidos individualmente com gzip; não corresponde a download real após login, nem soma os chunks carregados posteriormente.

| Rota | Antes (gzip bytes) | Depois (gzip bytes) | Redução |
|---|---:|---:|---:|
| /configuracoes | 390856 | 360524 | 7,76% |
| /conteudo/planner | 377565 | 372617 | 1,31% |
| / | 365274 | 363220 | 0,56% |
| /vida/hobbies | 443044 | 440597 | 0,55% |
| /vida/viagens | 443910 | 441550 | 0,53% |
| /rotina/tarefas | 371863 | 371178 | 0,18% |

Os ganhos de bundle são modestos na maioria das rotas. Algumas cresceram até 0,28% com o tratamento de falha/loading e organização dos chunks; não se afirma redução universal. Os maiores benefícios adicionais estão no trabalho evitado (consultas canceladas, formulários fechados, ZIP fora da thread e índices), ainda sem quantificação de INP/FPS em dispositivo real.

[Dados das 46 saídas HTML](bundles-2026-10-23.json). Reproduzir: `npm run build` e `node scripts/medir-bundles.mjs > bundles.json`.

## Verificação

- `npm test`: 15 testes, zero falhas. Cobrem paginação completa/cancelamento/erros; equivalência da árvore, busca, ciclos e 30 mil níveis; elegibilidade/fallback/liberação de imagens com mocks; worker real em worker_threads com ZIP aninhado, anexos intactos e ZIP inválido.
- `npm run lint`, `npm run check`, `npm run build` e `git diff --check`: passaram.
- `npm audit` e `npm audit --omit=dev`: zero vulnerabilidades no resultado atual do registro.
- Revisão independente encontrou compressão duplicada e falta de recuperação de chunk; ambos corrigidos e revisados novamente.
- Um build encontrou cache persistente do Turbopack truncado; reconstrução limpa passou. Nenhuma alteração de aplicação foi usada para mascarar esse erro.

## Limites e próximos gargalos

1. **Dados completos em memória:** a paginação HTTP ainda carrega todas as linhas para preservar filtros, ordenação, buscas e agregados locais. Próxima etapa: paginação funcional/virtualização com agregados no servidor, validada por módulo; não truncar listas silenciosamente.
2. **Banco real:** nenhum dos projetos Supabase conectados correspondeu a este app. Não houve alteração em banco, EXPLAIN, medição de índices, análise de latência ou teste autenticado. RLS, índices existentes e permissões foram preservados. Não foram encontradas subscriptions realtime para otimizar.
3. **Navegador/mobile:** instalação do Chromium falhou no ambiente. Sem validação visual de codificação WebP, retry de chunks, leitura durante navegação ou sessão completa; sem pontuação Lighthouse, Core Web Vitals, FPS ou perfil de heap. Esses testes seguem necessários antes da promoção para produção.
4. **Assinaturas de imagens:** lazy adia download/decodificação, mas a geração de URLs assinadas ainda ocorre nos hooks; agrupar/adiar assinaturas requer validação do cache e expiração com Storage real.
5. **Arquitetura preservada:** não houve troca do modelo SPA/client-only, hidratação, desenho visual, CSS ou cache privado por cache compartilhado. Fontes locais, reduced-motion, leitor offline e imports já dinâmicos foram mantidos.

As alterações estão em branch separada para revisão. Não representam um deploy em produção.
