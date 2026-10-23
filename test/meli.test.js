// Testes do link curto oficial (meli.la), com o Mercado Livre simulado.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { convertMercadoLivre } from '../src/links.js'
import { getMeliSession, useMeliCookies } from '../src/meli.js'

const PRODUCT = 'https://produto.mercadolivre.com.br/MLB-123456789-whey-_JM'
const CONFIG = { mattWord: 'anfe5611342', mattTool: '27164927', shortLinks: true }
let createStatus = 200
let lastBody = null

globalThis.fetch = async (url, opts = {}) => {
	const headers = new Headers()
	if (url.includes('/affiliate-program/api/v2/stripe/user/links')) {
		lastBody = { body: JSON.parse(opts.body), headers: opts.headers }
		const ok = createStatus === 200
		return { ok, status: createStatus, headers, json: async () => (ok ? { short_url: 'https://meli.la/AbC123' } : {}) }
	}
	return { ok: true, status: 200, url, headers, text: async () => '<script>window.csrfToken = "tok123"</script>' }
}

test('gera meli.la com a sessão do ML', async () => {
	useMeliCookies([{ name: 'ssid', value: 's' }, { name: 'orguserid', value: 'u' }])
	const r = await convertMercadoLivre(PRODUCT, CONFIG)
	assert.equal(r.url, 'https://meli.la/AbC123')
	assert.equal(r.short, true)
	assert.deepEqual(lastBody.body, { url: PRODUCT, tag: 'anfe5611342' })
	assert.equal(lastBody.headers['x-csrf-token'], 'tok123')
	assert.equal(lastBody.headers.cookie, 'ssid=s; orguserid=u')
})

test('sessão expirada: usa o link grande e avisa no painel', async () => {
	createStatus = 401
	const r = await convertMercadoLivre(PRODUCT, CONFIG)
	assert.equal(r.url, PRODUCT + '?matt_word=anfe5611342&matt_tool=27164927')
	assert.equal(r.short, false)
	assert.equal(getMeliSession().status, 'expirado')
})

test('sem sessão: link grande', async () => {
	useMeliCookies([])
	const r = await convertMercadoLivre(PRODUCT, CONFIG)
	assert.equal(r.short, false)
})
