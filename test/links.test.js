// Testes da conversão de links com respostas simuladas (sem internet).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { convertMessage, extractUrls } from '../src/links.js'

const routes = {
	'https://meli.la/abc': { status: 301, location: 'https://www.mercadolivre.com.br/social/outro?matt_word=outro&matt_tool=111&ref=XYZ' },
	'https://www.mercadolivre.com.br/social/outro?matt_word=outro&matt_tool=111&ref=XYZ': {
		status: 200,
		html: '<a href="https:\\/\\/produto.mercadolivre.com.br\\/MLB-1234567890-whey-protein-_JM?x=1">Whey</a>'
	},
	'https://produto.mercadolivre.com.br/MLB-999999999-creatina-_JM?matt_word=outro&matt_tool=111': { status: 200, html: '' },
	'https://amzn.to/xyz': { status: 302, location: 'https://www.amazon.com.br/Creatina-Max/dp/B0ABCDEF12?tag=outro-20&psc=1' },
	'https://www.amazon.com.br/Creatina-Max/dp/B0ABCDEF12?tag=outro-20&psc=1': { status: 200, html: '' }
}

globalThis.fetch = async (url, opts = {}) => {
	const r = routes[url] || { status: 404, html: '' }
	const headers = new Headers(r.location ? { location: r.location } : {})
	if (r.location && opts.redirect !== 'manual') return globalThis.fetch(r.location, opts)
	return { status: r.status, url, headers, text: async () => r.html || '' }
}

const config = {
	mercadoLivre: { enabled: true, mattWord: 'anfe5611342', mattTool: '27164927' },
	amazon: { enabled: true, tag: 'meutag-20' },
	removeGroupInvites: true,
	footer: ''
}

test('extrai links sem pontuação final', () => {
	assert.deepEqual(extractUrls('Veja: https://meli.la/abc. e https://amzn.to/xyz)'), ['https://meli.la/abc', 'https://amzn.to/xyz'])
})

test('troca meli.la de outro afiliado pelo link do produto com a minha tag', async () => {
	const r = await convertMessage('🔥 Whey por R$ 99\nhttps://meli.la/abc\nEntre: https://chat.whatsapp.com/AAAA', config)
	assert.equal(r.send, true)
	assert.equal(r.converted[0].to, 'https://produto.mercadolivre.com.br/MLB-1234567890-whey-protein-_JM?matt_word=anfe5611342&matt_tool=27164927')
	assert.equal(r.converted[0].productId, 'MLB1234567890')
	assert.ok(!r.text.includes('chat.whatsapp.com'))
	assert.ok(!r.text.includes('outro'))
})

test('link direto de produto ML com tag de outro', async () => {
	const r = await convertMessage('Creatina https://produto.mercadolivre.com.br/MLB-999999999-creatina-_JM?matt_word=outro&matt_tool=111', config)
	assert.equal(r.converted[0].to, 'https://produto.mercadolivre.com.br/MLB-999999999-creatina-_JM?matt_word=anfe5611342&matt_tool=27164927')
})

test('amazon com tag de outro', async () => {
	const r = await convertMessage('Oferta https://amzn.to/xyz', config)
	assert.equal(r.converted[0].to, 'https://www.amazon.com.br/dp/B0ABCDEF12?tag=meutag-20')
})

test('não envia se não conseguir converter', async () => {
	const r = await convertMessage('Oferta https://amzn.to/xyz', { ...config, amazon: { enabled: true, tag: '' } })
	assert.equal(r.send, false)
})

test('mensagem sem link de marketplace não é enviada', async () => {
	const r = await convertMessage('Bom dia pessoal!', config)
	assert.equal(r.send, false)
})
