# IA pessoal — chave e consumo de cada usuário

O Dashboard My Life não fornece chaves, créditos nem cota de IA compartilhada.

- Cada usuário cria uma conta no provedor de sua escolha (Anthropic/Claude, OpenAI ou Google/Gemini) e cadastra a sua chave em **Configurações → Inteligência artificial**.
- Todo o consumo da API é atribuído à conta do provedor que emitiu a chave. O Dashboard My Life não paga por solicitações dos usuários.
- Assinaturas dos aplicativos de chat podem não incluir acesso ou créditos de API.
- As chaves são salvas no armazenamento local deste navegador e isoladas por conta. Ao sair da conta, elas são apagadas; em outro dispositivo devem ser cadastradas novamente.
- A chave é transmitida à API autenticada do Dashboard apenas durante a solicitação, para consultar o provedor escolhido. Ela não é salva no Supabase.
- Sem chave pessoal válida, a API retorna erro 400 e não envia nenhum pedido ao provedor. O sistema não consulta credenciais globais da Vercel.

## Histórico de banco

A migration de limitação da IA compartilhada `20261023180000_limite_ia_compartilhada.sql` foi aplicada antes dessa decisão e permanece no histórico para garantir reprodutibilidade. Suas tabelas e RPCs privadas já não são chamadas pelo código. A migration de proteção de referências entre usuários permanece necessária.

## Configuração da Vercel

Não utilize `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` nem `SUPABASE_SERVICE_ROLE_KEY` para oferecer IA compartilhada. Após publicar a implementação, remova as credenciais legadas se não forem usadas por outros módulos.
