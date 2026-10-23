const { test } = require('node:test')
const assert = require('node:assert/strict')
const { File } = require('node:buffer')
const { identificarImagem, dimensoesReduzidas, otimizarImagem } = require('./carregar-ts.cjs')('src/lib/otimizar-imagem.ts')
function png(animated = false, width = 4000, height = 3000) {
  function chunk(type, data) {
    const b = Buffer.alloc(data.length + 12)
    b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8)
    return b
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4)
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), ...(animated ? [chunk('acTL', Buffer.alloc(8))] : []), chunk('IDAT', Buffer.alloc(160000)), chunk('IEND', Buffer.alloc(0))])
}
test('keeps aspect ratio, never enlarges, and handles portraits', () => {
  assert.deepEqual(dimensoesReduzidas(4000,3000), { largura:1920, altura:1440 })
  assert.deepEqual(dimensoesReduzidas(3000,4000,1600), { largura:1200, altura:1600 })
  assert.deepEqual(dimensoesReduzidas(640,480), { largura:640, altura:480 })
})
test('detects static dimensions and rejects animation, other formats, malformed chunks', () => {
  assert.deepEqual(identificarImagem(png()), { largura:4000, altura:3000 })
  assert.equal(identificarImagem(png(true)), null)
  for (const bytes of [Buffer.from('GIF89a'), Buffer.from('<svg/>'), Buffer.from('RIFFxxxxWEBP'), png().subarray(0, 30)]) assert.equal(identificarImagem(bytes), null)
  const jpeg = Buffer.from([255,216,255,192,0,8,8,11,184,15,160,0])
  assert.deepEqual(identificarImagem(jpeg), { largura:4000, altura:3000 })
})
test('converts smaller WebP and releases resources on success, fallback, and errors', async () => {
  const oldBitmap = global.createImageBitmap; const oldDocument = global.document
  let closes = 0; let mode = 'smaller'; let decodes = 0
  const canvas = { width:0,height:0,getContext:()=>({drawImage(){if(mode==='throw') throw Error('decode')}}),toBlob(callback){callback(mode==='null' ? null : new Blob([Buffer.alloc(mode==='larger'?200000:1000)], {type:mode==='unsupported'?'image/png':'image/webp'}))} }
  global.createImageBitmap = async () => { decodes++; return {width:3000,height:4000,close(){closes++}} }
  global.document = {createElement:()=>canvas}
  try {
    const original = new File([png()], 'photo.png', {type:'image/png', lastModified:42})
    const output = await otimizarImagem(original)
    assert.equal(output.name,'photo.webp'); assert.equal(output.type,'image/webp'); assert.equal(output.lastModified,42)
    assert.equal(closes,1); assert.equal(canvas.width,0); assert.equal(canvas.height,0)
    for (mode of ['larger','null','unsupported','throw']) {
      assert.equal(await otimizarImagem(original),original)
      assert.equal(canvas.width,0); assert.equal(canvas.height,0)
    }
    assert.equal(closes,5)
    for (const file of [new File([png(true)],'animated.png',{type:'image/png'}),new File([png(false,10000,10000)],'huge.png',{type:'image/png'}),new File([png()],'animated.webp',{type:'image/webp'}),new File(['tiny'],'tiny.jpg',{type:'image/jpeg'})]) assert.equal(await otimizarImagem(file),file)
    assert.equal(decodes,5)
  } finally { global.createImageBitmap=oldBitmap; global.document=oldDocument }
})
