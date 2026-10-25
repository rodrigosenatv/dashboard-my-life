# foliate-js (cópia)

Motor de leitura de e-books (EPUB, MOBI/AZW3, FB2, CBZ) usado pelo leitor da aba Leitura.

- Origem: https://github.com/johnfactotum/foliate-js
- Versão: commit `78914aef4466eb960965702401634c2cb348e9b1` (1º de maio de 2026)
- Licença: MIT (arquivo `LICENSE`); `vendor/zip.js` é BSD-3-Clause e `vendor/fflate.js` é MIT.

O projeto não publica pacote no npm e recomenda copiar os arquivos. Só entraram os módulos que o leitor usa.
Mudanças locais (marcadas com "My Life" no código):
- `view.js` não abre PDF (o app converte PDF em EPUB antes; o adaptador experimental de PDF e o pdf.js dele ficaram de fora).
- `paginator.js`: `getVisibleRange` devolve `null` quando a seção ainda está carregando (evita erro ao virar páginas muito rápido).
- `paginator.js`: com o atributo `sem-arrastar`, o paginador não arrasta o texto com o dedo (o app trata o gesto e vira a página com o efeito de folha).

Para atualizar, copie os mesmos arquivos de uma versão nova do repositório e refaça as mudanças acima.
