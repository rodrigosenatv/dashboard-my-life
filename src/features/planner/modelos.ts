/**
 * Modelos de roteiro trazidos dos templates "[Reels] Viral Canva" e
 * "[Carrossel] Viral Canva" do Planner de Conteúdo no Notion.
 * Os prompts ficam em blocos de código: na leitura cada um ganha os botões
 * Copiar e Usar no assistente.
 */

const PROMPT_TITULOS = `Por favor, preciso de ideias provocativas, criativas e envolventes de títulos para o tópico [TÓPICO]. Os títulos devem ser curtos (menos de 10 palavras), intrigantes e despertar curiosidade, interesse e desejo. Crie 5 títulos para cada estilo:

[HEADLINE PROVOCATIVA]
[MANCHETE DE CAPA DE REVISTA]
[CLICK BAIT]
[COM CITAÇÕES OU DEPOIMENTOS]
[COM NÚMEROS OU ESTATÍSTICAS]
[COM PROMESSAS]
[FOMO]
[COM PROVOCAÇÃO OU POLÊMICA]
[COM PERGUNTAS]`

const PROMPT_LEGENDA = `Por favor escreva 220 palavras de um artigo explicativo sobre o tópico [TÓPICO].

Use um estilo informal e direto, com frases e parágrafos curtos e alguns emojis. Prenda a atenção do início ao fim com perguntas e frases de ligação em cada parágrafo. Comece mergulhando direto no assunto, sem introdução.

No final faça um CTA para deixar um comentário com a palavra [PALAVRA-CHAVE].`

const PROMPT_HASHTAGS = `[LEGENDA]

Essa é a legenda do meu post no Instagram, liste 25 hashtags de alta qualidade e que são tendências no Instagram.`

const PROMPT_IDEOGRAM = `Uma ilustração 3D estilo fotorrealista visualmente cativante de [ELEMENTO OU OBJETO PRINCIPAL] com um toque minimalista. A atmosfera geral da imagem é futurista.`

const CHECKLIST = `## Checklist de revisão

> Use o máximo possível de leis do Código Viral para aumentar o potencial do conteúdo.

**Qualitativo**

- [ ] O Homem
- [ ] O Nicho
- [ ] O Funil
- [ ] O Tempo
- [ ] O Timing

**Otimização**

- [ ] O Gancho
- [ ] O CTA
- [ ] O Áudio em alta
- [ ] O Algoritmo
- [ ] O Título
- [ ] O 3 em 1`

export const MODELO_REELS = `## Ideias de Reels

\`\`\`
Considerando o público-alvo formado principalmente por [PÚBLICO-ALVO], crie 10 ideias de vídeos Reels para Instagram que ressoem com seus desejos e necessidades.
\`\`\`

## Título

_Escreva o título que vai no vídeo (se for usar)._



\`\`\`
${PROMPT_TITULOS}
\`\`\`

## Gancho

_Os primeiros 2 segundos são cruciais: hipnotize sua audiência._



\`\`\`
Tenho um perfil no Instagram sobre [NICHO]. Reescreva estes modelos de gancho preenchendo o que está entre chaves e adaptando ao meu nicho:

1. {número} estratégias comprovadas para {objetivo} que todos podem usar.
2. Como {ação ou habilidade} pode transformar sua {área da vida}.
3. A verdade surpreendente sobre {tópico} revelada.
4. {número} mitos comuns sobre {tópico} desmascarados.
5. Por que {ação ou estratégia} é a chave para {resultado}.
\`\`\`

## Desenvolvimento

_Direto ao ponto: uma frase do vídeo em cada linha._



\`\`\`
Por favor crie um vídeo tutorial sobre [ASSUNTO] com 300 palavras. Faça o início muito impactante, não se apresente e mergulhe direto no conteúdo com uma afirmação ousada e provocativa. Tom informal, estilo intelectual, direto e prático.
\`\`\`

## Call to action

_Não faça a audiência raciocinar: entregue duas opções ou uma palavra-chave._



## Legenda do vídeo



\`\`\`
${PROMPT_LEGENDA}
\`\`\`

\`\`\`
${PROMPT_HASHTAGS}
\`\`\`

## Elementos e cenas que pretendo usar

-

\`\`\`
Crie uma lista de ideias para elementos, cenas e takes que sejam relevantes para o post acima.
\`\`\`

## Capa no Ideogram

_Traduza o prompt para o inglês antes de usar em [ideogram.ai](https://ideogram.ai)._

\`\`\`
${PROMPT_IDEOGRAM}
\`\`\`

${CHECKLIST}
`

export const MODELO_CARROSSEL = `## Ideias de conteúdo para carrossel

\`\`\`
Considerando o público-alvo formado principalmente por [PÚBLICO-ALVO], crie 10 ideias de carrosséis para Instagram que ressoem com seus desejos e necessidades.
\`\`\`

## Título para a capa



\`\`\`
${PROMPT_TITULOS}
\`\`\`

## Slides

1.
2.
3.
4.
5.

\`\`\`
Crie o texto de um carrossel de 7 slides para Instagram sobre [TÓPICO]. O slide 1 é a capa com o título; os slides 2 a 6 desenvolvem um ponto cada, com no máximo 30 palavras por slide; o slide 7 traz a conclusão e o CTA. Linguagem simples, direta e envolvente.
\`\`\`

## Call to action

_Não faça a audiência raciocinar: entregue duas opções ou uma palavra-chave._



## Elementos e imagens

-

\`\`\`
Sugira elementos visuais, ícones e imagens para cada slide do carrossel acima, mantendo uma identidade visual coesa.
\`\`\`

## Legenda



\`\`\`
${PROMPT_LEGENDA}
\`\`\`

\`\`\`
${PROMPT_HASHTAGS}
\`\`\`

## Imagens no Ideogram

_Traduza o prompt para o inglês antes de usar em [ideogram.ai](https://ideogram.ai)._

\`\`\`
${PROMPT_IDEOGRAM}
\`\`\`

${CHECKLIST}
`

export const MODELOS = [
  { id: "reels", rotulo: "Reels", formato: "Reels/Shorts", texto: MODELO_REELS },
  { id: "carrossel", rotulo: "Carrossel", formato: "Carrossel", texto: MODELO_CARROSSEL },
] as const
