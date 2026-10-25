const test = require('node:test')
const assert = require('node:assert/strict')
const L = require('./carregar-ts.cjs')('src/features/leitura/logica.ts')

const livro = (id, extra = {}) => ({
  id,
  title: `Livro ${id}`,
  author: null,
  category: null,
  status: 'desejo',
  pages_total: null,
  pages_read: 0,
  rating: null,
  started_at: null,
  finished_at: null,
  read_years: [],
  favorite: false,
  cover_path: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...extra,
})

test('ano de leitura: o término vale mais que os anos marcados', () => {
  assert.equal(L.anoDeLeitura({ finished_at: '2024-06-04', read_years: [2020, 2024] }), 2024)
  assert.equal(L.anoDeLeitura({ finished_at: null, read_years: [2020, 2022] }), 2022)
  assert.equal(L.anoDeLeitura({ finished_at: null, read_years: [] }), null)
  assert.equal(L.lidoNoAno({ status: 'finalizado', finished_at: null, read_years: [2020, 2024] }, 2020), true)
  assert.equal(L.lidoNoAno({ status: 'lendo', finished_at: '2026-02-01', read_years: [] }, 2026), false)
})

test('prateleiras: só as que têm livros, na ordem certa', () => {
  const livros = [
    livro('a', { status: 'desejo', created_at: '2026-03-01' }),
    livro('b', { status: 'desejo', created_at: '2026-05-01' }),
    livro('c', { status: 'finalizado', finished_at: '2026-02-10', favorite: true, rating: 5 }),
    livro('d', { status: 'finalizado', read_years: [2023] }),
    livro('e', { status: 'lendo' }),
  ]
  const p = L.prateleiras(livros, 2026)
  assert.deepEqual(p.map((x) => x.id), ['desejos', 'lidos-ano', 'favoritos', 'lidos'])
  assert.deepEqual(p[0].livros.map((x) => x.id), ['b', 'a'])
  assert.equal(p[1].titulo, 'Lidos em 2026')
  assert.equal(p[3].titulo, 'Lidos antes')
  assert.deepEqual(L.lendoAgora(livros).map((x) => x.id), ['e'])
})

test('acervo: filtro, busca sem acento, categoria, ano e ordem', () => {
  const livros = [
    livro('a', { title: 'Antifrágil', author: 'Nassim Taleb', status: 'finalizado', read_years: [2024], category: 'Desenvolvimento Pessoal', rating: 5 }),
    livro('b', { title: 'O corpo fala', status: 'finalizado', finished_at: '2025-11-23', rating: 4 }),
    livro('c', { title: 'Essencialismo', status: 'desejo', category: 'desenvolvimento pessoal' }),
  ]
  assert.deepEqual(L.filtrarAcervo(livros, { busca: 'antifragil' }).map((x) => x.id), ['a'])
  assert.deepEqual(L.filtrarAcervo(livros, { filtro: 'lidos', ordem: 'nota' }).map((x) => x.id), ['a', 'b'])
  assert.deepEqual(L.filtrarAcervo(livros, { categoria: 'Desenvolvimento Pessoal', ordem: 'titulo' }).map((x) => x.id), ['a', 'c'])
  assert.deepEqual(L.filtrarAcervo(livros, { ano: 2025 }).map((x) => x.id), ['b'])
  assert.deepEqual(L.categorias(livros), ['Desenvolvimento Pessoal'])
  assert.deepEqual(L.anosDeLeitura(livros), [2025, 2024])
})

test('meta do ano: ritmo, atraso e cadência', () => {
  // 1º de julho: metade do ano passou (182 de 365 dias)
  const r = L.ritmoDaMeta(12, 3, '2026-07-01')
  assert.equal(r.tom, 'atras')
  assert.equal(r.texto, '3 livros atrás do ritmo')
  assert.match(r.cadencia, /^1 livro a cada \d+ dias$/)
  assert.equal(L.ritmoDaMeta(12, 7, '2026-07-01').tom, 'a-frente')
  assert.equal(L.ritmoDaMeta(12, 6, '2026-07-01').texto, 'No ritmo da meta')
  assert.equal(L.ritmoDaMeta(12, 12, '2026-07-01').tom, 'feita')
  assert.equal(L.ritmoDaMeta(10, 9, '2026-12-31').cadencia, '1 livro por dia')
})

test('diário: o registro do dia nunca fica negativo e corrige o início', () => {
  assert.equal(L.registroDoDia(null, 100, 100), null)
  assert.equal(L.registroDoDia(null, 100, 90), null)
  assert.deepEqual(L.registroDoDia(null, 100, 118), { inicio: 100, ate: 118, paginas: 18 })
  assert.deepEqual(L.registroDoDia({ inicio: 100, ate: 118 }, 118, 130), { inicio: 100, ate: 130, paginas: 30 })
  assert.deepEqual(L.registroDoDia({ inicio: 100, ate: 118 }, 118, 95), { inicio: 95, ate: 95, paginas: 0 })
})

test('diário: dias seguidos, semana, ritmo e previsão', () => {
  const d = (dia, paginas, livro = 'x') => ({ id: dia + livro, livro, titulo: 'X', dia, inicio: 0, ate: paginas, paginas })
  const dias = [d('2026-10-20', 10), d('2026-10-22', 12), d('2026-10-23', 8), d('2026-10-24', 20), d('2026-10-24', 5, 'y')]
  assert.equal(L.sequencia(dias, '2026-10-25'), 3)
  assert.equal(L.sequencia(dias, '2026-10-24'), 3)
  assert.equal(L.sequencia(dias, '2026-10-27'), 0)
  const s = L.resumoSemana(dias, '2026-10-25')
  assert.deepEqual(s.dias, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
  assert.equal(s.paginas, 55)
  assert.equal(s.lidos.has('2026-10-21'), false)
  // 50 páginas do livro x desde o dia 20 (6 dias até o dia 25)
  assert.equal(L.ritmoDoLivro(dias, 'x', '2026-10-25'), 50 / 6)
  assert.deepEqual(L.previsaoDeTermino(100, 50 / 6, '2026-10-25'), { dias: 12, dia: '2026-11-06' })
  assert.equal(L.previsaoDeTermino(0, 10, '2026-10-25'), null)
  assert.equal(L.ritmoDoLivro(dias, 'z', '2026-10-25'), null)
})

test('diário: lê os itens da coleção e ignora os incompletos', () => {
  const item = { id: '1', title: 'Antifrágil', props: { Data: '2026-10-25', 'Até a página': 130, _inicio: 100, _livro: 'abc', Páginas: 30 } }
  assert.deepEqual(L.lerDiaLeitura(item), { id: '1', livro: 'abc', titulo: 'Antifrágil', dia: '2026-10-25', inicio: 100, ate: 130, paginas: 30 })
  assert.equal(L.lerDiaLeitura({ id: '2', title: 'X', props: { Data: '2026-10-25' } }), null)
  assert.equal(L.lerDiaLeitura({ id: '3', title: 'X', props: { _livro: 'a', Data: 'ontem' } }), null)
})

test('capas: só https dos sites conhecidos; caminho do storage continua valendo', () => {
  assert.equal(
    L.urlDeCapaSegura('http://books.google.com/books/content?id=abc123XYZ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api'),
    'https://books.google.com/books/content?id=abc123XYZ&printsec=frontcover&img=1&zoom=1&source=gbs_api',
  )
  assert.equal(L.urlDeCapaSegura('https://exemplo.com/capa.jpg'), null)
  assert.equal(L.urlDeCapaSegura('javascript:alert(1)'), null)
  assert.deepEqual(L.capaDoLivro('u1/livros/l1/capa.jpg'), { tipo: 'arquivo', caminho: 'u1/livros/l1/capa.jpg' })
  assert.equal(L.capaDoLivro(' '), null)
  assert.equal(L.googleIdDaCapa('https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover'), 'zyTCAlFPjgYC')
  assert.equal(L.googleIdDaCapa('https://covers.openlibrary.org/b/id/123-L.jpg'), null)
})

test('busca: lê volumes do Google e livros da Open Library', () => {
  const g = L.lerVolumeGoogle({
    id: 'vol1',
    volumeInfo: {
      title: 'Antifrágil',
      subtitle: 'Coisas que se beneficiam com o caos',
      authors: ['Nassim Nicholas Taleb'],
      pageCount: 616,
      publishedDate: '2014-03-01',
      imageLinks: { thumbnail: 'http://books.google.com/books/content?id=vol1&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' },
      industryIdentifiers: [{ type: 'ISBN_10', identifier: '8576847763' }, { type: 'ISBN_13', identifier: '9788576847762' }],
    },
  })
  assert.equal(g.titulo, 'Antifrágil')
  assert.equal(g.subtitulo, 'Coisas que se beneficiam com o caos')
  assert.equal(g.ano, '2014')
  assert.equal(g.isbn, '9788576847762')
  assert.match(g.capa, /^https:\/\/books\.google\.com\//)
  assert.equal(L.lerVolumeGoogle({ id: 'x', volumeInfo: {} }), null)
  const o = L.lerDocOpenLibrary({ key: '/works/OL1W', title: 'Essentialism', author_name: ['Greg McKeown'], cover_i: 42, number_of_pages_median: 260.4 })
  assert.equal(o.capa, 'https://covers.openlibrary.org/b/id/42-M.jpg')
  assert.equal(o.paginas, 260)
  assert.equal(L.capaGrandeGoogle({ thumbnail: 'http://books.google.com/a?id=1', medium: 'http://books.google.com/books/publisher/content?id=1&zoom=4' }), 'https://books.google.com/books/publisher/content?id=1&zoom=4')
  assert.equal(L.consultaDeBusca('978-85-7684-776-2'), 'isbn:9788576847762')
  assert.equal(L.consultaDeBusca('O corpo fala'), 'O corpo fala')
})

test('semelhança: acha o livro certo e recusa o parecido demais', () => {
  assert.ok(L.semelhanca('Antifrágil', 'Antifrágil: coisas que se beneficiam com o caos') > 0.9)
  assert.ok(L.semelhanca('A SUTIL ARTE DE LIGAR O F*DA-SE', 'A sutil arte de ligar o f*da-se') > 0.99)
  assert.ok(L.semelhanca('O corpo fala', 'O poder do agora') < 0.3)
  const certo = { chave: 'g1', titulo: 'Essencialismo', subtitulo: 'A disciplinada busca por menos', autores: ['Greg McKeown'], capa: 'https://books.google.com/x', capaOpenLibrary: null }
  const errado = { chave: 'g2', titulo: 'Essencialismo na prática', subtitulo: null, autores: ['Outra Pessoa'], capa: null, capaOpenLibrary: null }
  assert.equal(L.escolherResultado({ title: 'Essencialismo', author: 'Greg McKeown' }, [errado, certo]).chave, 'g1')
  assert.equal(L.escolherResultado({ title: 'Hábitos Atômicos', author: null }, [errado]), null)
})

test('sinopse em texto, número de catálogo e espessura', () => {
  assert.equal(L.sinopseEmTexto('<p>Um <b>livro</b>&nbsp;bom.</p><p>Leia &amp; aprenda</p>'), 'Um livro bom.\n\nLeia & aprenda')
  assert.match(L.codigoDoLivro({ id: 'abc', category: 'Desenvolvimento Pessoal' }), /^DES·\d{3}$/)
  assert.match(L.codigoDoLivro({ id: 'abc', category: null }), /^GER·\d{3}$/)
  assert.equal(L.espessura(100), 9)
  assert.equal(L.espessura(1726), 26)
  assert.equal(L.espessura(null), 13)
  assert.equal(L.paginaValida(500, 291), 291)
  assert.equal(L.paginaValida(-3, null), 0)
  assert.equal(L.textoPagina({ pages_read: 104, pages_total: 291 }), 'Página 104 de 291')
})
